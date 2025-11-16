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
import { ConversationDatabase } from '../services/ConversationDatabase';

// ⭐ 创建 IndexedDB 实例（渲染进程直接使用）
const conversationDB = new ConversationDatabase();

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

  // ⭐⭐⭐ 新增：IndexedDB 功能
  loadMessagesFromIndexedDB: (sessionId: string) => Promise<{ fromBackup: boolean }>;  // 智能加载消息
  searchIndexedDB: (keyword: string, options?: any) => Promise<void>;  // IndexedDB 全文搜索
  deleteSessionFromIndexedDB: (sessionId: string) => Promise<void>;  // 删除 IndexedDB 历史

  // ⭐⭐⭐ 新增：SQLite FTS5 全文搜索
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
        // 1️⃣ 优先尝试从 IndexedDB 加载
        console.log(`[HistoryStore] 1️⃣ 尝试从 IndexedDB 加载...`);
        console.time(`[HistoryStore] IndexedDB 查询耗时: ${sessionId}`);
        const messages = await conversationDB.getSessionMessages(sessionId);
        console.timeEnd(`[HistoryStore] IndexedDB 查询耗时: ${sessionId}`);
        console.log(`[HistoryStore] IndexedDB 返回 ${messages.length} 条消息`);

        if (messages.length > 0) {
          // ✅ IndexedDB 有数据，直接使用
          console.log(`[HistoryStore] ✅ IndexedDB 有数据，构建 fullSession...`);

          // 转换 ConversationMessage[] 为 ChatMessage[]
          const chatMessages = messages.map(msg => ({
            id: msg.id?.toString() || `${msg.sessionId}-${msg.timestamp}`,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            tokenUsage: msg.metadata?.tokenCount ? {
              totalTokens: msg.metadata.tokenCount,
              inputTokens: 0,
              outputTokens: 0,
            } : undefined,
          }));

          const fullSession: ChatSession = {
            id: session.id,
            title: session.title,
            projectName: session.projectName,
            projectPath: session.projectPath,
            createdAt: session.createdAt,
            modifiedAt: session.modifiedAt,
            startTime: session.startTime,
            messageCount: messages.length,
            totalTokens: session.totalTokens,
            model: session.model,
            cliVersion: session.cliVersion,
            duration: session.duration,
            approval: session.approval,
            messages: chatMessages,
            tokenUsages: [],
          };

          set((state) => {
            state.selectedSessionFull = fullSession;
            state.isLoadingMessages = false;
          });
          console.log(`[HistoryStore] ✅ 已设置 selectedSessionFull 和 isLoadingMessages=false`);

          console.log(`[HistoryStore] ✅ 从 IndexedDB 快速加载: ${messages.length} 条消息`);
          console.timeEnd(`[HistoryStore] selectSession 总耗时: ${sessionId}`);
          return;
        }

        // 2️⃣ IndexedDB 为空，回退到 IPC 加载（从主进程）
        console.log(`[HistoryStore] 2️⃣ IndexedDB 无数据，使用 IPC 加载: ${sessionId}`);
        console.time(`[HistoryStore] IPC 加载耗时: ${sessionId}`);

        const fullSession = await window.electronAPI.invoke<ChatSession>(
          IPCChannels.HISTORY_GET_SESSION,
          {
            projectPath: session.projectPath,
            sessionId: session.id,
          }
        );
        console.timeEnd(`[HistoryStore] IPC 加载耗时: ${sessionId}`);

        console.log(`[HistoryStore] IPC 返回数据:`, {
          hasFullSession: !!fullSession,
          messagesCount: fullSession?.messages?.length || 0,
        });

        set((state) => {
          state.selectedSessionFull = fullSession;
          state.isLoadingMessages = false;
        });
        console.log(`[HistoryStore] ✅ 已设置 selectedSessionFull 和 isLoadingMessages=false`);

        // 3️⃣ 将 IPC 加载的数据保存到 IndexedDB（下次快速加载）
        if (fullSession && fullSession.messages && fullSession.messages.length > 0) {
          try {
            console.log(`[HistoryStore] 3️⃣ 缓存到 IndexedDB: ${fullSession.messages.length} 条消息`);
            console.time(`[HistoryStore] IndexedDB 缓存耗时: ${sessionId}`);

            // 转换 ChatMessage[] 为 ConversationMessage[]
            const conversationMessages = fullSession.messages.map(msg => ({
              sessionId: fullSession.id,
              timestamp: msg.timestamp,
              role: msg.role,
              content: msg.content,
              projectPath: fullSession.projectPath,
              metadata: {
                title: fullSession.title,
                model: fullSession.model,
                tokenCount: msg.tokenUsage?.totalTokens,
              },
            }));

            await conversationDB.saveMessages(conversationMessages);
            console.timeEnd(`[HistoryStore] IndexedDB 缓存耗时: ${sessionId}`);
            console.log(`[HistoryStore] ✅ 已缓存 ${fullSession.messages.length} 条消息到 IndexedDB`);
          } catch (cacheError) {
            console.warn(`[HistoryStore] ⚠️ 缓存到 IndexedDB 失败:`, cacheError);
          }
        } else {
          console.warn(`[HistoryStore] ⚠️ IPC 返回的数据为空或无消息，不缓存`);
        }

        console.log(`[HistoryStore] ✅ 通过 IPC 加载完整会话: ${session.title}`);
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
     * ⭐ 从 IndexedDB 智能加载消息（优先 IndexedDB，失败则从 JSONL 恢复）
     * ✅ 直接使用 Dexie，不通过 IPC
     */
    loadMessagesFromIndexedDB: async (sessionId: string) => {
      set((state) => {
        state.isLoadingMessages = true;
      });

      try {
        // ⭐ 直接从 IndexedDB 加载消息
        let messages = await conversationDB.getSessionMessages(sessionId);
        let fromBackup = false;

        // 如果 IndexedDB 为空，尝试从 JSONL 加载
        if (messages.length === 0) {
          console.info(`[HistoryStore] IndexedDB 无数据，尝试从 JSONL 加载: ${sessionId}`);

          try {
            const result = await window.electronAPI.invoke<any[]>(
              'history:load-from-jsonl',
              { sessionId }
            );

            messages = result || [];
            fromBackup = true;

            // 保存到 IndexedDB 以供下次使用
            if (messages.length > 0) {
              await conversationDB.saveMessages(messages);
              console.info(`[HistoryStore] ✅ 已将 ${messages.length} 条消息从 JSONL 导入到 IndexedDB`);
            }
          } catch (jsonlError) {
            console.warn(`[HistoryStore] ⚠️ JSONL 加载失败: ${jsonlError}`);
          }
        }

        // 转换为 ChatSession 格式
        const session = get().selectedSession;
        if (session) {
          // 转换 ConversationMessage[] 为 ChatMessage[]
          const chatMessages = messages.map(msg => ({
            id: msg.id?.toString() || `${msg.sessionId}-${msg.timestamp}`,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            tokenUsage: msg.metadata?.tokenCount ? {
              totalTokens: msg.metadata.tokenCount,
              inputTokens: 0,
              outputTokens: 0,
            } : undefined,
          }));

          const fullSession: ChatSession = {
            id: session.id,
            title: session.title,
            projectName: session.projectName,
            projectPath: session.projectPath,
            createdAt: session.createdAt,
            modifiedAt: session.modifiedAt,
            startTime: session.startTime,
            messageCount: messages.length,
            totalTokens: session.totalTokens,
            model: session.model,
            cliVersion: session.cliVersion,
            duration: session.duration,
            approval: session.approval,
            messages: chatMessages,
            tokenUsages: [],
          };

          set((state) => {
            state.selectedSessionFull = fullSession;
            state.isLoadingMessages = false;
          });

          if (fromBackup) {
            console.warn(
              `[HistoryStore] ⚠️ 历史记录从 JSONL 备份恢复: ${messages.length} 条消息`
            );
          } else {
            console.log(
              `[HistoryStore] ✅ 从 IndexedDB 加载了 ${messages.length} 条消息`
            );
          }
        }

        return { fromBackup };
      } catch (error) {
        console.error('[HistoryStore] 从 IndexedDB 加载消息失败:', error);
        set((state) => {
          state.isLoadingMessages = false;
          state.selectedSessionFull = null;
        });
        throw error;
      }
    },

    /**
     * ⭐ IndexedDB 全文搜索（支持中英日分词）
     * ✅ 直接使用 Dexie，不通过 IPC
     */
    searchIndexedDB: async (keyword: string, options?: {
      sessionId?: string;
      projectPath?: string;
      role?: 'user' | 'assistant' | 'system';
      limit?: number;
      useTokenizer?: boolean;
    }) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // ⭐ 直接调用 ConversationDatabase.search()
        const searchResults = await conversationDB.search(keyword, {
          sessionId: options?.sessionId,
          projectPath: options?.projectPath || get().selectedProjectFilter || undefined,
          role: options?.role,
          limit: options?.limit || 50,
          useTokenizer: options?.useTokenizer !== false,  // 默认启用分词
        });

        console.log(`[HistoryStore] 🔍 IndexedDB 搜索到 ${searchResults.length} 条结果`);

        // 将搜索结果转换为会话列表（按 sessionId 分组）
        const sessionMap = new Map<string, {
          session: ChatSessionMetadata;
          matchCount: number;
          bestScore: number;
        }>();

        searchResults.forEach((result) => {
          const msg = result.message;
          const existing = sessionMap.get(msg.sessionId);

          if (existing) {
            existing.matchCount++;
            existing.bestScore = Math.max(existing.bestScore, result.matchScore);
          } else {
            // 创建新的会话元数据
            sessionMap.set(msg.sessionId, {
              session: {
                id: msg.sessionId,
                title: msg.metadata?.title || `Session ${msg.sessionId.substring(0, 8)}`,
                projectName: msg.projectPath?.split(/[/\\]/).pop() || 'Unknown',
                projectPath: msg.projectPath || '',
                timestamp: new Date(msg.timestamp).toISOString(),
                messageCount: 1,
                totalTokens: msg.metadata?.tokenCount || 0,
                model: msg.metadata?.model || 'unknown',
                cliVersion: '2.0',
                duration: 0,
                approvalStatus: 'auto',
              },
              matchCount: 1,
              bestScore: result.matchScore,
            });
          }
        });

        // 转换为数组并按最佳匹配分数排序
        const sessions = Array.from(sessionMap.values())
          .sort((a, b) => b.bestScore - a.bestScore)
          .map(item => item.session);

        set((state) => {
          state.sessions = sessions;
          state.isLoading = false;
        });

        console.log(`[HistoryStore] ✅ 搜索结果已按匹配度排序: ${sessions.length} 个会话`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'IndexedDB search failed';
        set((state) => {
          state.error = errorMessage;
          state.isLoading = false;
        });
        console.error('[HistoryStore] IndexedDB 搜索失败:', error);
      }
    },

    /**
     * ⭐ 删除 IndexedDB 中的会话历史
     * ✅ 直接使用 Dexie，不通过 IPC
     */
    deleteSessionFromIndexedDB: async (sessionId: string) => {
      try {
        // ⭐ 直接调用 ConversationDatabase.deleteSessionMessages()
        const count = await conversationDB.deleteSessionMessages(sessionId);
        console.log(`[HistoryStore] ✅ 已从 IndexedDB 删除会话: ${sessionId} (${count} 条消息)`);
      } catch (error) {
        console.error('[HistoryStore] 从 IndexedDB 删除会话失败:', error);
        throw error;
      }
    },

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
