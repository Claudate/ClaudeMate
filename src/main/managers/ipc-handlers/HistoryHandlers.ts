/**
 * History Handlers - 聊天历史管理相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import {
  IPCChannels,
  IPCChannel,
  HistoryCreateSessionSchema,
  HistoryGetSessionSchema,
  HistoryDeleteSessionSchema,
  HistorySearchSessionsSchema,
  HistoryUpdateTitleSchema,
} from '../../../shared/types/ipc.types';

export class HistoryHandlers extends BaseHandler {
  private sessionStorage: any;
  private historyService: any;
  private openRouterService: any;

  constructor() {
    super('History');
    const { SessionStorageService } = require('../../services/SessionStorageService');
    const { SessionHistoryService } = require('../../services/SessionHistoryService');
    const { OpenRouterService } = require('../../services/OpenRouterService');

    this.sessionStorage = new SessionStorageService();
    this.historyService = SessionHistoryService.getInstance();
    this.openRouterService = OpenRouterService.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    // Session CRUD
    this.registerSessionOperations(registerFn);

    // 搜索功能
    this.registerSearchOperations(registerFn);

    // JSONL 备份
    this.registerBackupOperations(registerFn);

    // AI 功能
    this.registerAIOperations(registerFn);

    this.logger.info('Chat History IPC handlers registered (JSONL backup only, IndexedDB in renderer)');
  }

  private registerSessionOperations(registerFn: any): void {
    // 创建会话
    registerFn(
      IPCChannels.HISTORY_CREATE_SESSION,
      async (data: { projectPath: string; projectName: string; title?: string; sessionId?: string }) => {
        this.logger.info(`[History] 📨 HISTORY_CREATE_SESSION 收到请求`, {
          projectPath: data.projectPath,
          projectName: data.projectName,
          title: data.title,
          sessionId: data.sessionId || '(未提供)',
        });

        const result = await this.sessionStorage.createSessionAsync(
          data.projectPath,
          data.projectName,
          data.title,
          data.sessionId
        );

        this.logger.info(`[History] 📤 HISTORY_CREATE_SESSION 返回结果`, {
          id: result.id,
          title: result.title,
        });

        return result;
      },
      HistoryCreateSessionSchema
    );

    // 获取会话
    registerFn(
      IPCChannels.HISTORY_GET_SESSION,
      async (data: { projectPath: string; sessionId: string }) => {
        return await this.sessionStorage.getSessionAsync(data.projectPath, data.sessionId);
      },
      HistoryGetSessionSchema
    );

    // 获取所有会话
    registerFn(IPCChannels.HISTORY_GET_ALL_SESSIONS, async () => {
      const sessions = await this.sessionStorage.getAllGlobalSessionsAsync();
      return { sessions };
    });

    // 保存消息
    registerFn(
      IPCChannels.HISTORY_SAVE_MESSAGE,
      async (data: { projectPath: string; sessionId: string; message: any }) => {
        await this.sessionStorage.saveMessageAsync(
          data.projectPath,
          data.sessionId,
          data.message
        );
        return { success: true };
      }
    );

    // 更新会话
    registerFn(
      IPCChannels.HISTORY_UPDATE_SESSION,
      async (data: { projectPath: string; session: any }) => {
        await this.sessionStorage.updateSessionAsync(data.projectPath, data.session);
        return { success: true };
      }
    );

    // 删除会话
    registerFn(
      IPCChannels.HISTORY_DELETE_SESSION,
      async (data: { projectPath: string; sessionId: string }) => {
        await this.sessionStorage.deleteSessionAsync(data.projectPath, data.sessionId);
        return { success: true };
      },
      HistoryDeleteSessionSchema
    );

    // 更新标题
    registerFn(
      IPCChannels.HISTORY_UPDATE_TITLE,
      async (data: { projectPath: string; sessionId: string; newTitle: string }) => {
        await this.sessionStorage.updateSessionTitleAsync(
          data.projectPath,
          data.sessionId,
          data.newTitle
        );
        return { success: true };
      },
      HistoryUpdateTitleSchema
    );

    // 获取项目名称列表
    registerFn(IPCChannels.HISTORY_GET_PROJECT_NAMES, async () => {
      return await this.sessionStorage.getAllProjectNamesAsync();
    });

    // 获取统计信息
    registerFn(IPCChannels.HISTORY_GET_STATISTICS, async () => {
      return await this.sessionStorage.getGlobalSessionStatisticsAsync();
    });

    // ⭐⭐⭐ 清空所有项目的历史数据
    registerFn(IPCChannels.HISTORY_CLEAR_ALL_PROJECTS, async () => {
      this.logger.warn('[History] ⚠️ 收到清空所有历史数据请求...');
      const result = await this.sessionStorage.clearAllHistoryAsync();
      this.logger.info(`[History] 清理结果: 删除 ${result.deletedProjects} 个项目, ${result.deletedSessions} 个会话`);
      return result;
    });
  }

  private registerSearchOperations(registerFn: any): void {
    // 搜索会话
    registerFn(
      IPCChannels.HISTORY_SEARCH_SESSIONS,
      async (data: { keyword?: string; projectPath?: string }) => {
        return await this.sessionStorage.searchSessionsAsync(
          data.keyword || '',
          data.projectPath
        );
      },
      HistorySearchSessionsSchema
    );

    // 搜索消息内容
    registerFn(
      IPCChannels.HISTORY_SEARCH_MESSAGES,
      async (data: { keyword: string; projectPath?: string }) => {
        return await this.sessionStorage.searchSessionsByMessageContentAsync(
          data.keyword,
          data.projectPath
        );
      }
    );

    // ⭐⭐⭐ SQLite FTS5 全文搜索
    registerFn(IPCChannels.HISTORY_SEARCH_WITH_FTS5, async (data: {
      query: string;
      limit?: number;
      offset?: number;
      projectPath?: string;
      sortBy?: 'relevance' | 'time';
    }) => {
      const results = this.sessionStorage.searchWithIndex(data.query, {
        limit: data.limit,
        offset: data.offset,
        projectPath: data.projectPath,
        sortBy: data.sortBy,
      });
      return { results };
    });

    // ⭐⭐⭐ 重建搜索索引
    registerFn(IPCChannels.HISTORY_REBUILD_SEARCH_INDEX, async () => {
      await this.sessionStorage.rebuildSearchIndexAsync();
      return { success: true };
    });
  }

  private registerBackupOperations(registerFn: any): void {
    // 从 JSONL 文件加载会话历史
    registerFn('history:load-from-jsonl' as IPCChannel, async (data: { sessionId: string }) => {
      return await this.historyService.getSessionMessages(data.sessionId);
    });
  }

  private registerAIOperations(registerFn: any): void {
    // ⭐⭐⭐ OpenRouter AI - 生成会话标题
    registerFn('ai:generate-title' as IPCChannel, async (data: { firstMessage: string; maxLength?: number }) => {
      try {
        const title = await this.openRouterService.generateSessionTitle(
          data.firstMessage,
          data.maxLength || 20
        );
        return { title };
      } catch (error) {
        this.logger.error('[History] AI 标题生成失败:', error);
        throw error;
      }
    });
  }
}
