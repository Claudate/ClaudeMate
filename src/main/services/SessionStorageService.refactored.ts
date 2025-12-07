/**
 * Session Storage Service - 核心协调器（重构版）
 * 参照 WPF 的 SessionStorageService.cs 实现
 *
 * 功能：
 * 1. 按项目路径隔离存储会话数据
 * 2. 使用 SHA256 Hash 生成项目存储目录
 * 3. 维护 sessionIndex.json 快速索引
 * 4. 支持智能标题生成
 * 5. 全局会话查询和搜索
 *
 * 重构架构：
 * - 主文件仅负责模块协调和对外 API
 * - 所有具体功能拆分到独立模块
 * - 行数从 847 行减少到约 300 行（减少 65%）
 */

import * as path from 'path';
import {
  ChatSession,
  ChatSessionMetadata,
  ChatMessage,
  SessionStatistics
} from '@shared/types/domain.types';
import { Logger } from '../utils/Logger';
import { SearchIndexService } from './SearchIndexService';

// 导入所有模块
import {
  SessionRepository,
  SessionIndexer,
  SessionSearcher,
  SessionStatisticsModule,
  SessionSummarizer
} from './session-storage-modules';

const logger = Logger.getInstance('SessionStorageService');

export class SessionStorageService {
  private baseStoragePath: string;
  private searchIndexService: SearchIndexService;

  // 模块实例
  private repository: SessionRepository;
  private indexer: SessionIndexer;
  private searcher: SessionSearcher;
  private statistics: SessionStatisticsModule;
  private summarizer: SessionSummarizer;

  constructor(baseStoragePath?: string) {
    // 默认存储路径：应用根目录的 ChatHistory 文件夹
    this.baseStoragePath = baseStoragePath || path.join(process.cwd(), 'ChatHistory');

    // 初始化搜索索引服务
    this.searchIndexService = SearchIndexService.getInstance();

    // 初始化所有模块
    this.repository = new SessionRepository(this.baseStoragePath);
    this.indexer = new SessionIndexer(this.baseStoragePath);
    this.searcher = new SessionSearcher(this.baseStoragePath);
    this.statistics = new SessionStatisticsModule(this.baseStoragePath);
    this.summarizer = new SessionSummarizer(this.baseStoragePath);

    logger.info(`[SessionStorageService] 初始化完成，存储路径: ${this.baseStoragePath}`);
  }

  // ========== 会话管理 API ==========

  /**
   * 创建新会话
   * @param sessionId 可选，如果提供则使用指定的 sessionId，否则生成新的 UUID
   */
  async createSessionAsync(
    projectPath: string,
    projectName: string,
    title?: string,
    sessionId?: string
  ): Promise<ChatSession> {
    const session = await this.repository.createSessionAsync(
      projectPath,
      projectName,
      title,
      sessionId
    );

    // 生成摘要并更新索引
    const summary = await this.summarizer.generateSessionSummary(session);
    await this.indexer.updateIndexAsync(projectPath, session, summary);
    this.indexer.invalidateCache();

    // 更新搜索索引
    await this.updateSearchIndex(session);

    return session;
  }

  /**
   * 获取指定会话
   */
  async getSessionAsync(projectPath: string, sessionId: string): Promise<ChatSession | null> {
    return this.repository.getSessionAsync(projectPath, sessionId);
  }

  /**
   * 获取项目的所有会话元数据
   */
  async getAllSessionsAsync(projectPath: string): Promise<ChatSessionMetadata[]> {
    return this.indexer.getAllSessionsAsync(projectPath);
  }

  /**
   * 保存消息到会话
   */
  async saveMessageAsync(
    projectPath: string,
    sessionId: string,
    message: ChatMessage
  ): Promise<void> {
    const session = await this.repository.saveMessageAsync(projectPath, sessionId, message);

    // 如果是第一条用户消息，生成智能标题
    if (session.messages.length === 1 && message.role === 'user' && message.content) {
      try {
        const smartTitle = await this.summarizer.generateSmartTitle(
          message.content,
          session.projectName
        );
        if (smartTitle && smartTitle !== session.title) {
          session.title = smartTitle;
          await this.repository.saveSessionAsync(projectPath, session);
          logger.info(`[SessionStorage] 已生成智能标题: ${smartTitle}`);
        }
      } catch (error) {
        logger.warn(`[SessionStorage] 智能标题生成失败，使用默认标题:`, error);
      }
    }

    // 更新索引
    const summary = await this.summarizer.generateSessionSummary(session);
    await this.indexer.updateIndexAsync(projectPath, session, summary);
    this.indexer.invalidateCache();

    // 更新搜索索引
    await this.updateSearchIndex(session);

    logger.info(`[SessionStorage] 保存消息到会话 ${sessionId}: ${message.role}`);
  }

  /**
   * 更新会话数据
   */
  async updateSessionAsync(projectPath: string, session: ChatSession): Promise<void> {
    await this.repository.updateSessionAsync(projectPath, session);

    // 更新索引
    const summary = await this.summarizer.generateSessionSummary(session);
    await this.indexer.updateIndexAsync(projectPath, session, summary);
    this.indexer.invalidateCache();

    // 更新搜索索引
    await this.updateSearchIndex(session);
  }

  /**
   * 更新会话标题
   */
  async updateSessionTitleAsync(
    projectPath: string,
    sessionId: string,
    newTitle: string
  ): Promise<void> {
    await this.repository.updateSessionTitleAsync(projectPath, sessionId, newTitle);

    // 更新索引
    const session = await this.repository.getSessionAsync(projectPath, sessionId);
    if (session) {
      const summary = await this.summarizer.generateSessionSummary(session);
      await this.indexer.updateIndexAsync(projectPath, session, summary);
      this.indexer.invalidateCache();
    }
  }

  /**
   * 删除会话
   */
  async deleteSessionAsync(projectPath: string, sessionId: string): Promise<void> {
    // 删除会话文件
    await this.repository.deleteSessionFileAsync(projectPath, sessionId);

    // 从索引中移除
    await this.indexer.removeFromIndexAsync(projectPath, sessionId);
    this.indexer.invalidateCache();

    // 从搜索索引中删除
    this.searchIndexService.deleteSession(sessionId);

    logger.info(`[SessionStorage] 删除会话: ${sessionId}`);
  }

  // ========== 搜索 API ==========

  /**
   * 搜索会话（标题/项目名）
   * @param keyword 搜索关键词
   * @param projectName 项目名称（用于过滤，非项目路径）
   */
  async searchSessionsAsync(keyword: string, projectName?: string): Promise<ChatSessionMetadata[]> {
    const allSessions = await this.indexer.getAllGlobalSessionsAsync();
    return this.searcher.searchSessionsAsync(allSessions, keyword, projectName);
  }

  /**
   * 根据消息内容搜索会话（深度搜索）
   * @param keyword 搜索关键词
   * @param projectName 项目名称（用于过滤，非项目路径）
   */
  async searchSessionsByMessageContentAsync(
    keyword: string,
    projectName?: string
  ): Promise<ChatSessionMetadata[]> {
    const allSessions = await this.indexer.getAllGlobalSessionsAsync();
    return this.searcher.searchSessionsByMessageContentAsync(
      allSessions,
      keyword,
      projectName,
      this.repository.getSessionAsync.bind(this.repository)
    );
  }

  /**
   * 使用搜索索引进行全文搜索（公共接口）
   */
  public searchWithIndex(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      projectPath?: string;
      sortBy?: 'relevance' | 'time';
    } = {}
  ): any[] {
    try {
      return this.searchIndexService.search(query, options);
    } catch (error) {
      logger.error(`[SessionStorage] 搜索失败:`, error);
      return [];
    }
  }

  // ========== 全局视图 API ==========

  /**
   * 获取所有项目的会话元数据列表（全局视图）
   */
  async getAllGlobalSessionsAsync(): Promise<ChatSessionMetadata[]> {
    return this.indexer.getAllGlobalSessionsAsync();
  }

  /**
   * 获取所有项目名称列表
   */
  async getAllProjectNamesAsync(): Promise<string[]> {
    return this.indexer.getAllProjectNamesAsync();
  }

  /**
   * 获取全局会话统计信息
   */
  async getGlobalSessionStatisticsAsync(): Promise<SessionStatistics> {
    const allSessions = await this.indexer.getAllGlobalSessionsAsync();
    const projectNames = await this.indexer.getAllProjectNamesAsync();
    return this.statistics.getGlobalSessionStatisticsAsync(allSessions, projectNames);
  }

  // ========== 搜索索引管理 ==========

  /**
   * 重建所有会话的搜索索引（用于初始化或索引损坏时）
   */
  public async rebuildSearchIndexAsync(): Promise<void> {
    logger.info('[SessionStorage] 开始重建搜索索引...');

    try {
      // 清空现有索引
      this.searchIndexService.clearAll();

      // 获取所有会话元数据
      const allSessions = await this.indexer.getAllGlobalSessionsAsync();

      const indexData: Array<{ session: ChatSessionMetadata; messages: string[] }> = [];

      // 读取每个会话的完整数据
      for (const sessionMeta of allSessions) {
        try {
          const session = await this.repository.getSessionAsync(
            sessionMeta.projectPath,
            sessionMeta.id
          );
          if (session) {
            const messages = session.messages
              .filter((m) => m.content && typeof m.content === 'string')
              .map((m) => m.content as string);

            indexData.push({ session: sessionMeta, messages });
          }
        } catch (error) {
          logger.error(`[SessionStorage] 读取会话失败 ${sessionMeta.id}:`, error);
        }
      }

      // 批量索引
      this.searchIndexService.indexSessionsBatch(indexData);

      logger.info(`[SessionStorage] 搜索索引重建完成，共 ${indexData.length} 个会话`);
    } catch (error) {
      logger.error('[SessionStorage] 重建搜索索引失败:', error);
      throw error;
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 更新搜索索引（私有辅助方法）
   */
  private async updateSearchIndex(session: ChatSession): Promise<void> {
    try {
      // 提取所有消息内容
      const messages = session.messages
        .filter((m) => m.content && typeof m.content === 'string')
        .map((m) => m.content as string);

      // 生成会话摘要
      const summary = await this.summarizer.generateSessionSummary(session);

      // 构建元数据
      const metadata: ChatSessionMetadata = {
        id: session.id,
        title: session.title,
        projectName: session.projectName,
        projectPath: session.projectPath,
        createdAt: session.createdAt,
        modifiedAt: session.modifiedAt,
        startTime: session.startTime,
        duration: session.duration,
        model: session.model,
        approval: session.approval,
        cliVersion: session.cliVersion,
        messageCount: session.messages.length,
        fileSize: 0, // 文件大小在 updateIndexAsync 中计算
        totalTokens: session.tokenUsages.reduce((sum, t) => sum + t.totalTokens, 0),
        inputTokens: session.tokenUsages.reduce((sum, t) => sum + t.inputTokens, 0),
        outputTokens: session.tokenUsages.reduce((sum, t) => sum + t.outputTokens, 0),
        uploadCount: session.messages.reduce((count, m) =>
          count + (m.toolUses?.filter(t => t.name === 'Write' || t.name === 'Edit').length || 0), 0
        ),
        downloadCount: session.messages.reduce((count, m) =>
          count + (m.toolUses?.filter(t => t.name === 'Read' || t.name === 'Grep').length || 0), 0
        ),
        summary,
      };

      // 更新索引
      this.searchIndexService.indexSession(metadata, messages);
    } catch (error) {
      logger.error(`[SessionStorage] 更新搜索索引失败:`, error);
      // 不抛出错误，避免影响主流程
    }
  }
}
