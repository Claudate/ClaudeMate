/**
 * Terminal Instance Store
 * 管理多个项目的终端实例，每个项目有独立的聊天历史显示
 *
 * 参照 WPF 的 TerminalInstance 模式:
 * - 每个项目路径对应一个 TerminalInstance
 * - 切换项目时保存当前终端状态，恢复新项目的终端状态
 * - Claude CLI 自动管理 .claude/ 中的会话历史，我们只需管理前端显示
 *
 * 参照 WPF 的 SessionStorageService 模式:
 * - 每个项目维护一个会话元数据索引（sessionIndex）
 * - 支持快速搜索和排序
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from './chatStore';

/**
 * 会话元数据（参照 WPF 的 ChatSessionMetadata）
 * 用于快速显示会话列表，不包含完整消息内容
 */
export interface SessionMetadata {
  id: string;
  title: string;
  projectPath: string;
  projectName: string;
  createdAt: number;
  modifiedAt: number;
  messageCount: number;
  totalTokens: number;

  // 额外的会话信息（参照图片中的 UI 显示）
  model: string; // 使用的模型，如 'sonnet', 'opus', 'haiku'
  cliVersion: string; // Claude CLI 版本，如 '0.470'
  duration: number; // 会话持续时间（毫秒）
  approvalStatus: 'on-request' | 'approved' | 'rejected'; // 审批状态
  fileSize?: number; // 会话文件大小（字节），可选
  workingDirectory: string; // 工作目录
}

/**
 * 完整会话数据（参照 WPF 的 ChatSession）
 * 包含所有消息内容，用于恢复会话显示
 */
export interface SessionData extends SessionMetadata {
  messages: Message[];
  terminalOutput?: string; // 完整的终端输出内容（用于恢复显示）
}

export interface TerminalInstance {
  // 项目标识
  projectPath: string;
  projectName: string;

  // 当前会话
  currentSession: SessionData | null;

  // 聊天状态
  messages: Message[];
  currentSessionId: string;
  isLoading: boolean;
  error: string | null;

  // 终端元数据
  createdAt: number;
  lastAccessedAt: number;
  isActive: boolean;
}

interface TerminalStore {
  // 所有终端实例 (key: projectPath)
  terminals: Map<string, TerminalInstance>;

  // 当前激活的终端
  activeTerminal: TerminalInstance | null;

  // 会话元数据索引（参照 WPF 的 sessionIndex.json）
  // key: projectPath, value: SessionMetadata[]
  sessionIndex: Map<string, SessionMetadata[]>;

  // 获取或创建终端实例
  getOrCreateTerminal: (projectPath: string, projectName: string) => TerminalInstance;

  // 切换到指定项目的终端
  switchToTerminal: (projectPath: string, projectName: string) => TerminalInstance;

  // 更新终端状态
  updateTerminal: (projectPath: string, updates: Partial<TerminalInstance>) => void;

  // 保存当前激活终端的状态
  saveActiveTerminal: (messages: Message[], currentSessionId: string, isLoading: boolean, error: string | null) => void;

  // 清理旧终端 (LRU 淘汰策略)
  evictOldTerminals: (maxCount: number) => void;

  // ========== 会话管理功能（参照 WPF 的 SessionStorageService）==========

  // 获取项目的所有会话元数据
  getAllSessions: (projectPath: string) => SessionMetadata[];

  // 保存会话
  saveSession: (session: SessionData) => void;

  // 加载会话
  loadSession: (projectPath: string, sessionId: string) => SessionData | null;

  // 删除会话
  deleteSession: (projectPath: string, sessionId: string) => void;

  // 搜索会话（标题搜索）
  searchSessions: (projectPath: string, keyword: string) => SessionMetadata[];

  // 更新会话索引
  updateSessionIndex: (projectPath: string, metadata: SessionMetadata) => void;
}

const MAX_TERMINALS = 10; // 最多保留 10 个终端实例

/**
 * Terminal Store Hook
 *
 * 使用示例:
 * ```typescript
 * const { switchToTerminal, saveActiveTerminal } = useTerminalStore();
 *
 * // 切换项目
 * const terminal = switchToTerminal('/path/to/project', 'MyProject');
 * // 使用 terminal.messages 恢复聊天历史显示
 *
 * // 发送消息前保存当前状态
 * saveActiveTerminal(messages, sessionId, isLoading, error);
 * ```
 */
export const useTerminalStore = create<TerminalStore>()(
  persist<TerminalStore>(
    (set, get) => ({
      terminals: new Map(),
      activeTerminal: null,
      sessionIndex: new Map(), // 会话索引

      getOrCreateTerminal: (projectPath, projectName) => {
        const state = get();
        const { terminals } = state;
        let terminal = terminals.get(projectPath);

        if (!terminal) {
          console.log(`[TerminalStore] 创建新终端实例: ${projectName} (${projectPath})`);

          terminal = {
            projectPath,
            projectName,
            currentSession: null,
            messages: [],
            currentSessionId: `session-${Date.now()}`,
            isLoading: false,
            error: null,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            isActive: false,
          };

          // 先添加新终端到 Map
          const newTerminals = new Map(terminals);
          newTerminals.set(projectPath, terminal);

          // 检查是否超过最大终端数并进行淘汰
          if (newTerminals.size > MAX_TERMINALS) {
            console.log(`[TerminalStore] 终端数超过限制 (${newTerminals.size} > ${MAX_TERMINALS})，执行 LRU 淘汰`);

            // 按最后访问时间排序
            const sorted = Array.from(newTerminals.entries()).sort(
              ([, a], [, b]) => b.lastAccessedAt - a.lastAccessedAt
            );

            // 保留最近的 MAX_TERMINALS 个
            const toKeep = sorted.slice(0, MAX_TERMINALS);
            const toEvict = sorted.slice(MAX_TERMINALS);

            console.log(
              `[TerminalStore] 淘汰 ${toEvict.length} 个终端:`,
              toEvict.map(([path, t]) => `${t.projectName} (${path})`)
            );

            set({ terminals: new Map(toKeep) });
          } else {
            set({ terminals: newTerminals });
          }
        } else {
          console.log(`[TerminalStore] 复用现有终端实例: ${projectName}`);

          // 更新最后访问时间
          terminal.lastAccessedAt = Date.now();
        }

        return terminal;
      },

      switchToTerminal: (projectPath, projectName) => {
        console.log(`[TerminalStore] 切换终端: ${projectName} (${projectPath})`);

        const state = get();
        const activeTerminal = state?.activeTerminal || null;

        // 如果已经是当前终端，直接返回
        if (activeTerminal?.projectPath === projectPath) {
          console.log('[TerminalStore] 已是当前终端，无需切换');
          return activeTerminal;
        }

        // 保存当前激活终端的状态
        if (activeTerminal) {
          console.log(`[TerminalStore] 将当前终端切换到后台: ${activeTerminal.projectName}`);
          set((state) => {
            const terminal = state.terminals?.get(activeTerminal.projectPath);
            if (terminal) {
              terminal.isActive = false;
              terminal.lastAccessedAt = Date.now();
            }
          });
        }

        // 获取或创建新终端
        const newTerminal = get().getOrCreateTerminal(projectPath, projectName);
        newTerminal.isActive = true;
        newTerminal.lastAccessedAt = Date.now();

        set({ activeTerminal: newTerminal });

        console.log(`[TerminalStore] 激活终端: ${projectName}, 消息数: ${newTerminal.messages.length}`);

        return newTerminal;
      },

      updateTerminal: (projectPath, updates) => {
        set((state) => {
          const terminal = state.terminals.get(projectPath);
          if (terminal) {
            Object.assign(terminal, updates);

            // 如果更新的是激活终端，同步更新 activeTerminal
            if (state.activeTerminal?.projectPath === projectPath) {
              state.activeTerminal = terminal;
            }
          }
        });
      },

      saveActiveTerminal: (messages, currentSessionId, isLoading, error) => {
        const state = get();
        const activeTerminal = state?.activeTerminal || null;

        if (activeTerminal) {
          console.log(`[TerminalStore] 保存终端状态: ${activeTerminal.projectName}, 消息数: ${messages.length}`);

          get().updateTerminal(activeTerminal.projectPath, {
            messages,
            currentSessionId,
            isLoading,
            error,
            lastAccessedAt: Date.now(),
          });
        }
      },

      evictOldTerminals: (maxCount) => {
        const state = get();
        const terminals = state?.terminals || new Map();

        if (terminals.size <= maxCount) {
          return;
        }

        console.log(`[TerminalStore] 终端数超过限制 (${terminals.size} > ${maxCount})，执行 LRU 淘汰`);

        // 按最后访问时间排序
        const sorted = Array.from(terminals.entries()).sort(
          ([, a], [, b]) => b.lastAccessedAt - a.lastAccessedAt
        );

        // 保留最近的 maxCount 个，删除其余
        const toKeep = sorted.slice(0, maxCount);
        const toEvict = sorted.slice(maxCount);

        set((state) => {
          state.terminals = new Map(toKeep);
        });

        console.log(
          `[TerminalStore] 淘汰 ${toEvict.length} 个终端:`,
          toEvict.map(([path, t]) => `${t.projectName} (${path})`)
        );
      },

      // ========== 会话管理功能实现（参照 WPF 的 SessionStorageService）==========

      /**
       * 获取项目的所有会话元数据（参照 WPF 的 GetAllSessionsAsync）
       * 按修改时间降序排列
       */
      getAllSessions: (projectPath) => {
        const state = get();
        const sessionIndex = state?.sessionIndex || new Map();
        const sessions = sessionIndex.get(projectPath) || [];
        // 按修改时间降序排序
        return sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);
      },

      /**
       * 保存会话（参照 WPF 的 SaveSessionAsync + UpdateIndexAsync）
       */
      saveSession: (session) => {
        console.log(`[TerminalStore] 保存会话: ${session.title} (${session.id})`);

        // 更新会话索引（包含所有元数据）
        const metadata: SessionMetadata = {
          id: session.id,
          title: session.title,
          projectPath: session.projectPath,
          projectName: session.projectName,
          createdAt: session.createdAt,
          modifiedAt: Date.now(), // 更新修改时间
          messageCount: session.messages.length,
          totalTokens: session.totalTokens,

          // 额外的元数据
          model: session.model,
          cliVersion: session.cliVersion,
          duration: session.duration,
          approvalStatus: session.approvalStatus,
          fileSize: session.fileSize,
          workingDirectory: session.workingDirectory,
        };

        get().updateSessionIndex(session.projectPath, metadata);

        // 存储完整会话数据到 localStorage（使用会话 ID 作为 key）
        const storageKey = `session-${session.projectPath}-${session.id}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(session));
          console.log(`[TerminalStore] 会话已保存到 localStorage: ${storageKey}`);
        } catch (error) {
          console.error('[TerminalStore] 保存会话失败:', error);
        }
      },

      /**
       * 加载会话（参照 WPF 的 GetSessionAsync）
       */
      loadSession: (projectPath, sessionId) => {
        const storageKey = `session-${projectPath}-${sessionId}`;
        try {
          const json = localStorage.getItem(storageKey);
          if (json) {
            const session = JSON.parse(json) as SessionData;
            console.log(`[TerminalStore] 加载会话: ${session.title}, 消息数: ${session.messages.length}`);
            return session;
          }
        } catch (error) {
          console.error('[TerminalStore] 加载会话失败:', error);
        }
        return null;
      },

      /**
       * 删除会话（参照 WPF 的 DeleteSessionAsync）
       */
      deleteSession: (projectPath, sessionId) => {
        console.log(`[TerminalStore] 删除会话: ${sessionId}`);

        // 从索引中移除
        set((state) => {
          const sessions = state.sessionIndex.get(projectPath) || [];
          const filtered = sessions.filter((s) => s.id !== sessionId);
          state.sessionIndex.set(projectPath, filtered);
        });

        // 从 localStorage 删除完整会话数据
        const storageKey = `session-${projectPath}-${sessionId}`;
        try {
          localStorage.removeItem(storageKey);
          console.log(`[TerminalStore] 会话已从 localStorage 删除: ${storageKey}`);
        } catch (error) {
          console.error('[TerminalStore] 删除会话失败:', error);
        }
      },

      /**
       * 搜索会话（参照 WPF 的 SearchSessionsAsync）
       * 仅搜索标题和项目名称
       */
      searchSessions: (projectPath, keyword) => {
        if (!keyword || keyword.trim() === '') {
          return get().getAllSessions(projectPath);
        }

        const allSessions = get().getAllSessions(projectPath);
        const lowerKeyword = keyword.toLowerCase();

        return allSessions.filter(
          (s) =>
            s.title.toLowerCase().includes(lowerKeyword) ||
            s.projectName.toLowerCase().includes(lowerKeyword)
        );
      },

      /**
       * 更新会话索引（参照 WPF 的 UpdateIndexAsync）
       */
      updateSessionIndex: (projectPath, metadata) => {
        set((state) => {
          const sessions = state.sessionIndex.get(projectPath) || [];
          const index = sessions.findIndex((s) => s.id === metadata.id);

          if (index >= 0) {
            // 更新现有会话
            sessions[index] = metadata;
          } else {
            // 添加新会话
            sessions.push(metadata);
          }

          state.sessionIndex.set(projectPath, sessions);
        });

        console.log(`[TerminalStore] 会话索引已更新: ${metadata.title}`);
      },
    }),
    {
      name: 'terminal-storage', // localStorage key
      partialize: (state) => ({
        // 持久化所有终端实例和会话索引，但不持久化 activeTerminal
        terminals: state.terminals instanceof Map ? Array.from(state.terminals.entries()) : [],
        sessionIndex: state.sessionIndex instanceof Map ? Array.from(state.sessionIndex.entries()) : [],
      }),
      // 反序列化：将数组转回 Map
      merge: (persistedState: any, currentState: TerminalStore) => {
        // 确保返回完整的 store 对象，包含所有方法
        return {
          ...currentState,
          terminals: persistedState?.terminals && Array.isArray(persistedState.terminals)
            ? new Map(persistedState.terminals)
            : new Map(),
          sessionIndex: persistedState?.sessionIndex && Array.isArray(persistedState.sessionIndex)
            ? new Map(persistedState.sessionIndex)
            : new Map(),
          // activeTerminal 不持久化，始终为 null
          activeTerminal: null,
        };
      },
    }
  )
);
