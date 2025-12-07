/**
 * Session Storage Service
 * 参照 WPF 的 SessionStorageService.cs 实现
 *
 * 功能：
 * 1. 按项目路径隔离存储会话数据
 * 2. 使用 SHA256 Hash 生成项目存储目录
 * 3. 维护 sessionIndex.json 快速索引
 * 4. 支持智能标题生成
 * 5. 全局会话查询和搜索
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ChatSession,
  ChatSessionMetadata,
  ChatMessage,
  TokenUsage,
  SessionStatistics
} from '@shared/types/domain.types';
import { Logger } from '../utils/Logger';
import { SearchIndexService } from './SearchIndexService';
import { OpenRouterService } from './OpenRouterService';

const logger = Logger.getInstance('SessionStorageService');

export class SessionStorageService {
  private baseStoragePath: string;
  private globalSessionsCache: ChatSessionMetadata[] | null = null;
  private cacheLastUpdated: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存
  private searchIndexService: SearchIndexService; // ⭐ 搜索索引服务
  private isBulkImportMode: boolean = false; // ⭐ 批量导入模式标志
  private pendingIndexSessions: Map<string, string> = new Map(); // ⭐ 待索引的会话: Map<sessionId, projectPath>

  constructor(baseStoragePath?: string) {
    // 默认存储路径：应用根目录的 ChatHistory 文件夹
    this.baseStoragePath = baseStoragePath || path.join(process.cwd(), 'ChatHistory');

    // ⭐ 初始化搜索索引服务
    this.searchIndexService = SearchIndexService.getInstance();

    logger.info(`[SessionStorageService] 初始化完成，存储路径: ${this.baseStoragePath}`);
  }

  /**
   * 计算项目路径的 SHA256 Hash（前 16 位）
   * 用于生成项目专属存储目录名
   */
  private computePathHash(projectPath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(projectPath.toLowerCase());
    return hash.digest('hex').substring(0, 16).toUpperCase();
  }

  /**
   * 获取项目专属存储目录
   */
  private getProjectStoragePath(projectPath: string): string {
    const hash = this.computePathHash(projectPath);
    return path.join(this.baseStoragePath, hash);
  }

  /**
   * 获取会话文件存储目录
   */
  private getSessionsPath(projectPath: string): string {
    return path.join(this.getProjectStoragePath(projectPath), 'sessions');
  }

  /**
   * 获取索引文件路径
   */
  private getIndexPath(projectPath: string): string {
    return path.join(this.getProjectStoragePath(projectPath), 'sessionIndex.json');
  }

  /**
   * 获取会话文件路径
   */
  private getSessionFilePath(projectPath: string, sessionId: string): string {
    return path.join(this.getSessionsPath(projectPath), `${sessionId}.json`);
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`[SessionStorage] 创建目录失败 ${dirPath}:`, error);
      throw error;
    }
  }

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
    // ⭐⭐⭐ 调试日志：记录传入的参数
    logger.info(`[SessionStorage] 📝 createSessionAsync 被调用`, {
      projectPath,
      projectName,
      title,
      sessionId: sessionId || '(未提供，将生成新ID)',
    });

    const now = new Date().toISOString();
    const generatedId = sessionId || crypto.randomUUID();

    logger.info(`[SessionStorage] 🔑 使用的 Session ID: ${generatedId}`);

    const session: ChatSession = {
      id: generatedId,  // ⭐ 使用传入的 sessionId 或生成新的
      title: title || `${projectName} - ${new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })}`,
      projectPath,
      projectName,
      createdAt: now,
      modifiedAt: now,
      startTime: now,
      duration: 0,
      model: '',
      approval: '',
      cliVersion: '',
      messages: [],
      tokenUsages: [],
      terminalOutput: '',
    };

    logger.info(`[SessionStorage] 📦 创建的 Session 对象`, { id: session.id, title: session.title });

    await this.ensureDirectoryExists(this.getSessionsPath(projectPath));
    await this.saveSessionAsync(projectPath, session);
    await this.updateIndexAsync(projectPath, session);
    this.invalidateCache();

    logger.info(`[SessionStorage] ✅ 新会话创建完成: ${session.id} (${session.title})`);
    return session;
  }

  /**
   * ⭐⭐⭐ 批量保存多条消息（专为导入优化）
   * 一次性保存所有消息，避免重复读写文件
   */
  async saveMessagesInBulkAsync(
    projectPath: string,
    sessionId: string,
    messages: ChatMessage[]
  ): Promise<void> {
    const session = await this.getSessionAsync(projectPath, sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // ⭐ 一次性添加所有消息
    session.messages.push(...messages);

    // ⭐ 收集所有 token 使用量
    for (const message of messages) {
      if (message.tokenUsage) {
        session.tokenUsages.push(message.tokenUsage);
      }
    }

    // ⭐ 更新修改时间（使用最后一条消息的时间戳）
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      session.modifiedAt = new Date(lastMessage.timestamp).toISOString();
    }

    // ⭐ 一次性保存会话文件
    await this.saveSessionAsync(projectPath, session);

    // ⭐ 一次性更新索引
    await this.updateIndexAsync(projectPath, session);

    this.invalidateCache();

    // ⭐ 批量导入模式下跳过实时索引,记录待索引会话
    if (this.isBulkImportMode) {
      this.pendingIndexSessions.set(sessionId, projectPath);
    } else {
      await this.updateSearchIndex(session);
    }

    logger.info(`[SessionStorage] 批量保存 ${messages.length} 条消息到会话 ${sessionId}`);
  }

  /**
   * 获取指定会话
   */
  async getSessionAsync(projectPath: string, sessionId: string): Promise<ChatSession | null> {
    const filePath = this.getSessionFilePath(projectPath, sessionId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as ChatSession;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      logger.error(`[SessionStorage] 读取会话失败 ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 获取项目的所有会话元数据
   */
  async getAllSessionsAsync(projectPath: string): Promise<ChatSessionMetadata[]> {
    const indexPath = this.getIndexPath(projectPath);

    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(content) as ChatSessionMetadata[];
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      logger.error(`[SessionStorage] 读取索引失败:`, error);
      throw error;
    }
  }

  /**
   * 保存消息到会话
   */
  async saveMessageAsync(
    projectPath: string,
    sessionId: string,
    message: ChatMessage
  ): Promise<void> {
    const session = await this.getSessionAsync(projectPath, sessionId);
    if (!session) {
      const hash = this.computePathHash(projectPath);
      const storagePath = this.getSessionFilePath(projectPath, sessionId);
      throw new Error(
        `Session ${sessionId} not found!\n` +
        `Project: ${projectPath}\n` +
        `Storage location: ${storagePath}\n` +
        `(Hash: ${hash})\n` +
        `Note: Sessions are stored in ChatHistory directory, NOT in the project directory.`
      );
    }

    session.messages.push(message);
    session.modifiedAt = new Date().toISOString();

    // 如果是第一条用户消息，生成智能标题
    if (session.messages.length === 1 && message.role === 'user' && message.content) {
      try {
        const smartTitle = await this.generateSmartTitle(message.content, session.projectName);
        if (smartTitle && smartTitle !== session.title) {
          session.title = smartTitle;
          logger.info(`[SessionStorage] 已生成智能标题: ${smartTitle}`);
        }
      } catch (error) {
        logger.warn(`[SessionStorage] 智能标题生成失败，使用默认标题:`, error);
      }
    }

    // 如果有 token 使用量，添加到记录列表
    if (message.tokenUsage) {
      session.tokenUsages.push(message.tokenUsage);
    }

    await this.saveSessionAsync(projectPath, session);
    await this.updateIndexAsync(projectPath, session);
    this.invalidateCache();

    // ⭐ 批量导入模式下跳过实时索引,记录待索引会话
    if (this.isBulkImportMode) {
      this.pendingIndexSessions.set(sessionId, projectPath);
      // logger.info(`[SessionStorage] 批量模式: 延迟索引会话 ${sessionId}`);
    } else {
      // 正常模式: 立即更新搜索索引
      await this.updateSearchIndex(session);
    }

    logger.info(`[SessionStorage] 保存消息到会话 ${sessionId}: ${message.role}`);
  }

  /**
   * 更新会话数据
   */
  async updateSessionAsync(projectPath: string, session: ChatSession): Promise<void> {
    session.modifiedAt = new Date().toISOString();
    await this.saveSessionAsync(projectPath, session);
    await this.updateIndexAsync(projectPath, session);
    this.invalidateCache();

    // ⭐ 更新搜索索引
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
    const session = await this.getSessionAsync(projectPath, sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.title = newTitle;
    session.modifiedAt = new Date().toISOString();

    await this.saveSessionAsync(projectPath, session);
    await this.updateIndexAsync(projectPath, session);
    this.invalidateCache();

    logger.info(`[SessionStorage] 更新会话标题: ${sessionId} -> ${newTitle}`);
  }

  /**
   * 删除会话
   */
  async deleteSessionAsync(projectPath: string, sessionId: string): Promise<void> {
    const filePath = this.getSessionFilePath(projectPath, sessionId);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`[SessionStorage] 删除会话文件失败:`, error);
        throw error;
      }
    }

    // ⭐⭐⭐ 重构：直接从 SQLite 删除，不再操作 sessionIndex.json
    this.searchIndexService.deleteSession(sessionId);
    this.invalidateCache();

    logger.info(`[SessionStorage] 删除会话: ${sessionId}`);
  }

  /**
   * 搜索会话（标题/项目名）
   * @param keyword 搜索关键词
   * @param projectName 项目名称（用于过滤，非项目路径）
   */
  async searchSessionsAsync(keyword: string, projectName?: string): Promise<ChatSessionMetadata[]> {
    // ⭐ 修复：总是获取全局会话，然后按项目名称过滤
    let allSessions = await this.getAllGlobalSessionsAsync();

    // ⭐ 如果提供了项目名称，先过滤项目
    if (projectName) {
      allSessions = allSessions.filter(s => s.projectName === projectName);
      logger.info(`[SessionStorage] 按项目名称过滤: "${projectName}", 结果: ${allSessions.length} 个会话`);
    }

    // 如果没有关键词，返回所有（已过滤项目的）会话
    if (!keyword || keyword.trim() === '') {
      return allSessions;
    }

    // 按关键词搜索标题和项目名
    const lowerKeyword = keyword.toLowerCase();
    const results = allSessions.filter(s =>
      s.title.toLowerCase().includes(lowerKeyword) ||
      s.projectName.toLowerCase().includes(lowerKeyword)
    );

    logger.info(`[SessionStorage] 搜索关键词 "${keyword}" (项目: ${projectName || '全部'}): ${results.length} 个结果`);
    return results;
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
    // ⭐ 修复：总是获取全局会话，然后按项目名称过滤
    let allSessions = await this.getAllGlobalSessionsAsync();

    // ⭐ 如果提供了项目名称，先过滤项目
    if (projectName) {
      allSessions = allSessions.filter(s => s.projectName === projectName);
      logger.info(`[SessionStorage] 消息搜索 - 按项目名称过滤: "${projectName}", ${allSessions.length} 个会话`);
    }

    // 如果没有关键词，返回所有（已过滤项目的）会话
    if (!keyword || keyword.trim() === '') {
      return allSessions;
    }

    const matchingSessions: ChatSessionMetadata[] = [];
    const lowerKeyword = keyword.toLowerCase();

    // 并行搜索所有会话
    const searchPromises = allSessions.map(async (sessionMeta) => {
      try {
        const session = await this.getSessionAsync(sessionMeta.projectPath, sessionMeta.id);
        if (!session) return null;

        const hasMatch = session.messages.some(m =>
          m.content && m.content.toLowerCase().includes(lowerKeyword)
        );

        return hasMatch ? sessionMeta : null;
      } catch (error) {
        logger.error(`[SessionStorage] 搜索会话消息失败 ${sessionMeta.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(searchPromises);
    return results.filter(r => r !== null) as ChatSessionMetadata[];
  }

  /**
   * 获取所有项目的会话元数据列表（全局视图）
   */
  async getAllGlobalSessionsAsync(): Promise<ChatSessionMetadata[]> {
    // ⭐⭐⭐ 重构：直接从 SQLite 读取，不再使用 sessionIndex.json
    logger.info(`[SessionStorage] 从 SQLite 获取全局会话列表...`);

    try {
      const sessions = this.searchIndexService.getAllSessions();
      logger.info(`[SessionStorage] 全局会话获取完成，共 ${sessions.length} 个会话`);
      return sessions;
    } catch (error) {
      logger.error(`[SessionStorage] 从 SQLite 获取全局会话列表失败:`, error);
      return [];
    }
  }

  /**
   * 获取所有项目名称列表
   */
  async getAllProjectNamesAsync(): Promise<string[]> {
    // ⭐⭐⭐ 重构：直接从 SQLite 读取，不再使用 sessionIndex.json
    logger.info(`[SessionStorage] 从 SQLite 获取项目名称列表...`);

    try {
      const projectNames = this.searchIndexService.getAllProjectNames();
      logger.info(`[SessionStorage] 项目名称获取完成，共 ${projectNames.length} 个项目`);
      return projectNames;
    } catch (error) {
      logger.error(`[SessionStorage] 从 SQLite 获取项目名称列表失败:`, error);
      return [];
    }
  }

  /**
   * 获取全局会话统计信息
   */
  async getGlobalSessionStatisticsAsync(): Promise<SessionStatistics> {
    const allSessions = await this.getAllGlobalSessionsAsync();
    const projectNames = await this.getAllProjectNamesAsync();

    const stats: SessionStatistics = {
      projectCount: projectNames.length,
      totalSessions: allSessions.length,
      totalMessages: allSessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalFileSize: allSessions.reduce((sum, s) => sum + s.fileSize, 0),
      totalTokens: allSessions.reduce((sum, s) => sum + s.totalTokens, 0),
    };

    if (allSessions.length > 0) {
      const dates = allSessions.map(s => new Date(s.createdAt).getTime());
      stats.earliestSession = new Date(Math.min(...dates)).toISOString();
      stats.latestSession = new Date(Math.max(...dates.map((_, i) =>
        new Date(allSessions[i].modifiedAt).getTime()
      ))).toISOString();

      // 按项目分组统计
      const projectStats: Record<string, any> = {};
      allSessions.forEach(s => {
        if (!projectStats[s.projectName]) {
          projectStats[s.projectName] = {
            sessionCount: 0,
            messageCount: 0,
            fileSize: 0,
            lastModified: s.modifiedAt,
          };
        }

        projectStats[s.projectName].sessionCount++;
        projectStats[s.projectName].messageCount += s.messageCount;
        projectStats[s.projectName].fileSize += s.fileSize;

        if (new Date(s.modifiedAt) > new Date(projectStats[s.projectName].lastModified)) {
          projectStats[s.projectName].lastModified = s.modifiedAt;
        }
      });

      stats.projectStatistics = projectStats;
    }

    return stats;
  }

  // ========== 私有辅助方法 ==========

  /**
   * 保存会话到文件
   */
  private async saveSessionAsync(projectPath: string, session: ChatSession): Promise<void> {
    const filePath = this.getSessionFilePath(projectPath, session.id);
    await this.ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * ⭐⭐⭐ 更新元数据索引（只更新 SQLite，不再写 sessionIndex.json）
   */
  private async updateIndexAsync(projectPath: string, session: ChatSession): Promise<void> {
    // 计算文件大小
    const filePath = this.getSessionFilePath(projectPath, session.id);
    let fileSize = 0;
    try {
      const stat = await fs.stat(filePath);
      fileSize = stat.size;
    } catch (error) {
      logger.warn(`[SessionStorage] 无法获取文件大小:`, error);
    }

    // ⭐ 生成会话摘要 (现在是异步的)
    const summary = await this.generateSessionSummary(session);

    // 创建新的元数据
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
      fileSize,
      totalTokens: session.tokenUsages.reduce((sum, t) => sum + t.totalTokens, 0),
      inputTokens: session.tokenUsages.reduce((sum, t) => sum + t.inputTokens, 0),
      outputTokens: session.tokenUsages.reduce((sum, t) => sum + t.outputTokens, 0),
      uploadCount: session.messages.reduce((count, m) =>
        count + (m.toolUses?.filter(t => t.name === 'Write' || t.name === 'Edit').length || 0), 0
      ),
      downloadCount: session.messages.reduce((count, m) =>
        count + (m.toolUses?.filter(t => t.name === 'Read' || t.name === 'Grep').length || 0), 0
      ),
      summary, // ⭐ 添加生成的摘要
    };

    // ⭐⭐⭐ 重构：只更新 SQLite，不再写 sessionIndex.json
    // 元数据通过 updateSearchIndex() 自动同步到 SQLite
    logger.info(`[SessionStorage] 元数据已准备，将通过搜索索引服务同步到 SQLite`);
  }

  /**
   * 使缓存失效
   */
  private invalidateCache(): void {
    this.globalSessionsCache = null;
    this.cacheLastUpdated = 0;
  }

  /**
   * 生成智能标题（使用 Claude AI）
   * 注意：这需要调用 ClaudeService，暂时先返回默认标题
   * TODO: 集成 ClaudeService 实现智能标题生成
   */
  private async generateSmartTitle(firstMessage: string, projectName: string): Promise<string> {
    // 简单实现：提取前 20 个字符作为标题
    const maxLength = 30;
    let title = firstMessage.trim().substring(0, maxLength);

    // 如果被截断，添加省略号
    if (firstMessage.length > maxLength) {
      title += '...';
    }

    // 移除换行符
    title = title.replace(/\n/g, ' ');

    return title || `${projectName} - ${new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  /**
   * ⭐ 生成会话摘要（优先使用 AI，降级到简单提取）
   * 策略：
   * 1. 尝试使用 OpenRouter AI 生成智能摘要（推荐）
   * 2. 如果 AI 失败，降级到简单文本提取：
   *    - 提取所有 assistant 消息
   *    - 优先使用最后一条长消息（>300字符）
   *    - 智能截断，保留完整句子
   */
  private async generateSessionSummary(session: ChatSession): Promise<string> {
    // ⭐ 直接使用本地文本提取（不依赖 AI，OpenRouter 免费模型不稳定）
    logger.info(`[SessionStorage] 使用本地方案生成摘要: ${session.id}`);

    // 过滤出所有 assistant 消息
    const assistantMessages = session.messages
      .filter(m => m.role === 'assistant' && m.content && typeof m.content === 'string')
      .reverse(); // 倒序，优先处理最新的消息

    if (assistantMessages.length === 0) {
      // 如果没有 assistant 消息，尝试使用 user 消息
      const userMessages = session.messages.filter(m => m.role === 'user' && m.content);
      if (userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1].content as string;
        return this.truncateToSummary(lastUserMessage, 200);
      }
      return `包含 ${session.messages.length} 条消息`;
    }

    // 查找第一条长消息（>300字符）
    const longMessage = assistantMessages.find(m => {
      const content = m.content as string;
      return content.length > 300;
    });

    if (longMessage) {
      // 使用长消息生成摘要（取前 400 字符）
      return this.truncateToSummary(longMessage.content as string, 400);
    }

    // 如果没有长消息，使用最后一条 assistant 消息
    const lastMessage = assistantMessages[0].content as string;
    return this.truncateToSummary(lastMessage, 200);
  }

  /**
   * ⭐ 智能截断文本为摘要（保留完整句子）
   */
  private truncateToSummary(text: string, maxLength: number): string {
    // 移除多余的空白字符
    let cleanText = text.trim().replace(/\s+/g, ' ');

    // 如果文本已经够短，直接返回
    if (cleanText.length <= maxLength) {
      return cleanText;
    }

    // 截取到最大长度
    const truncated = cleanText.substring(0, maxLength);

    // 尝试在句子结束处截断（中文句号、英文句号、问号、感叹号、换行符）
    const sentenceEndings = [
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('\n'),
    ];

    const lastSentenceEnd = Math.max(...sentenceEndings);

    if (lastSentenceEnd > maxLength * 0.6) {
      // 如果找到的句子结束位置在合理范围内（60%以上），使用它
      return cleanText.substring(0, lastSentenceEnd + 1).trim() + ' [...]';
    }

    // 否则直接截断并添加省略号
    return truncated.trim() + '...';
  }

  /**
   * ⭐ 更新搜索索引（私有辅助方法）
   */
  private async updateSearchIndex(session: ChatSession): Promise<void> {
    try {
      // 提取所有消息内容
      const messages = session.messages
        .filter((m) => m.content && typeof m.content === 'string')
        .map((m) => m.content as string);

      // ⭐ 生成会话摘要 (现在是异步的)
      const summary = await this.generateSessionSummary(session);

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
        summary, // ⭐ 添加生成的摘要
      };

      // 更新索引
      this.searchIndexService.indexSession(metadata, messages);
    } catch (error) {
      logger.error(`[SessionStorage] 更新搜索索引失败:`, error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * ⭐ 使用搜索索引进行全文搜索（公共接口）
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

  /**
   * ⭐ 重建所有会话的搜索索引（用于初始化或索引损坏时）
   */
  public async rebuildSearchIndexAsync(): Promise<void> {
    logger.info('[SessionStorage] 开始重建搜索索引...');

    try {
      // 清空现有索引
      this.searchIndexService.clearAll();

      // 获取所有会话元数据
      const allSessions = await this.getAllGlobalSessionsAsync();

      const indexData: Array<{ session: ChatSessionMetadata; messages: string[] }> = [];

      // 读取每个会话的完整数据
      for (const sessionMeta of allSessions) {
        try {
          const session = await this.getSessionAsync(sessionMeta.projectPath, sessionMeta.id);
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

  /**
   * ⭐⭐⭐ 清理所有项目的 SQLite 搜索索引
   * ⚠️ 注意：仅清理 SQLite 搜索索引，保留 JSONL 文件
   *
   * 清理内容：
   * - SQLite FTS5 搜索索引 (search_index.db)
   * - 内存缓存
   *
   * 保留内容：
   * - JSONL 会话文件 (ChatHistory/{hash}/sessions/*.json)
   * - 会话索引文件 (ChatHistory/{hash}/sessionIndex.json)
   */
  public async clearAllHistoryAsync(): Promise<{
    success: boolean;
    deletedProjects: number;
    deletedSessions: number;
    clearedSQLite: boolean;
    errors: string[];
  }> {
    logger.warn('[SessionStorage] ⚠️ 开始清理 SQLite 数据...');
    logger.info('[SessionStorage] 📝 注意：JSONL 文件将被保留');

    const result = {
      success: false,
      deletedProjects: 0,
      deletedSessions: 0,
      clearedSQLite: false,
      errors: [] as string[],
    };

    try {
      // 1. 统计项目和会话数量（用于反馈）
      const allSessions = await this.getAllGlobalSessionsAsync();
      const projectNames = await this.getAllProjectNamesAsync();

      result.deletedProjects = projectNames.length;
      result.deletedSessions = allSessions.length;

      logger.info(`[SessionStorage] 📊 统计: ${result.deletedProjects} 个项目，${result.deletedSessions} 个会话`);

      // 2. ⭐⭐⭐ 清空 SQLite（唯一数据源）
      try {
        this.searchIndexService.clearAll();
        result.clearedSQLite = true;
        logger.info('[SessionStorage] ✅ SQLite 数据已清空');
      } catch (error) {
        const errorMsg = `清空 SQLite 失败: ${error}`;
        result.errors.push(errorMsg);
        logger.error(`[SessionStorage] ❌ ${errorMsg}`);
      }

      // 3. 清空内存缓存
      this.invalidateCache();
      logger.info('[SessionStorage] ✅ 内存缓存已清空');

      result.success = true;
      logger.info(`[SessionStorage] 🎉 数据清理完成`);
      logger.info(`[SessionStorage] 📁 JSONL 原始文件已保留`);

      return result;
    } catch (error) {
      const errorMsg = `清理失败: ${error}`;
      result.errors.push(errorMsg);
      logger.error(`[SessionStorage] ❌ ${errorMsg}`);
      return result;
    }
  }

  /**
   * ⭐ 启用批量导入模式 (禁用实时索引)
   * 用于大量会话导入时提升性能
   */
  enableBulkImportMode(): void {
    this.isBulkImportMode = true;
    this.pendingIndexSessions.clear();
    logger.info(`[SessionStorage] ✅ 批量导入模式已启用 (实时索引已禁用)`);
  }

  /**
   * ⭐ 禁用批量导入模式并执行统一索引
   * 导入完成后调用,对所有待索引会话统一建立索引
   */
  async disableBulkImportModeAndIndex(): Promise<void> {
    this.isBulkImportMode = false;

    const sessionCount = this.pendingIndexSessions.size;
    if (sessionCount === 0) {
      logger.info(`[SessionStorage] ✅ 批量导入模式已禁用 (无待索引会话)`);
      return;
    }

    logger.info(`[SessionStorage] 🔄 开始批量索引 ${sessionCount} 个会话...`);

    let indexedCount = 0;
    let failedCount = 0;

    // ⭐ 迭代 Map: [sessionId, sessionProjectPath]
    for (const [sessionId, sessionProjectPath] of this.pendingIndexSessions) {
      try {
        // ⭐ 使用会话对应的项目路径，而不是传入的 projectPath
        const session = await this.getSessionAsync(sessionProjectPath, sessionId);
        if (session) {
          await this.updateSearchIndex(session);
          indexedCount++;
        }
      } catch (error) {
        failedCount++;
        logger.error(`[SessionStorage] ❌ 索引会话失败: ${sessionId}`, error);
      }
    }

    this.pendingIndexSessions.clear();

    logger.info(
      `[SessionStorage] ✅ 批量索引完成: 成功 ${indexedCount}, 失败 ${failedCount}`
    );
  }
}
