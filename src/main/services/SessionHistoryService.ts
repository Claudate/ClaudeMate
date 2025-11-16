import { Logger } from '../utils/Logger';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const logger = Logger.getInstance('SessionHistoryService');

/**
 * 会话消息接口（简化版，仅用于 JSONL）
 */
export interface ConversationMessage {
  sessionId: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectPath?: string;
  metadata?: {
    title?: string;
    model?: string;
    tokenCount?: number;
  };
}

/**
 * 会话历史服务（仅负责 JSONL 备份）
 * ⚠️ IndexedDB 操作已移到渲染进程
 * 主进程只负责：
 * 1. JSONL 文件备份
 * 2. 从 JSONL 加载历史数据
 */
export class SessionHistoryService {
  private static instance: SessionHistoryService;
  private backupDir: string;
  private initialized: boolean = false;

  private constructor() {
    this.backupDir = ''; // 延迟初始化
  }

  /**
   * 初始化备份目录（需要在 app.ready 之后调用）
   */
  private initBackupDir() {
    if (this.initialized) return;

    try {
      // 设置备份目录（与 session 存储目录并列）
      const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
      this.backupDir = join(appPath, '.claude-history-backup');

      if (!existsSync(this.backupDir)) {
        mkdirSync(this.backupDir, { recursive: true });
        logger.info(`📁 创建历史备份目录: ${this.backupDir}`);
      } else {
        logger.info(`📁 使用历史备份目录: ${this.backupDir}`);
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`初始化备份目录失败: ${error}`);
      // 使用当前目录作为降级方案
      this.backupDir = join(process.cwd(), '.claude-history-backup');
      mkdirSync(this.backupDir, { recursive: true });
      this.initialized = true;
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SessionHistoryService {
    if (!SessionHistoryService.instance) {
      SessionHistoryService.instance = new SessionHistoryService();
    }
    return SessionHistoryService.instance;
  }

  /**
   * 保存单条消息到 JSONL
   */
  public async saveMessage(message: ConversationMessage): Promise<void> {
    try {
      await this.appendToJSONL(message);
      logger.debug(`💾 消息已保存到 JSONL`);
    } catch (error) {
      logger.error(`保存消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 批量保存消息到 JSONL
   */
  public async saveMessages(messages: ConversationMessage[]): Promise<void> {
    try {
      for (const message of messages) {
        await this.appendToJSONL(message);
      }
      logger.info(`💾 批量保存 ${messages.length} 条消息到 JSONL`);
    } catch (error) {
      logger.error(`批量保存消息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 异步追加到 JSONL 文件
   */
  private async appendToJSONL(message: ConversationMessage): Promise<void> {
    this.initBackupDir(); // 确保已初始化
    try {
      const fileName = `${message.sessionId}.jsonl`;
      const filePath = join(this.backupDir, fileName);

      // 将消息转为 JSON 行
      const jsonLine = JSON.stringify(message) + '\n';

      // 追加到文件
      appendFileSync(filePath, jsonLine, 'utf8');
      logger.debug(`📝 JSONL 备份: ${fileName}`);
    } catch (error) {
      logger.error(`JSONL 写入失败: ${error}`);
      throw error;
    }
  }


  /**
   * 从 JSONL 加载指定 session 的消息
   */
  public async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    this.initBackupDir();
    const fileName = `${sessionId}.jsonl`;
    const filePath = join(this.backupDir, fileName);

    if (!existsSync(filePath)) {
      logger.info(`📂 JSONL 文件不存在: ${fileName}`);
      return [];
    }

    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const messages: ConversationMessage[] = [];
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          messages.push(message);
        } catch (err) {
          logger.warn(`解析 JSONL 行失败: ${err}`);
        }
      }

      logger.info(`📖 从 JSONL 加载 ${messages.length} 条消息: ${sessionId}`);
      return messages;
    } catch (error) {
      logger.error(`从 JSONL 加载失败: ${error}`);
      throw error;
    }
  }

  /**
   * 解析 Claude CLI 的流式 JSON 输出并提取消息
   * 返回解析后的消息，如果无法提取则返回 null
   */
  public parseClaudeStreamEvent(jsonLine: string): ConversationMessage | null {
    try {
      const event = JSON.parse(jsonLine);

      // Claude CLI 流式输出的事件类型
      // 我们主要关注包含内容的事件
      if (event.type === 'content_block_delta' && event.delta?.text) {
        // 这是增量文本，需要累积
        // 暂时不处理，等完整消息
        return null;
      }

      if (event.type === 'message' && event.message) {
        // 完整消息事件
        const msg = event.message;

        // 提取内容
        let content = '';
        if (msg.content && Array.isArray(msg.content)) {
          content = msg.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
        }

        if (!content) return null;

        return {
          sessionId: '',  // 需要外部设置
          timestamp: Date.now(),
          role: msg.role || 'assistant',
          content,
          metadata: {
            model: msg.model,
            tokenCount: msg.usage?.output_tokens
          }
        };
      }

      return null;
    } catch (error) {
      logger.warn(`解析 Claude 流式事件失败: ${error}`);
      return null;
    }
  }

  /**
   * 从 Claude CLI 的完整响应中提取消息
   */
  public extractMessagesFromResponse(
    response: string,
    sessionId: string,
    projectPath?: string
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    const lines = response.split('\n').filter(line => line.trim().length > 0);

    for (const line of lines) {
      try {
        const msg = this.parseClaudeStreamEvent(line);
        if (msg) {
          msg.sessionId = sessionId;
          msg.projectPath = projectPath;
          messages.push(msg);
        }
      } catch (err) {
        // 忽略解析错误
      }
    }

    return messages;
  }
}

// ⚠️ 不要在模块加载时实例化，因为需要等待 app.ready
// 使用时调用 SessionHistoryService.getInstance() 即可
