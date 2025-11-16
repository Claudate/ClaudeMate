import Dexie, { Table } from 'dexie';
import { Logger } from '../utils/Logger';
import { tokenizerService } from './TokenizerService';

const logger = Logger.getInstance('ConversationDatabase');

/**
 * 会话消息接口
 */
export interface ConversationMessage {
  id?: number;              // 自动递增 ID
  sessionId: string;        // Claude CLI session ID
  timestamp: number;        // Unix 时间戳（毫秒）
  role: 'user' | 'assistant' | 'system';  // 消息角色
  content: string;          // 消息内容
  projectPath?: string;     // 关联的项目路径
  metadata?: {              // 元数据
    title?: string;         // 对话标题（可选）
    model?: string;         // 使用的模型
    tokenCount?: number;    // Token 数量
  };
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  message: ConversationMessage;
  matchType: 'content' | 'title';  // 匹配类型
  matchScore: number;               // 匹配分数（0-1）
}

/**
 * 基于 IndexedDB 的会话数据库
 * 用于快速搜索和检索历史对话
 */
export class ConversationDatabase extends Dexie {
  conversations!: Table<ConversationMessage, number>;

  constructor() {
    super('ClaudeConversations');

    // 定义数据库 schema
    this.version(1).stores({
      // 索引说明：
      // ++id: 自动递增主键
      // sessionId: 按 session ID 索引
      // timestamp: 按时间索引（用于排序）
      // role: 按角色索引
      // projectPath: 按项目路径索引
      // *content: 全文索引（支持搜索）
      conversations: '++id, sessionId, timestamp, role, projectPath, *content'
    });

    logger.info('📊 ConversationDatabase 初始化完成');
  }

  /**
   * 保存消息到数据库
   */
  async saveMessage(message: ConversationMessage): Promise<number> {
    try {
      const id = await this.conversations.add(message);
      logger.debug(`💾 保存消息到 IndexedDB: id=${id}, session=${message.sessionId}`);
      return id;
    } catch (error) {
      logger.error(`保存消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 批量保存消息
   */
  async saveMessages(messages: ConversationMessage[]): Promise<void> {
    try {
      await this.conversations.bulkAdd(messages);
      logger.info(`💾 批量保存 ${messages.length} 条消息到 IndexedDB`);
    } catch (error) {
      logger.error(`批量保存消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 获取指定 session 的所有消息
   */
  async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const messages = await this.conversations
        .where('sessionId')
        .equals(sessionId)
        .sortBy('timestamp');

      logger.debug(`📖 获取 session 消息: ${sessionId}, 共 ${messages.length} 条`);
      return messages;
    } catch (error) {
      logger.error(`获取 session 消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 获取指定项目的所有消息
   */
  async getProjectMessages(projectPath: string): Promise<ConversationMessage[]> {
    try {
      const messages = await this.conversations
        .where('projectPath')
        .equals(projectPath)
        .sortBy('timestamp');

      logger.debug(`📖 获取项目消息: ${projectPath}, 共 ${messages.length} 条`);
      return messages;
    } catch (error) {
      logger.error(`获取项目消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 全文搜索（支持内容和标题）- 使用多语言分词
   * @param keyword 搜索关键词
   * @param options 搜索选项
   */
  async search(
    keyword: string,
    options?: {
      sessionId?: string;      // 限定 session
      projectPath?: string;    // 限定项目
      role?: 'user' | 'assistant' | 'system';  // 限定角色
      limit?: number;          // 结果数量限制
      useTokenizer?: boolean;  // 是否使用分词器（默认 true）
    }
  ): Promise<SearchResult[]> {
    try {
      logger.info(`🔍 开始搜索: keyword="${keyword}", options=${JSON.stringify(options)}`);

      let query = this.conversations.toCollection();

      // 应用过滤条件
      if (options?.sessionId) {
        query = query.filter(msg => msg.sessionId === options.sessionId);
      }
      if (options?.projectPath) {
        query = query.filter(msg => msg.projectPath === options.projectPath);
      }
      if (options?.role) {
        query = query.filter(msg => msg.role === options.role);
      }

      // 获取所有符合条件的消息
      const allMessages = await query.toArray();

      const useTokenizer = options?.useTokenizer !== false;

      // 对关键词进行分词（如果启用）
      const keywordTokens = useTokenizer
        ? tokenizerService.tokenize(keyword).tokens
        : [keyword.toLowerCase()];

      logger.debug(`🔍 关键词分词结果: ${keywordTokens.join(', ')}`);

      const results: SearchResult[] = [];

      for (const message of allMessages) {
        const contentLower = message.content.toLowerCase();
        const titleLower = message.metadata?.title?.toLowerCase() || '';

        let matchType: 'content' | 'title' | null = null;
        let matchScore = 0;

        if (useTokenizer) {
          // 使用分词器进行智能匹配
          const contentTokens = tokenizerService.tokenize(message.content).tokens;
          const titleTokens = tokenizerService.tokenize(message.metadata?.title || '').tokens;

          // 计算标题匹配分数
          const titleMatches = keywordTokens.filter(token =>
            titleTokens.some(t => t.toLowerCase().includes(token.toLowerCase()))
          ).length;

          if (titleMatches > 0) {
            matchType = 'title';
            matchScore = titleMatches / keywordTokens.length;  // 匹配比例
            matchScore = Math.min(matchScore * 1.2, 1.0);  // 标题权重提升20%
          }

          // 计算内容匹配分数
          const contentMatches = keywordTokens.filter(token =>
            contentTokens.some(t => t.toLowerCase().includes(token.toLowerCase()))
          ).length;

          if (contentMatches > 0 && !matchType) {
            matchType = 'content';
            // 内容匹配分数：考虑匹配数量和位置
            matchScore = contentMatches / keywordTokens.length * 0.6;

            // 检查是否在开头位置匹配（提升分数）
            const firstMatch = keywordTokens.find(token =>
              contentTokens.slice(0, 5).some(t => t.toLowerCase().includes(token.toLowerCase()))
            );
            if (firstMatch) {
              matchScore += 0.2;
            }
          }
        } else {
          // 简单字符串匹配（降级方案）
          const keywordLower = keyword.toLowerCase();

          // 检查标题匹配
          if (titleLower.includes(keywordLower)) {
            matchType = 'title';
            matchScore = titleLower === keywordLower ? 1.0 : 0.7;
          }
          // 检查内容匹配
          else if (contentLower.includes(keywordLower)) {
            matchType = 'content';
            const occurrences = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
            const position = contentLower.indexOf(keywordLower);
            matchScore = Math.min(0.3 + (occurrences * 0.1) + (position === 0 ? 0.2 : 0), 0.6);
          }
        }

        if (matchType) {
          results.push({
            message,
            matchType,
            matchScore
          });
        }
      }

      // 按匹配分数降序排序
      results.sort((a, b) => b.matchScore - a.matchScore);

      // 应用数量限制
      const limitedResults = options?.limit ? results.slice(0, options.limit) : results;

      logger.info(`✅ 搜索完成: 找到 ${limitedResults.length} 条结果`);
      return limitedResults;
    } catch (error) {
      logger.error(`搜索失败: ${error}`);
      throw error;
    }
  }

  /**
   * 删除指定 session 的所有消息
   */
  async deleteSessionMessages(sessionId: string): Promise<number> {
    try {
      const count = await this.conversations
        .where('sessionId')
        .equals(sessionId)
        .delete();

      logger.info(`🗑️ 删除 session 消息: ${sessionId}, 共 ${count} 条`);
      return count;
    } catch (error) {
      logger.error(`删除 session 消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 删除指定项目的所有消息
   */
  async deleteProjectMessages(projectPath: string): Promise<number> {
    try {
      const count = await this.conversations
        .where('projectPath')
        .equals(projectPath)
        .delete();

      logger.info(`🗑️ 删除项目消息: ${projectPath}, 共 ${count} 条`);
      return count;
    } catch (error) {
      logger.error(`删除项目消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 清空所有消息
   */
  async clearAll(): Promise<void> {
    try {
      await this.conversations.clear();
      logger.info(`🗑️ 清空所有消息`);
    } catch (error) {
      logger.error(`清空消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{
    totalMessages: number;
    sessionCount: number;
    projectCount: number;
    oldestMessage?: Date;
    newestMessage?: Date;
  }> {
    try {
      const totalMessages = await this.conversations.count();

      // 获取唯一 session 数量
      const sessions = await this.conversations.toCollection().uniqueKeys();
      const sessionCount = new Set(
        await this.conversations.toCollection().keys()
      ).size;

      // 获取唯一项目数量
      const projects = await this.conversations
        .toCollection()
        .uniqueKeys();
      const projectCount = new Set(
        (await this.conversations.toArray())
          .map(msg => msg.projectPath)
          .filter(Boolean)
      ).size;

      // 获取最早和最新消息时间
      const allMessages = await this.conversations.toArray();
      const timestamps = allMessages.map(msg => msg.timestamp);
      const oldestMessage = timestamps.length > 0
        ? new Date(Math.min(...timestamps))
        : undefined;
      const newestMessage = timestamps.length > 0
        ? new Date(Math.max(...timestamps))
        : undefined;

      return {
        totalMessages,
        sessionCount,
        projectCount,
        oldestMessage,
        newestMessage
      };
    } catch (error) {
      logger.error(`获取统计信息失败: ${error}`);
      throw error;
    }
  }
}
