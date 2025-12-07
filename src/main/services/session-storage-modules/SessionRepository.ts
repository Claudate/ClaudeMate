/**
 * SessionRepository - 会话数据仓库
 * 职责：会话的 CRUD 操作（创建、读取、更新、删除）
 */

import * as crypto from 'crypto';
import { BaseStorageModule } from './BaseStorageModule';
import { ChatSession, ChatMessage } from '@shared/types/domain.types';

export class SessionRepository extends BaseStorageModule {
  constructor(baseStoragePath: string) {
    super('SessionRepository', baseStoragePath);
  }

  /**
   * 创建新会话
   */
  async createSessionAsync(
    projectPath: string,
    projectName: string,
    title?: string,
    sessionId?: string
  ): Promise<ChatSession> {
    this.logger.info(`📝 createSessionAsync 被调用`, {
      projectPath,
      projectName,
      title,
      sessionId: sessionId || '(未提供，将生成新ID)',
    });

    const now = new Date().toISOString();
    const generatedId = sessionId || crypto.randomUUID();

    this.logger.info(`🔑 使用的 Session ID: ${generatedId}`);

    const session: ChatSession = {
      id: generatedId,
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

    this.logger.info(`📦 创建的 Session 对象`, { id: session.id, title: session.title });

    await this.ensureDirectoryExists(this.getSessionsPath(projectPath));
    await this.saveSessionAsync(projectPath, session);

    this.logger.info(`✅ 新会话创建完成: ${session.id} (${session.title})`);
    return session;
  }

  /**
   * 获取指定会话
   */
  async getSessionAsync(projectPath: string, sessionId: string): Promise<ChatSession | null> {
    const filePath = this.getSessionFilePath(projectPath, sessionId);
    return this.readJsonFile<ChatSession>(filePath);
  }

  /**
   * 保存会话到文件
   */
  async saveSessionAsync(projectPath: string, session: ChatSession): Promise<void> {
    const filePath = this.getSessionFilePath(projectPath, session.id);
    await this.writeJsonFile(filePath, session);
  }

  /**
   * 更新会话数据
   */
  async updateSessionAsync(projectPath: string, session: ChatSession): Promise<void> {
    session.modifiedAt = new Date().toISOString();
    await this.saveSessionAsync(projectPath, session);
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
    this.logger.info(`更新会话标题: ${sessionId} -> ${newTitle}`);
  }

  /**
   * 删除会话文件
   */
  async deleteSessionFileAsync(projectPath: string, sessionId: string): Promise<void> {
    const filePath = this.getSessionFilePath(projectPath, sessionId);

    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
      this.logger.info(`删除会话文件: ${sessionId}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`删除会话文件失败:`, error);
        throw error;
      }
    }
  }

  /**
   * 保存消息到会话
   */
  async saveMessageAsync(
    projectPath: string,
    sessionId: string,
    message: ChatMessage
  ): Promise<ChatSession> {
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

    // 如果有 token 使用量，添加到记录列表
    if (message.tokenUsage) {
      session.tokenUsages.push(message.tokenUsage);
    }

    await this.saveSessionAsync(projectPath, session);
    this.logger.info(`保存消息到会话 ${sessionId}: ${message.role}`);

    return session;
  }
}
