/**
 * SessionIndexer - 会话索引管理器
 * 职责：维护 sessionIndex.json 快速索引文件
 */

import * as fs from 'fs/promises';
import { BaseStorageModule } from './BaseStorageModule';
import { ChatSession, ChatSessionMetadata } from '@shared/types/domain.types';

export class SessionIndexer extends BaseStorageModule {
  private globalSessionsCache: ChatSessionMetadata[] | null = null;
  private cacheLastUpdated: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

  constructor(baseStoragePath: string) {
    super('SessionIndexer', baseStoragePath);
  }

  /**
   * 获取项目的所有会话元数据
   */
  async getAllSessionsAsync(projectPath: string): Promise<ChatSessionMetadata[]> {
    const indexPath = this.getIndexPath(projectPath);
    const index = await this.readJsonFile<ChatSessionMetadata[]>(indexPath);
    return index || [];
  }

  /**
   * 更新索引
   */
  async updateIndexAsync(
    projectPath: string,
    session: ChatSession,
    summary: string
  ): Promise<void> {
    const index = await this.getAllSessionsAsync(projectPath);

    // 移除旧的索引项
    const filtered = index.filter(s => s.id !== session.id);

    // 计算文件大小
    const filePath = this.getSessionFilePath(projectPath, session.id);
    let fileSize = 0;
    try {
      const stat = await fs.stat(filePath);
      fileSize = stat.size;
    } catch (error) {
      this.logger.warn(`无法获取文件大小:`, error);
    }

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
      summary,
    };

    // 插入到列表开头（最新的在最前面）
    filtered.unshift(metadata);

    await this.saveIndexAsync(projectPath, filtered);
  }

  /**
   * 从索引中移除会话
   */
  async removeFromIndexAsync(projectPath: string, sessionId: string): Promise<void> {
    const index = await this.getAllSessionsAsync(projectPath);
    const newIndex = index.filter(s => s.id !== sessionId);
    await this.saveIndexAsync(projectPath, newIndex);
  }

  /**
   * 保存索引到文件
   */
  async saveIndexAsync(projectPath: string, index: ChatSessionMetadata[]): Promise<void> {
    const indexPath = this.getIndexPath(projectPath);
    await this.writeJsonFile(indexPath, index);
  }

  /**
   * 获取所有项目的会话元数据列表（全局视图）
   */
  async getAllGlobalSessionsAsync(): Promise<ChatSessionMetadata[]> {
    // 检查缓存
    const now = Date.now();
    if (this.globalSessionsCache && (now - this.cacheLastUpdated) < this.CACHE_TTL) {
      this.logger.info(`使用缓存数据，共 ${this.globalSessionsCache.length} 个会话`);
      return this.globalSessionsCache;
    }

    const allSessions: ChatSessionMetadata[] = [];

    try {
      // 确保基础目录存在
      await this.ensureDirectoryExists(this.baseStoragePath);

      // 遍历所有项目目录
      const projectDirs = await fs.readdir(this.baseStoragePath);

      for (const projectDir of projectDirs) {
        const path = await import('path');
        const projectPath = path.join(this.baseStoragePath, projectDir);
        const stat = await fs.stat(projectPath);

        if (!stat.isDirectory()) continue;

        const indexPath = path.join(projectPath, 'sessionIndex.json');

        try {
          const content = await fs.readFile(indexPath, 'utf-8');
          const sessions = JSON.parse(content) as ChatSessionMetadata[];
          allSessions.push(...sessions);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this.logger.error(`读取项目索引失败 ${projectDir}:`, error);
          }
        }
      }

      // 按修改时间降序排序
      const sorted = allSessions.sort((a, b) =>
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );

      // 更新缓存
      this.globalSessionsCache = sorted;
      this.cacheLastUpdated = now;

      this.logger.info(`全局会话获取完成，共 ${sorted.length} 个会话`);
      return sorted;
    } catch (error) {
      this.logger.error(`获取全局会话列表失败:`, error);
      return [];
    }
  }

  /**
   * 获取所有项目名称列表
   */
  async getAllProjectNamesAsync(): Promise<string[]> {
    try {
      await this.ensureDirectoryExists(this.baseStoragePath);

      const projectNames = new Set<string>();
      const projectDirs = await fs.readdir(this.baseStoragePath);
      const path = await import('path');

      for (const projectDir of projectDirs) {
        const indexPath = path.join(this.baseStoragePath, projectDir, 'sessionIndex.json');

        try {
          const content = await fs.readFile(indexPath, 'utf-8');
          const sessions = JSON.parse(content) as ChatSessionMetadata[];

          sessions.forEach(s => {
            if (s.projectName) {
              projectNames.add(s.projectName);
            }
          });
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this.logger.error(`读取项目名称失败:`, error);
          }
        }
      }

      return Array.from(projectNames).sort();
    } catch (error) {
      this.logger.error(`获取项目名称列表失败:`, error);
      return [];
    }
  }

  /**
   * 使缓存失效
   */
  invalidateCache(): void {
    this.globalSessionsCache = null;
    this.cacheLastUpdated = 0;
  }
}
