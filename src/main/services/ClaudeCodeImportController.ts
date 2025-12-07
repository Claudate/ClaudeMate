/**
 * Claude Code Import Controller
 * 协调 Claude Code 数据导入到 ClaudeMate 的主控制器
 *
 * 职责:
 * 1. 调用 ClaudeCodeImportService 解析数据
 * 2. 检测重复会话
 * 3. 调用 SessionHistoryService 写入数据库
 * 4. 提供导入进度反馈
 */

import { ClaudeCodeImportService, ClaudeCodeSession, ClaudeCodeDetectionResult } from './ClaudeCodeImportService';
import { SessionStorageService } from './SessionStorageService';
import { Logger } from '../utils/Logger';

const logger = Logger.getInstance('ClaudeCodeImportController');

export interface ImportProgress {
  currentProject: string;
  currentSession: number;
  totalSessions: number;
  importedSessions: number;
  skippedSessions: number;
  failedSessions: number;
}

export interface ImportResult {
  success: boolean;
  totalProjects: number;
  totalSessions: number;
  importedSessions: number;
  skippedSessions: number;
  failedSessions: number;
  errors: string[];
}

export class ClaudeCodeImportController {
  private importService: ClaudeCodeImportService;
  private sessionStorage: SessionStorageService;

  constructor() {
    this.importService = new ClaudeCodeImportService();
    this.sessionStorage = new SessionStorageService();
  }

  /**
   * 检测 Claude Code 数据
   */
  async detectData(): Promise<ClaudeCodeDetectionResult> {
    return this.importService.detectClaudeCodeData();
  }

  /**
   * 导入所有 Claude Code 会话
   * @param onProgress 进度回调函数
   */
  async importAll(
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    // ⭐ 只在开始时打印一次
    // logger.info('🚀 开始导入 Claude Code 数据...');

    const result: ImportResult = {
      success: false,
      totalProjects: 0,
      totalSessions: 0,
      importedSessions: 0,
      skippedSessions: 0,
      failedSessions: 0,
      errors: [],
    };

    try {
      // 1. 检测数据
      const detection = await this.importService.detectClaudeCodeData();

      if (!detection.exists || detection.totalSessions === 0) {
        logger.warn('⚠️ 未检测到 Claude Code 数据');
        result.success = true; // 没有数据也算成功
        return result;
      }

      result.totalProjects = detection.projects.length;
      result.totalSessions = detection.totalSessions;

      // logger.info(`📊 检测到 ${result.totalProjects} 个项目，${result.totalSessions} 个会话`);

      // ⭐ 启用批量导入模式 (禁用实时索引,提升性能)
      this.sessionStorage.enableBulkImportMode();

      // 2. 逐项目导入
      let sessionCounter = 0;
      const projectPaths = new Set<string>(); // 记录所有导入的项目路径

      for (const project of detection.projects) {
        // 获取项目的所有会话
        const sessions = await this.importService.getProjectSessions(project.encodedName);

        for (const session of sessions) {
          sessionCounter++;

          // 记录项目路径
          projectPaths.add(session.projectPath);

          // 发送进度
          if (onProgress) {
            onProgress({
              currentProject: project.projectName,
              currentSession: sessionCounter,
              totalSessions: result.totalSessions,
              importedSessions: result.importedSessions,
              skippedSessions: result.skippedSessions,
              failedSessions: result.failedSessions,
            });
          }

          try {
            // 导入单个会话
            const imported = await this.importSession(session);

            if (imported) {
              result.importedSessions++;
              // ⭐ 不打印成功信息
              // logger.info(`✅ [${sessionCounter}/${result.totalSessions}] 导入成功: ${session.title}`);
            } else {
              result.skippedSessions++;
              // ⭐ 不打印跳过信息
              // logger.info(`⏭️ [${sessionCounter}/${result.totalSessions}] 跳过: ${session.title}`);
            }
          } catch (error) {
            result.failedSessions++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorMsg = `导入失败: ${session.title} - ${errorMessage}`;
            result.errors.push(errorMsg);

            // ⭐ 打印详细的错误信息
            logger.error(`❌ [${sessionCounter}/${result.totalSessions}] 导入失败`);
            logger.error(`  会话: ${session.title}`);
            logger.error(`  项目: ${session.projectPath}`);
            logger.error(`  错误: ${errorMessage}`);
            if (error instanceof Error && error.stack) {
              logger.error(`  堆栈: ${error.stack}`);
            }
          }
        }
      }

      // ⭐ 导入完成后,统一建立搜索索引（一次性处理所有会话）
      logger.info(`[ClaudeCodeImport] 📊 导入完成,开始批量索引...`);
      await this.sessionStorage.disableBulkImportModeAndIndex();

      result.success = true;

      // ⭐ 只在有失败时打印汇总
      if (result.failedSessions > 0) {
        logger.error('❌ 导入完成，存在失败:', {
          imported: result.importedSessions,
          skipped: result.skippedSessions,
          failed: result.failedSessions,
          errors: result.errors,
        });
      }

      return result;
    } catch (error) {
      result.errors.push(`导入过程失败: ${error}`);
      logger.error('❌ 导入过程失败:', error);
      return result;
    }
  }

  /**
   * 导入单个会话
   * @returns true = 导入成功, false = 跳过（已存在）
   */
  private async importSession(session: ClaudeCodeSession): Promise<boolean> {
    // 1. 检查会话是否已存在
    const existingSession = await this.sessionStorage.getSessionAsync(session.projectPath, session.sessionId);

    if (existingSession) {
      // ⭐⭐⭐ 跳过重复会话（已存在且消息数量相同）
      const existingMessageCount = existingSession.messages?.length || 0;
      const newMessageCount = session.messages.length;

      if (newMessageCount === existingMessageCount) {
        // 消息数量相同，跳过
        return false;
      }

      // ⭐⭐⭐ 消息数量不同时，强制覆盖（可能是解析逻辑更新导致的差异）
      logger.warn(`[ClaudeCodeImport] ⚠️ 会话消息数量不一致，强制覆盖:`);
      logger.warn(`  会话: ${session.title}`);
      logger.warn(`  旧消息数: ${existingMessageCount}, 新消息数: ${newMessageCount}`);

      // 删除旧会话
      await this.sessionStorage.deleteSessionAsync(session.projectPath, session.sessionId);

      // 继续创建新会话（下面的代码会执行）
    }


    try {
      // 创建会话记录（使用指定的 sessionId）
      const newSession = await this.sessionStorage.createSessionAsync(
        session.projectPath,
        session.projectName,
        session.title,
        session.sessionId  // ⭐ 传入 Claude Code 的原始 sessionId
      );

      // ⭐⭐⭐ 使用批量保存方法，一次性保存所有消息
      const messagesToSave = session.messages.map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp, // 保持原始的毫秒时间戳
        tokenUsage: message.tokenUsage,
        toolUses: [], // Claude Code 数据中没有详细的工具调用信息
      }));

      await this.sessionStorage.saveMessagesInBulkAsync(
        session.projectPath,
        session.sessionId,
        messagesToSave
      );

      // ⭐ 成功不打印
      // logger.info(`✅ 会话创建成功: ${session.title}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // ⭐ 打印详细的错误信息
      logger.error(`❌ 创建会话失败`);
      logger.error(`  会话: ${session.title}`);
      logger.error(`  项目: ${session.projectPath}`);
      logger.error(`  SessionID: ${session.sessionId}`);
      logger.error(`  消息数量: ${session.messages.length}`);
      logger.error(`  错误: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        logger.error(`  堆栈: ${error.stack}`);
      }

      throw error;
    }
  }

  /**
   * 预览导入（不实际写入数据库）
   */
  async previewImport(): Promise<{
    projects: Array<{
      name: string;
      path: string;
      sessionCount: number;
      totalMessages: number;
      sessions: Array<{
        title: string;
        messageCount: number;
        createdAt: number;
      }>;
    }>;
  }> {
    const detection = await this.importService.detectClaudeCodeData();

    if (!detection.exists) {
      return { projects: [] };
    }

    const projects = [];

    for (const project of detection.projects) {
      const sessions = await this.importService.getProjectSessions(project.encodedName);

      const sessionPreviews = sessions.map(s => ({
        title: s.title,
        messageCount: s.messages.length,
        createdAt: s.createdAt,
      }));

      const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

      projects.push({
        name: project.projectName,
        path: project.decodedPath,
        sessionCount: sessions.length,
        totalMessages,
        sessions: sessionPreviews,
      });
    }

    return { projects };
  }
}
