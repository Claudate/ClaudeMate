/**
 * History Store
 * 管理聊天历史记录的状态
 * 参照 WPF 的 ChatHistoryListViewModel
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ChatSessionMetadata, ChatSession, SessionStatistics } from '@shared/types/domain.types';
import { IPCChannels } from '@shared/types/ipc.types';
import { useTerminalStore, SessionMetadata, SessionData } from './terminalStore';

interface HistoryState {
  // 数据
  sessions: ChatSessionMetadata[];
  selectedSession: ChatSessionMetadata | null;
  selectedSessionFull: ChatSession | null;  // ⭐ 新增：完整会话数据（包含消息）
  statistics: SessionStatistics | null;
  projectNames: string[];

  // UI 状态
  isLoading: boolean;
  isLoadingMessages: boolean;  // ⭐ 新增：消息加载状态
  error: string | null;
  searchQuery: string;
  selectedProjectFilter: string | null;
  dateFilter: 'all' | 'today' | 'week' | 'month';

  // Actions
  loadSessions: () => Promise<void>;
  loadStatistics: () => Promise<void>;
  loadProjectNames: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;  // ⭐ 改为异步，加载完整数据
  deleteSession: (projectPath: string, sessionId: string) => Promise<void>;
  searchSessions: (keyword: string) => Promise<void>;
  searchMessageContent: (keyword: string) => Promise<void>;
  updateSessionTitle: (projectPath: string, sessionId: string, newTitle: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setProjectFilter: (projectName: string | null) => void;
  setDateFilter: (filter: 'all' | 'today' | 'week' | 'month') => void;
  clearFilters: () => void;

  // ⭐⭐⭐ SQLite FTS5 全文搜索
  searchWithFTS5: (query: string, options?: {
    limit?: number;
    offset?: number;
    projectPath?: string;
    sortBy?: 'relevance' | 'time';
  }) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()(
  immer((set, get) => ({
    // Initial state
    sessions: [],
    selectedSession: null,
    selectedSessionFull: null,  // ⭐ 新增
    statistics: null,
    projectNames: [],
    isLoading: false,
    isLoadingMessages: false,  // ⭐ 新增
    error: null,
    searchQuery: '',
    selectedProjectFilter: null,
    dateFilter: 'all',

    /**
     * 加载所有会话（全局）
     * ⭐ 直接从 terminalStore (localStorage) 读取，不通过 IPC
     */
    loadSessions: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // ⭐⭐⭐ 通过 IPC 从主进程的 SessionStorageService 获取全局会话
        const result = await window.electronAPI.invoke(IPCChannels.HISTORY_GET_ALL_SESSIONS);

        if (!result || !result.sessions || result.sessions.length === 0) {
          console.warn('[HistoryStore] 没有会话数据');
          set(() => ({
            sessions: [],
            filteredSessions: [],
            isLoading: false,
          }));
          return;
        }

        // 直接使用返回的会话数据
        const allSessions: ChatSessionMetadata[] = result.sessions.map((session: SessionMetadata) => ({
          id: session.id,
          title: session.title,
          projectName: session.projectName,
          timestamp: new Date(session.modifiedAt).toISOString(),
          messageCount: session.messageCount,
          totalTokens: session.totalTokens,
          model: session.model,
          cliVersion: session.cliVersion,
          duration: session.duration,
          approvalStatus: session.approvalStatus,
          projectPath: session.projectPath,
          modifiedAt: session.modifiedAt,
          createdAt: session.createdAt,
          fileSize: session.fileSize || 0,
          uploadCount: session.uploadCount || 0,
          downloadCount: session.downloadCount || 0,
          summary: session.summary || '',
        }));

        // 按修改时间降序排序
        allSessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // ⭐⭐⭐ 根据项目过滤会话
        let filteredSessions = allSessions;
        const { selectedProjectFilter } = get();

        if (selectedProjectFilter) {
          filteredSessions = allSessions.filter(
            (session) => session.projectName === selectedProjectFilter
          );
          console.log(
            `[HistoryStore] 过滤项目 "${selectedProjectFilter}": ${filteredSessions.length}/${allSessions.length} 个会话`
          );
        }

        set((state) => {
          state.sessions = filteredSessions;
          state.isLoading = false;
        });

        console.log(
          `[HistoryStore] 从 SessionStorageService 加载了 ${filteredSessions.length} 个会话` +
            (selectedProjectFilter ? ` (项目: ${selectedProjectFilter})` : ` (总共 ${allSessions.length} 个)`)
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
        set((state) => {
          state.error = errorMessage;
          state.isLoading = false;
        });
        console.error('[HistoryStore] 加载会话失败:', error);
      }
    },

    /**
     * 加载统计信息
     */
    loadStatistics: async () => {
      try {
        const stats = await window.electronAPI.invoke<SessionStatistics>(
          IPCChannels.HISTORY_GET_STATISTICS
        );

        set((state) => {
          state.statistics = stats;
        });

        console.log('[HistoryStore] 统计信息已加载:', stats);
      } catch (error) {
        console.error('[HistoryStore] 加载统计信息失败:', error);
      }
    },

    /**
     * 加载所有项目名称
     */
    loadProjectNames: async () => {
      try {
        const names = await window.electronAPI.invoke<string[]>(
          IPCChannels.HISTORY_GET_PROJECT_NAMES
        );

        set((state) => {
          state.projectNames = names || [];
        });

        console.log(`[HistoryStore] 加载了 ${names?.length || 0} 个项目名称`);
      } catch (error) {
        console.error('[HistoryStore] 加载项目名称失败:', error);
      }
    },

    /**
     * 选择会话（加载完整数据，包含消息）
     * ⭐ 优化策略：优先 IndexedDB，失败则回退到 IPC
     */
    selectSession: async (sessionId: string) => {
      console.log(`[HistoryStore] 🔵 selectSession 开始: ${sessionId}`);
      console.time(`[HistoryStore] selectSession 总耗时: ${sessionId}`);

      // 先设置选中的会话元数据
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!session) {
        console.error(`[HistoryStore] ❌ 未找到会话: ${sessionId}`);
        console.error(`[HistoryStore] 当前 sessions 数量: ${get().sessions.length}`);
        return;
      }

      console.log(`[HistoryStore] ✅ 找到会话元数据:`, {
        id: session.id,
        title: session.title,
        projectPath: session.projectPath,
        messageCount: session.messageCount,
      });

      set((state) => {
        state.selectedSession = session;
        state.isLoadingMessages = true;
      });
      console.log(`[HistoryStore] ✅ 已设置 selectedSession 和 isLoadingMessages=true`);

      try {
        // ⭐ 直接从 SQLite 加载（单一数据源，始终最新）
        console.log(`[HistoryStore] 📥 从 SQLite 加载会话数据...`);
        console.time(`[HistoryStore] SQLite 加载耗时: ${sessionId}`);

        const fullSession = await window.electronAPI.invoke<ChatSession>(
          IPCChannels.HISTORY_GET_SESSION,
          {
            projectPath: session.projectPath,
            sessionId: session.id,
          }
        );
        console.timeEnd(`[HistoryStore] SQLite 加载耗时: ${sessionId}`);

        // ⭐ 获取第一条消息的预览（安全处理多种格式）
        const getFirstMessagePreview = () => {
          const firstMessage = fullSession?.messages?.[0];
          if (!firstMessage) return 'N/A';

          const content = firstMessage.content;

          // 如果是字符串，直接截取
          if (typeof content === 'string') {
            return content.substring(0, 50);
          }

          // 如果是对象或数组，转为字符串
          if (typeof content === 'object') {
            return JSON.stringify(content).substring(0, 50);
          }

          return 'Unknown format';
        };

        // ⭐ 诊断日志：显示返回的完整数据
        console.log(`[HistoryStore] 📥 IPC 返回数据:`, {
          hasFullSession: !!fullSession,
          returnedSessionId: fullSession?.id,
          returnedTitle: fullSession?.title,
          returnedProjectPath: fullSession?.projectPath,
          messagesCount: fullSession?.messages?.length || 0,
          firstMessagePreview: getFirstMessagePreview(),
        });

        set((state) => {
          state.selectedSessionFull = fullSession;
          state.isLoadingMessages = false;
        });

        console.log(`[HistoryStore] ✅ SQLite 加载完成: ${fullSession?.messages?.length || 0} 条消息`);
        console.timeEnd(`[HistoryStore] selectSession 总耗时: ${sessionId}`);
      } catch (error) {
        console.error(`[HistoryStore] ❌ 加载完整会话失败:`, error);
        console.error(`[HistoryStore] 错误堆栈:`, error instanceof Error ? error.stack : 'N/A');
        set((state) => {
          state.isLoadingMessages = false;
          state.selectedSessionFull = null;
        });
        console.log(`[HistoryStore] ✅ 已重置 isLoadingMessages=false 和 selectedSessionFull=null`);
        console.timeEnd(`[HistoryStore] selectSession 总耗时: ${sessionId}`);
      }
    },

    /**
     * 删除会话
     */
    deleteSession: async (projectPath: string, sessionId: string) => {
      try {
        await window.electronAPI.invoke(IPCChannels.HISTORY_DELETE_SESSION, {
          projectPath,
          sessionId,
        });

        set((state) => {
          state.sessions = state.sessions.filter((s) => s.id !== sessionId);
          if (state.selectedSession?.id === sessionId) {
            state.selectedSession = null;
          }
        });

        console.log(`[HistoryStore] 删除会话: ${sessionId}`);
      } catch (error) {
        console.error('[HistoryStore] 删除会话失败:', error);
        throw error;
      }
    },

    /**
     * 搜索会话（标题/项目名）
     */
    searchSessions: async (keyword: string) => {
      console.log(`[HistoryStore] 🔍 开始搜索会话...`);
      console.log(`[HistoryStore] 搜索关键词: "${keyword}"`);
      console.log(`[HistoryStore] 项目过滤: ${get().selectedProjectFilter || '无'}`);
      console.time('[HistoryStore] searchSessions 耗时');

      set((state) => {
        state.isLoading = true;
        state.error = null;
      });
      console.log(`[HistoryStore] ✅ 已设置 isLoading=true`);

      try {
        console.log(`[HistoryStore] ⏳ 调用 IPC: HISTORY_SEARCH_SESSIONS`);
        const sessions = await window.electronAPI.invoke<ChatSessionMetadata[]>(
          IPCChannels.HISTORY_SEARCH_SESSIONS,
          {
            keyword,
            projectPath: get().selectedProjectFilter || undefined,
          }
        );
        console.log(`[HistoryStore] ✅ IPC 返回: ${sessions?.length || 0} 个会话`);

        if (sessions && sessions.length > 0) {
          console.log(`[HistoryStore] 前3个会话:`, sessions.slice(0, 3).map(s => ({
            id: s.id.substring(0, 8),
            title: s.title,
            projectName: s.projectName
          })));
        }

        set((state) => {
          state.sessions = sessions || [];
          state.isLoading = false;
        });
        console.log(`[HistoryStore] ✅ 已更新 sessions 和 isLoading=false`);

        console.log(`[HistoryStore] ✅ 搜索完成: ${sessions?.length || 0} 个会话`);
        console.timeEnd('[HistoryStore] searchSessions 耗时');
      } catch (error) {
        console.error(`[HistoryStore] ❌ 搜索会话失败:`, error);
        console.error(`[HistoryStore] 错误堆栈:`, error instanceof Error ? error.stack : 'N/A');
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        set((state) => {
          state.error = errorMessage;
          state.isLoading = false;
        });
        console.log(`[HistoryStore] ✅ 已设置错误状态`);
        console.timeEnd('[HistoryStore] searchSessions 耗时');
      }
    },

    /**
     * 搜索消息内容（深度搜索）
     */
    searchMessageContent: async (keyword: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const sessions = await window.electronAPI.invoke<ChatSessionMetadata[]>(
          IPCChannels.HISTORY_SEARCH_MESSAGES,
          {
            keyword,
            projectPath: get().selectedProjectFilter || undefined,
          }
        );

        set((state) => {
          state.sessions = sessions || [];
          state.isLoading = false;
        });

        console.log(`[HistoryStore] 消息内容搜索到 ${sessions?.length || 0} 个会话`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        set((state) => {
          state.error = errorMessage;
          state.isLoading = false;
        });
        console.error('[HistoryStore] 搜索消息内容失败:', error);
      }
    },

    /**
     * 更新会话标题
     */
    updateSessionTitle: async (projectPath: string, sessionId: string, newTitle: string) => {
      try {
        await window.electronAPI.invoke(IPCChannels.HISTORY_UPDATE_TITLE, {
          projectPath,
          sessionId,
          newTitle,
        });

        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            session.title = newTitle;
          }
          if (state.selectedSession?.id === sessionId) {
            state.selectedSession.title = newTitle;
          }
        });

        console.log(`[HistoryStore] 更新会话标题: ${sessionId} -> ${newTitle}`);
      } catch (error) {
        console.error('[HistoryStore] 更新会话标题失败:', error);
        throw error;
      }
    },

    /**
     * 设置搜索查询
     */
    setSearchQuery: (query: string) => {
      set((state) => {
        state.searchQuery = query;
      });

      // 如果查询为空，重新加载所有会话
      if (!query.trim()) {
        get().loadSessions();
      } else {
        // 执行搜索
        get().searchSessions(query);
      }
    },

    /**
     * 设置项目筛选器
     */
    setProjectFilter: (projectName: string | null) => {
      set((state) => {
        state.selectedProjectFilter = projectName;
      });

      // 重新加载会话（应用筛选）
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchSessions(searchQuery);
      } else {
        get().loadSessions();
      }
    },

    /**
     * 设置日期筛选器
     */
    setDateFilter: (filter: 'all' | 'today' | 'week' | 'month') => {
      set((state) => {
        state.dateFilter = filter;
      });
    },

    /**
     * 清除所有筛选器
     */
    clearFilters: () => {
      set((state) => {
        state.searchQuery = '';
        state.selectedProjectFilter = null;
        state.dateFilter = 'all';
      });
      get().loadSessions();
    },

    // ==================== IndexedDB 功能 ====================


    /**
     * ⭐⭐⭐ SQLite FTS5 全文搜索（多语言分词）
     */
    searchWithFTS5: async (query: string, options?: {
      limit?: number;
      offset?: number;
      projectPath?: string;
      sortBy?: 'relevance' | 'time';
    }) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // 调用主进程的 SQLite FTS5 搜索服务
        const result = await window.electronAPI.invoke(IPCChannels.HISTORY_SEARCH_WITH_FTS5, {
          query,
          limit: options?.limit || 50,
          offset: options?.offset || 0,
          projectPath: options?.projectPath || get().selectedProjectFilter || undefined,
          sortBy: options?.sortBy || 'relevance',
        });

        if (result && result.results) {
          set((state) => {
            state.sessions = result.results;
            state.isLoading = false;
          });

          console.log(`[HistoryStore] 🔍 FTS5 搜索完成: "${query}" 找到 ${result.results.length} 个会话`);
        } else {
          set((state) => {
            state.sessions = [];
            state.isLoading = false;
          });
        }
      } catch (error) {
        console.error('[HistoryStore] FTS5 搜索失败:', error);
        set((state) => {
          state.isLoading = false;
          state.error = `搜索失败: ${error}`;
        });
      }
    },
  }))
);
