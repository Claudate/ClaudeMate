/**
 * Chat Store
 * Manages chat messages and Claude CLI interactions
 *
 * 参照 WPF 的项目上下文模式:
 * - 每个项目目录都有独立的 Claude CLI 会话
 * - 切换项目时自动切换会话历史
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { IPCChannels } from '@shared/types/ipc.types';
import { ToolPermissionRequest } from '@shared/types/domain.types';
import { useProjectStore } from './projectStore';
import { useTerminalStore, SessionData } from './terminalStore';
import { useSessionConfigStore } from './sessionConfigStore';
import { generateSessionTitle } from '../services/sessionSummaryService';

// ⭐ UUID 生成函数 (Claude CLI --resume 需要 UUID 格式)
// ⭐⭐⭐ 必须返回标准 UUID 格式（Claude CLI 会严格校验）
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Token 使用量统计（参照 WPF 的 TokenUsage 模型）
 * 记录单次 Claude API 调用的 token 使用情况
 */
export interface TokenUsage {
  inputTokens: number;      // 输入 token 数量（用户提示词）
  outputTokens: number;     // 输出 token 数量（Claude 响应）
  totalTokens: number;      // 总 token 数量
  cacheCreationTokens?: number;  // 缓存创建的 token 数量（如果使用了 prompt caching）
  cacheReadTokens?: number;      // 缓存读取的 token 数量（如果使用了 prompt caching）
  timestamp: number;        // 时间戳
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  tokenUsage?: TokenUsage;  // Token 使用量（仅对 assistant 消息有效）
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentSessionId: string;
  error: string | null;

  // Session tracking (参照 WPF 的 SessionLimit 功能)
  totalTokens: number;
  sessionWarningShown: boolean;

  // ⭐ Cancelling flag (标记会话正在被取消，忽略后续的错误事件)
  isCancelling: boolean;

  // ⭐ Tool Permission (工具授权)
  permissionRequest: ToolPermissionRequest | null;
  permissionMode: 'manual' | 'auto';  // 授权模式 (默认 manual)

  // ⭐ Project-Session Mapping (项目绑定的会话 ID)
  // 每个项目路径对应一个持久的 sessionId，实现跨应用重启的会话恢复
  projectSessionMap: Record<string, string>;

  // ⭐ UI state flags
  hasShownNoProjectWarning: boolean;  // 是否已显示过"无项目"警告

  // ⭐⭐⭐ 当前加载的项目路径（用于检测项目切换）
  currentProjectPath: string | null;

  // ⭐⭐⭐ Pending input text (用于"添加到对话"功能)
  pendingInput: string;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  appendToPendingInput: (text: string) => void;  // 添加文本到待输入区
  clearPendingInput: () => void;  // 清空待输入文本
  addMessage: (message: Message) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  loadSession: (sessionId: string) => Promise<void>;
  saveSession: () => Promise<void>;
  createNewSession: (title?: string) => Promise<void>;

  // Terminal management (参照 WPF 的多终端模式)
  restoreFromTerminal: (projectPath: string, projectName: string) => void;

  // Session limit management (参照 WPF 的 SessionLimit 功能)
  checkSessionLimit: () => { canContinue: boolean; warning?: string; limitReached?: boolean };
  getSessionStats: () => string;
  updateTokenCount: (tokens: number) => void;

  // Session auto-save with smart title generation (参照 WPF 的 AddMessageToSessionAsync)
  saveSessionIfNeeded: () => Promise<void>;

  // ⭐ Tool Permission Actions
  respondToPermission: (approved: boolean) => Promise<void>;
  setPermissionMode: (mode: 'manual' | 'auto') => void;

  // ⭐ Project-Session Management (项目会话管理)
  getOrCreateSessionForProject: (projectPath: string) => string;
  switchToProject: (projectPath: string | null) => Promise<void>;

  // ⭐⭐⭐ Workflow Auto-Generation (工作流自动生成)
  generateWorkflowFromCurrentSession: () => Promise<void>;

  // ⭐ Cancel Session (取消当前会话，重置 loading 状态)
  cancelSession: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    immer((set, get) => ({
    messages: [],
    isLoading: false,
    currentSessionId: generateUUID(),  // ⭐ 使用 UUID 格式 (Claude CLI --resume 需要)
    error: null,
    totalTokens: 0,
    sessionWarningShown: false,
    isCancelling: false,  // ⭐ 初始状态

    // ⭐ Tool Permission 初始状态
    permissionRequest: null,
    permissionMode: 'manual',  // 默认使用手动授权模式

    // ⭐ Project-Session Mapping 初始状态
    projectSessionMap: {},  // 从 localStorage 恢复（使用 persist 中间件）

    // ⭐ UI state flags 初始状态
    hasShownNoProjectWarning: false,

    // ⭐⭐⭐ 当前加载的项目路径初始值
    currentProjectPath: null,

    // ⭐⭐⭐ Pending input初始值
    pendingInput: '',

    appendToPendingInput: (text: string) => {
      set((state) => {
        state.pendingInput = state.pendingInput ? `${state.pendingInput}\n\n${text}` : text;
      });
    },

    clearPendingInput: () => {
      set((state) => {
        state.pendingInput = '';
      });
    },

    sendMessage: async (content: string | any[]) => {
      // 检查会话限制（参照 WPF 的 CheckSessionLimitAsync）
      const limitCheck = get().checkSessionLimit();

      if (limitCheck.limitReached) {
        // 达到限制，添加系统消息提示
        const systemMessage: Message = {
          id: nanoid(),
          role: 'assistant',
          content: limitCheck.warning || '会话已达到限制',
          timestamp: Date.now(),
        };

        set((state) => {
          state.messages.push(systemMessage);
          state.error = limitCheck.warning || null;
        });

        console.warn('[ChatStore] 会话已达到限制，阻止发送消息');
        return; // 阻止发送
      }

      // 显示警告（如果接近限制）
      if (limitCheck.warning && !get().sessionWarningShown) {
        const warningMessage: Message = {
          id: nanoid(),
          role: 'assistant',
          content: limitCheck.warning,
          timestamp: Date.now(),
        };

        set((state) => {
          state.messages.push(warningMessage);
          state.sessionWarningShown = true; // 只显示一次警告
        });
      }

      // 在发送消息前，保存当前终端状态到 TerminalStore
      const { messages: currentMessages, currentSessionId, isLoading: currentLoading, error: currentError } = get();
      const terminalStore = useTerminalStore.getState();
      if (terminalStore?.saveActiveTerminal) {
        terminalStore.saveActiveTerminal(
          currentMessages,
          currentSessionId,
          currentLoading,
          currentError
        );
      }

      // ⭐⭐⭐ 处理多模态消息显示
      // 如果是数组格式（包含图片），提取文本部分用于显示
      const displayContent = Array.isArray(content)
        ? content.find((item) => item.type === 'text')?.text || '[图片消息]'
        : content;

      const userMessage: Message = {
        id: nanoid(),
        role: 'user',
        content: displayContent, // 显示文本部分
        timestamp: Date.now(),
      };

      // Add user message
      set((state) => {
        state.messages.push(userMessage);
        state.error = null;
        state.isLoading = true; // ✅ 设置加载状态，显示"正在回复"指示器
        state.isCancelling = false;  // ⭐ 重置取消标志
      });

      // Create assistant message placeholder
      const assistantMessageId = nanoid();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      set((state) => {
        state.messages.push(assistantMessage);
      });

      try {
        // 获取当前项目路径（参照 WPF 的 _projectContext.CurrentProject?.Path 模式）
        const currentProject = useProjectStore.getState().currentProject;
        const projectPath = currentProject?.path; // 可能为 undefined（无项目上下文）

        console.log(`[ChatStore] 发送消息 - 项目路径: ${projectPath || '(无项目)'}`);

        // ⭐⭐⭐ 强制要求打开项目才能使用 Claude CLI
        if (!projectPath) {
          console.error('[ChatStore] ❌ 没有打开项目，禁止使用 Claude CLI');

          // 更新 assistant 消息为错误提示
          set((state) => {
            const msg = state.messages.find((m) => m.id === assistantMessageId);
            if (msg) {
              msg.content =
                '⚠️ **无法发送消息**\n\n' +
                '您当前没有打开项目。Claude CLI 需要一个工作目录才能运行。\n\n' +
                '**请按照以下步骤操作：**\n' +
                '1. 点击侧边栏的 "Projects" 按钮\n' +
                '2. 选择 "Open Folder" 打开一个项目目录\n' +
                '3. 返回聊天界面重新发送消息\n\n' +
                '**为什么需要项目？**\n' +
                '- Claude CLI 需要在特定目录中操作文件\n' +
                '- 会话历史与项目关联\n' +
                '- 确保文件创建在正确的位置';
              msg.isStreaming = false;
            }
            state.isLoading = false;
          });

          return; // ⭐ 阻止继续执行
        }

        // ⭐ Setup permission request listener (手动模式)
        const unsubscribePermission = window.electronAPI.on(
          IPCChannels.CLAUDE_PERMISSION_REQUEST,
          (data: { sessionId: string; request: ToolPermissionRequest }) => {
            if (data.sessionId === get().currentSessionId) {
              console.log('[ChatStore] 收到授权请求:', data.request);
              set((state) => {
                state.permissionRequest = data.request;
              });
            }
          }
        );

        // Setup streaming listener
        const unsubscribe = window.electronAPI.on(
          'claude:stream',
          (data: { sessionId: string; chunk: { type: string; content: string; tokenUsage?: any } }) => {
            if (data.sessionId === get().currentSessionId) {
              const { type, content: chunkContent, tokenUsage } = data.chunk;

              // ⭐ 诊断日志：追踪所有流式事件
              console.log(`[ChatStore] 📨 收到流式事件: type=${type}, sessionId=${data.sessionId.substring(0, 8)}...`);

              if (type === 'text') {
                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    msg.content += chunkContent;
                  }
                });
              } else if (type === 'tool_use') {
                // 优化工具调用显示：合并重复调用,只显示摘要
                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    // 解析工具名称
                    const toolMatch = chunkContent.match(/^(\w+)/);
                    const toolName = toolMatch ? toolMatch[1] : chunkContent;

                    // 检查是否已经有相同工具的调用记录
                    const toolCallPattern = new RegExp(`${toolName}\\s*(?:\\(\\d+\\))?$`, 'm');
                    const existingToolCall = msg.content.match(toolCallPattern);

                    if (existingToolCall) {
                      // 如果已经有相同工具调用,增加计数
                      const countMatch = existingToolCall[0].match(/\((\d+)\)/);
                      const count = countMatch ? parseInt(countMatch[1]) + 1 : 2;
                      msg.content = msg.content.replace(
                        toolCallPattern,
                        `${toolName} (${count})`
                      );
                    } else {
                      msg.content += `${toolName}\n`;
                    }
                  }
                });
              } else if (type === 'done') {
                console.log('[ChatStore] 🎉 收到 done 事件，准备保存会话');
                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    msg.isStreaming = false;

                    // 保存 token 使用量（参照 WPF 的 TokenUsage 模型）
                    if (tokenUsage) {
                      console.log('[ChatStore] 接收到 Token 使用量:', tokenUsage);
                      msg.tokenUsage = {
                        inputTokens: tokenUsage.input_tokens || tokenUsage.InputTokens || 0,
                        outputTokens: tokenUsage.output_tokens || tokenUsage.OutputTokens || 0,
                        totalTokens: (tokenUsage.input_tokens || tokenUsage.InputTokens || 0) +
                                    (tokenUsage.output_tokens || tokenUsage.OutputTokens || 0),
                        cacheCreationTokens: tokenUsage.cache_creation_input_tokens || tokenUsage.CacheCreationTokens,
                        cacheReadTokens: tokenUsage.cache_read_input_tokens || tokenUsage.CacheReadTokens,
                        timestamp: Date.now(),
                      };

                      // 更新总 token 计数
                      state.totalTokens += msg.tokenUsage.totalTokens;
                      console.log(`[ChatStore] Token 使用: Input=${msg.tokenUsage.inputTokens}, Output=${msg.tokenUsage.outputTokens}, Total=${msg.tokenUsage.totalTokens}`);
                    }
                  }
                  state.isLoading = false; // ✅ 对话完成，关闭加载状态
                });

                // 对话完成后，检查是否需要生成智能标题并保存会话
                // 参照 WPF 的 AddMessageToSessionAsync 逻辑
                console.log('[ChatStore] 🔄 调用 saveSessionIfNeeded...');
                get().saveSessionIfNeeded().then(() => {
                  console.log('[ChatStore] ✅ saveSessionIfNeeded 完成');
                }).catch((error) => {
                  console.error('[ChatStore] ❌ saveSessionIfNeeded 失败:', error);
                });

                unsubscribe();
                unsubscribePermission();
              } else if (type === 'error') {
                // ⭐ 如果正在取消会话，忽略错误事件（避免显示"进程异常退出"）
                const { isCancelling } = get();
                if (isCancelling) {
                  console.log('[ChatStore] 会话正在取消，忽略错误事件（但继续接收数据）');
                  // ⭐ 不要 unsubscribe，继续接收可能的数据
                  // 标记消息为非流式状态，并保存已接收的数据
                  set((state) => {
                    const msg = state.messages.find((m) => m.id === assistantMessageId);
                    if (msg) {
                      msg.isStreaming = false;
                    }
                    state.isLoading = false;
                  });

                  // ⭐ 立即保存已接收的数据（暂停之前的内容）
                  console.log('[ChatStore] 🔄 保存暂停前的数据...');
                  get().saveSessionIfNeeded().then(() => {
                    console.log('[ChatStore] ✅ 暂停前的数据已保存');
                  }).catch((error) => {
                    console.error('[ChatStore] ❌ 保存暂停前的数据失败:', error);
                  });

                  unsubscribe();
                  unsubscribePermission();
                  return;
                }

                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    msg.content = `Error: ${chunkContent}`;
                    msg.isStreaming = false;
                  }
                  state.error = chunkContent;
                  state.isLoading = false;
                });
                unsubscribe();
                unsubscribePermission();
              }
            }
          }
        );

        // Execute Claude CLI with project path as cwd
        await window.electronAPI.invoke(IPCChannels.CLAUDE_EXECUTE, {
          message: content,
          sessionId: get().currentSessionId,
          model: 'sonnet',
          cwd: projectPath, // 必须使用项目目录作为工作目录
          permissionMode: get().permissionMode, // ⭐ 传递授权模式
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        set((state) => {
          const msg = state.messages.find((m) => m.id === assistantMessageId);
          if (msg) {
            msg.content = `Error: ${errorMessage}`;
            msg.isStreaming = false;
          }
          state.error = errorMessage;
        });
      }
    },

    addMessage: (message) => {
      set((state) => {
        state.messages.push(message);
      });
    },

    updateStreamingMessage: (id, content) => {
      set((state) => {
        const message = state.messages.find((m) => m.id === id);
        if (message) {
          message.content = content;
        }
      });
    },

    setError: (error) => {
      set((state) => {
        state.error = error;
      });
    },

    clearMessages: () => {
      set((state) => {
        state.messages = [];
        state.isLoading = false;
        state.currentSessionId = generateUUID();  // ⭐ 使用 UUID 格式 (Claude CLI --resume 需要)
        state.error = null;
        state.totalTokens = 0; // 重置 token 计数
        state.sessionWarningShown = false; // 重置警告状态
      });
    },

    loadSession: async (sessionId: string) => {
      try {
        const session = await window.electronAPI.invoke(IPCChannels.SESSION_LOAD, { id: sessionId });
        if (session) {
          set((state) => {
            state.messages = session.messages;
            state.currentSessionId = session.id;
            state.error = null;
          });
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        set((state) => {
          state.error = 'Failed to load session';
        });
      }
    },

    saveSession: async () => {
      try {
        const { messages, currentSessionId } = get();
        await window.electronAPI.invoke(IPCChannels.SESSION_SAVE, {
          id: currentSessionId,
          updates: {
            messages,
            updatedAt: Date.now(),
          },
        });
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    },

    createNewSession: async (title?: string) => {
      try {
        const sessionId = nanoid();
        const now = Date.now();

        await window.electronAPI.invoke(IPCChannels.SESSION_CREATE, {
          id: sessionId,
          title: title || `Session ${new Date().toLocaleString()}`,
          messages: [],
          createdAt: now,
          updatedAt: now,
        });

        set((state) => {
          state.messages = [];
          state.currentSessionId = sessionId;
          state.isLoading = false;
          state.error = null;
        });
      } catch (error) {
        console.error('Failed to create session:', error);
        set((state) => {
          state.error = 'Failed to create session';
        });
      }
    },

    /**
     * 从 TerminalStore 恢复终端状态
     * 参照 WPF 的多终端切换逻辑
     */
    restoreFromTerminal: (projectPath: string, projectName: string) => {
      console.log(`[ChatStore] 恢复终端状态: ${projectName} (${projectPath})`);

      // 先保存当前状态
      const { messages, currentSessionId, isLoading, error } = get();

      // ⭐⭐⭐ 安全地获取 terminalStore
      let terminalStore;
      try {
        terminalStore = useTerminalStore.getState();
      } catch (storeError) {
        console.error('[ChatStore] ❌ 获取 TerminalStore 失败:', storeError);
        console.error('[ChatStore] 终端切换失败，但继续加载文件');
        return;
      }

      // ⭐⭐⭐ 全面的 null/undefined 检查
      if (!terminalStore) {
        console.error('[ChatStore] ❌ TerminalStore 未正确初始化 - getState() 返回了 null/undefined');
        console.error('[ChatStore] 终端切换失败，但继续加载文件');
        return;
      }

      // ⭐⭐⭐ 验证所有必需的方法存在且为函数
      const requiredMethods = ['switchToTerminal', 'saveActiveTerminal', 'getOrCreateTerminal'];
      for (const methodName of requiredMethods) {
        if (typeof (terminalStore as any)[methodName] !== 'function') {
          console.error(`[ChatStore] ❌ ${methodName} 方法不存在或不是函数`);
          console.error('[ChatStore] terminalStore 可用的键:', Object.keys(terminalStore));
          console.error('[ChatStore] 终端切换失败，但继续加载文件');
          return;
        }
      }

      // ⭐⭐⭐ 所有验证通过，执行终端切换
      try {
        terminalStore.saveActiveTerminal(messages, currentSessionId, isLoading, error);

        // 切换到新终端
        const terminal = terminalStore.switchToTerminal(projectPath, projectName);

        // ⭐ 验证返回的 terminal 对象
        if (!terminal) {
          console.error('[ChatStore] ❌ switchToTerminal 返回了 null/undefined');
          return;
        }

        // 恢复新终端的状态
        set((state) => {
          state.messages = terminal.messages || [];
          state.currentSessionId = terminal.currentSessionId || generateUUID();
          state.isLoading = terminal.isLoading || false;
          state.error = terminal.error || null;
          state.sessionWarningShown = false; // 重置警告状态
        });

        console.log(`[ChatStore] ✅ 已恢复终端: ${projectName}, 消息数: ${terminal.messages?.length || 0}`);
      } catch (switchError) {
        console.error('[ChatStore] ❌ 终端切换过程中发生错误:', switchError);
        console.error('[ChatStore] 终端切换失败，但继续加载文件');
      }
    },

    /**
     * 检查会话限制
     * 参照 WPF 的 CheckSessionLimitAsync 方法
     */
    checkSessionLimit: () => {
      const { messages, totalTokens } = get();
      const configStore = useSessionConfigStore.getState();
      const currentMessageCount = messages.length;

      console.log('[ChatStore] 检查会话限制:');
      console.log(`  - 消息数: ${currentMessageCount}/${configStore.config.maxMessagesPerSession}`);
      console.log(`  - Token: ${totalTokens}/${configStore.config.maxTokensPerSession}`);

      // 检查是否达到限制
      const hasReachedMessageLimit = configStore.hasReachedMessageLimit(currentMessageCount);
      const hasReachedTokenLimit = configStore.hasReachedTokenLimit(totalTokens);

      if (hasReachedMessageLimit || hasReachedTokenLimit) {
        const limitType = hasReachedMessageLimit && hasReachedTokenLimit
          ? '消息数量和 Token'
          : hasReachedMessageLimit
          ? '消息数量'
          : 'Token 数量';

        console.log(`[ChatStore] 会话已达到 ${limitType} 限制`);

        return {
          canContinue: !configStore.config.autoCreateNewSession,
          limitReached: true,
          warning: `当前会话的 ${limitType} 已达到上限。\n建议创建新会话以继续对话。`,
        };
      }

      // 检查是否接近限制
      const isNearMessageLimit = configStore.isNearMessageLimit(currentMessageCount);
      const isNearTokenLimit = configStore.isNearTokenLimit(totalTokens);

      if (isNearMessageLimit || isNearTokenLimit) {
        const messagePercent = configStore.getMessageUsagePercent(currentMessageCount);
        const tokenPercent = configStore.getTokenUsagePercent(totalTokens);

        const warning =
          `📊 会话使用情况:\n` +
          `  • 消息数: ${currentMessageCount}/${configStore.config.maxMessagesPerSession} (${messagePercent}%)\n` +
          `  • Token: ${totalTokens.toLocaleString()}/${configStore.config.maxTokensPerSession.toLocaleString()} (${tokenPercent}%)\n` +
          `\n⚠️ 接近会话限制，建议稍后创建新会话`;

        console.log('[ChatStore] 会话接近限制');

        return {
          canContinue: true,
          warning,
        };
      }

      return { canContinue: true };
    },

    /**
     * 获取会话统计信息
     * 参照 WPF 的 GetSessionStatsDisplay 方法
     */
    getSessionStats: () => {
      const { messages, totalTokens } = get();
      const configStore = useSessionConfigStore.getState();
      const messageCount = messages.length;
      const messagePercent = configStore.getMessageUsagePercent(messageCount);
      const tokenPercent = configStore.getTokenUsagePercent(totalTokens);

      return (
        `消息: ${messageCount}/${configStore.config.maxMessagesPerSession} (${messagePercent}%) | ` +
        `Token: ${totalTokens.toLocaleString()}/${configStore.config.maxTokensPerSession.toLocaleString()} (${tokenPercent}%)`
      );
    },

    /**
     * 更新 Token 计数
     */
    updateTokenCount: (tokens: number) => {
      set((state) => {
        state.totalTokens += tokens;
      });
    },

    /**
     * 自动保存会话（带智能标题生成）
     * 参照 WPF 的 AddMessageToSessionAsync 方法
     *
     * 逻辑：
     * 1. 检查是否为第一条用户消息（messages.length == 2: 1 user + 1 assistant）
     * 2. 如果是，生成智能标题
     * 3. 保存会话到 TerminalStore
     */
    saveSessionIfNeeded: async () => {
      const { messages, currentSessionId, totalTokens } = get();
      const currentProject = useProjectStore.getState().currentProject;

      // 必须有项目上下文才能保存会话
      if (!currentProject) {
        console.log('[ChatStore] 无项目上下文，跳过会话保存');
        return;
      }

      // 过滤掉系统消息（警告消息等）
      const userMessages = messages.filter((m) => m.role === 'user');
      const isFirstUserMessage = userMessages.length === 1;

      console.log(`[ChatStore] 检查会话保存 - 消息数: ${messages.length}, 是否首条消息: ${isFirstUserMessage}`);

      // 生成或使用默认标题
      let sessionTitle = `会话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

      if (isFirstUserMessage && userMessages[0]) {
        // 第一条用户消息，生成智能标题
        try {
          console.log('[ChatStore] 正在生成智能标题...');
          sessionTitle = await generateSessionTitle({
            firstMessage: userMessages[0].content,
            projectName: currentProject.name,
            maxLength: 20,
          });
          console.log(`[ChatStore] 智能标题生成成功: ${sessionTitle}`);
        } catch (error) {
          console.error('[ChatStore] 智能标题生成失败:', error);
          // 使用第一条消息的前20个字符作为标题
          sessionTitle = userMessages[0].content.substring(0, 20);
          if (userMessages[0].content.length > 20) {
            sessionTitle += '...';
          }
        }
      }

      // 计算会话持续时间
      console.log('[ChatStore] 📊 开始构建会话数据...');
      const firstMessageTime = messages[0]?.timestamp || Date.now();
      const lastMessageTime = messages[messages.length - 1]?.timestamp || Date.now();
      const duration = lastMessageTime - firstMessageTime;

      // 计算会话数据大小（估算）
      const sessionJson = JSON.stringify({ messages, totalTokens });
      const fileSize = new Blob([sessionJson]).size;

      console.log('[ChatStore] 📊 会话元数据:', {
        messageCount: messages.length,
        userMessages: userMessages.length,
        duration,
        fileSize,
        sessionTitle,
      });

      // 构建会话数据
      const sessionData: SessionData = {
        id: currentSessionId,
        title: sessionTitle,
        projectPath: currentProject.path,
        projectName: currentProject.name,
        createdAt: messages[0]?.timestamp || Date.now(),
        modifiedAt: Date.now(),
        messageCount: messages.length,
        totalTokens,
        messages,

        // 额外的元数据
        model: 'sonnet', // 当前使用的模型（参照 sendMessage 中的 model 参数）
        cliVersion: '0.470', // Claude CLI 版本（TODO: 从系统获取实际版本）
        duration, // 会话持续时间（毫秒）
        approvalStatus: 'on-request', // 默认为 on-request
        fileSize, // 会话数据大小（字节）
        workingDirectory: currentProject.path, // 工作目录
      };

      console.log('[ChatStore] ✅ 会话数据构建完成，sessionId:', currentSessionId);

      // 保存到 TerminalStore
      try {
        const terminalStore = useTerminalStore.getState();
        if (terminalStore?.saveSession) {
          terminalStore.saveSession(sessionData);
          console.log(`[ChatStore] 会话已保存到 TerminalStore: ${sessionTitle}`);
        } else {
          console.warn('[ChatStore] TerminalStore 未初始化，无法保存会话');
        }
      } catch (error) {
        console.error('[ChatStore] 会话保存到 TerminalStore 失败:', error);
      }

      // 💾 保存到 SessionStorageService（History 功能）
      // 参照 WPF 的 AddMessageToSessionAsync 逻辑
      console.log('[ChatStore] 🔍 开始 History 保存流程...');
      try {
        console.log('[ChatStore] 🔍 准备检查会话是否存在...');
        // 检查会话是否已存在
        let session = await window.electronAPI.invoke(IPCChannels.HISTORY_GET_SESSION, {
          projectPath: currentProject.path,
          sessionId: currentSessionId,
        });

        // 如果会话不存在，先创建会话
        if (!session) {
          console.log(`[ChatStore] ⚠️ 会话不存在，准备创建: projectPath=${currentProject.path}, sessionId=${currentSessionId}`);

          session = await window.electronAPI.invoke(IPCChannels.HISTORY_CREATE_SESSION, {
            projectPath: currentProject.path,
            projectName: currentProject.name,
            title: sessionTitle,
            sessionId: currentSessionId,  // ⭐ 使用当前 sessionId（与 Claude CLI 一致）
          });

          console.log(`[ChatStore] ✅ 创建新 History 会话完成`, { id: session?.id, title: session?.title });
        }

        // ⭐ 确保 session 存在且 ID 匹配
        if (!session || session.id !== currentSessionId) {
          console.error(`[ChatStore] ❌ Session 创建失败或 ID 不匹配!`, {
            expected: currentSessionId,
            got: session?.id,
          });
          throw new Error(`Session creation failed: expected ${currentSessionId}, got ${session?.id}`);
        }

        // 逐条保存新消息（只保存未保存的消息）
        const savedMessageIds = new Set(session.messages?.map((m: any) => m.id) || []);
        console.log(`[ChatStore] 📊 当前会话状态:`, {
          sessionId: currentSessionId,
          totalMessages: messages.length,
          savedMessages: savedMessageIds.size,
          newMessages: messages.length - savedMessageIds.size,
        });

        let savedCount = 0;
        let skippedCount = 0;

        for (const message of messages) {
          if (!savedMessageIds.has(message.id)) {
            console.log(`[ChatStore] 💾 准备保存消息 [${savedCount + 1}/${messages.length - savedMessageIds.size}]: ${message.id} (${message.role})`);

            try {
              // ⭐ 清理内容：移除工具调用的装饰性文本（只用于 UI 显示，不存入数据库）
              const cleanContent = message.content
                .replace(/\n\n---\n\*\*工具调用:\*\*\n([A-Za-z_][^\n]*\n?)+/g, '') // 移除整个工具调用块
                .replace(/^[A-Za-z_]+\s*(?:\(\d+\))?\n/gm, '') // 移除工具调用行（如 "Read" 或 "Edit (2)"）
                .trim();

              // 保存到 SQLite（单一数据源）
              await window.electronAPI.invoke(IPCChannels.HISTORY_SAVE_MESSAGE, {
                projectPath: currentProject.path,
                sessionId: currentSessionId,
                message: {
                  id: message.id,
                  role: message.role,
                  content: cleanContent, // ⭐ 使用清理后的内容
                  timestamp: message.timestamp,
                  tokenUsage: message.tokenUsage,
                  toolUses: [],
                },
              });

              savedCount++;
              console.log(`[ChatStore] ✅ 保存成功: ${message.id} (${message.role})`);
            } catch (msgError) {
              console.error(`[ChatStore] ❌ 保存消息失败: ${message.id}`, msgError);
              throw msgError; // ⭐ 重新抛出错误，确保不会静默失败
            }
          } else {
            skippedCount++;
            console.log(`[ChatStore] ⏭️ 跳过已保存的消息: ${message.id}`);
          }
        }

        console.log(`[ChatStore] ✅ 会话保存完成: ${sessionTitle}`, {
          total: messages.length,
          saved: savedCount,
          skipped: skippedCount,
        });
      } catch (error) {
        console.error('[ChatStore] ❌ 会话保存到 History 失败:', error);
        console.error('[ChatStore] 错误详情:', error instanceof Error ? error.stack : error);
        // ⭐ 不要静默吞掉错误 - 至少在控制台显示详细信息
      }
    },

    /**
     * ⭐ 响应授权请求（手动模式）
     * 向后端发送授权响应
     */
    respondToPermission: async (approved: boolean) => {
      const { currentSessionId, permissionRequest } = get();

      if (!permissionRequest) {
        console.warn('[ChatStore] 无授权请求可响应');
        return;
      }

      try {
        console.log(`[ChatStore] 发送授权响应: ${approved ? '允许' : '拒绝'}`);

        await window.electronAPI.invoke(IPCChannels.CLAUDE_PERMISSION_RESPONSE, {
          sessionId: currentSessionId,
          approved,
        });

        // 清除授权请求
        set((state) => {
          state.permissionRequest = null;
        });

        console.log('[ChatStore] 授权响应已发送');
      } catch (error) {
        console.error('[ChatStore] 发送授权响应失败:', error);
        set((state) => {
          state.error = '授权响应失败';
        });
      }
    },

    /**
     * ⭐ 设置授权模式
     */
    setPermissionMode: (mode: 'manual' | 'auto') => {
      set((state) => {
        state.permissionMode = mode;
      });
      console.log(`[ChatStore] 授权模式已设置为: ${mode}`);
    },

    /**
     * ⭐ 获取或创建项目的会话 ID
     * 如果项目已有会话 ID,返回现有的；否则创建新的并保存
     */
    getOrCreateSessionForProject: (projectPath: string): string => {
      const { projectSessionMap } = get();

      // 检查是否已有该项目的 session
      if (projectSessionMap[projectPath]) {
        console.log(`[ChatStore] 恢复项目会话: ${projectPath} → ${projectSessionMap[projectPath]}`);
        return projectSessionMap[projectPath];
      }

      // 创建新的 session ID
      const newSessionId = generateUUID();
      console.log(`[ChatStore] 创建新项目会话: ${projectPath} → ${newSessionId}`);

      // 保存到 map
      set((state) => {
        state.projectSessionMap[projectPath] = newSessionId;
      });

      return newSessionId;
    },

    /**
     * ⭐ 切换到指定项目
     * 自动恢复该项目的会话 ID，或创建新的
     * 并加载历史聊天记录
     */
    switchToProject: async (projectPath: string | null) => {
      const currentProjectPath = get().currentProjectPath;

      // 🔥 关键优化：检测是否真的切换了项目
      if (currentProjectPath === projectPath) {
        console.log(`[ChatStore] 项目未变化 (${projectPath})，保持当前会话，不重新加载历史`);
        return; // 直接返回，保持当前消息不变
      }

      console.log(`[ChatStore] 项目切换: "${currentProjectPath}" → "${projectPath}"`);

      // ⭐⭐⭐ 在离开当前项目前，自动生成工作流
      if (currentProjectPath) {
        try {
          await get().generateWorkflowFromCurrentSession();
        } catch (error) {
          console.error('[ChatStore] 自动生成工作流失败:', error);
          // 不阻止项目切换，只记录错误
        }
      }

      if (!projectPath) {
        // 无项目：使用全局会话
        console.log('[ChatStore] 切换到无项目模式，使用全局会话');
        set((state) => {
          state.currentSessionId = state.currentSessionId || generateUUID();
          state.messages = [];  // 清空消息
          state.isLoading = false;
          state.currentProjectPath = null; // 🔥 更新当前项目路径
        });
        return;
      }

      // 有项目：恢复或创建项目会话
      const sessionId = get().getOrCreateSessionForProject(projectPath);

      console.log(`[ChatStore] 切换到项目: ${projectPath}, sessionId: ${sessionId}`);

      // ⭐ 加载该项目的历史消息
      try {
        set((state) => {
          state.currentSessionId = sessionId;
          state.messages = [];  // 先清空
          state.isLoading = true;
        });

        // 尝试从 History 加载会话
        const session = await window.electronAPI.invoke(IPCChannels.HISTORY_GET_SESSION, {
          projectPath,
          sessionId,
        });

        // ⭐⭐⭐ 不在这里创建 session！
        // 原因：避免与 saveSession 中的创建逻辑冲突
        // session 会在第一次发送消息时由 saveSession 自动创建

        if (session && session.messages && session.messages.length > 0) {
          console.log(`[ChatStore] 加载了 ${session.messages.length} 条历史消息`);

          // 转换消息格式
          const messages: Message[] = session.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            tokenUsage: msg.tokenUsage,
          }));

          set((state) => {
            state.messages = messages;
            state.isLoading = false;
            state.currentProjectPath = projectPath; // 🔥 更新当前项目路径
          });
        } else {
          console.log(`[ChatStore] 该项目暂无历史消息，已创建空会话`);
          set((state) => {
            state.isLoading = false;
            state.currentProjectPath = projectPath; // 🔥 更新当前项目路径
          });
        }
      } catch (error) {
        console.error('[ChatStore] 加载/创建会话失败:', error);
        set((state) => {
          state.isLoading = false;
          state.currentProjectPath = projectPath; // 🔥 即使出错也更新项目路径
        });
      }
    },

    /**
     * ⭐ 取消当前会话
     * 重置 isLoading 状态，防止 UI 一直显示"正在回复"
     */
    cancelSession: () => {
      console.log('[ChatStore] 取消会话，重置 loading 状态');
      set((state) => {
        state.isLoading = false;
        state.error = null;  // 清除现有错误
        state.isCancelling = true;  // ⭐ 设置取消标志，忽略后续的错误事件
      });

      // ⭐ 5秒后清除取消标志（确保后端的错误事件已经处理完）
      setTimeout(() => {
        set((state) => {
          state.isCancelling = false;
        });
      }, 5000);
    },

    /**
     * ⭐⭐⭐ 从当前会话自动生成工作流
     * 在离开项目前调用，将对话历史转换为可重用的工作流
     */
    generateWorkflowFromCurrentSession: async () => {
      const messages = get().messages;
      const currentProjectPath = get().currentProjectPath;

      console.log(`[ChatStore] 开始生成工作流检查 - 项目: ${currentProjectPath}, 消息数: ${messages.length}`);

      if (!currentProjectPath) {
        console.log('[ChatStore] ❌ 无当前项目，跳过工作流生成');
        return;
      }

      if (messages.length < 2) {
        console.log(`[ChatStore] ❌ 消息数量不足 (${messages.length} < 2)，跳过工作流生成`);
        return;
      }

      try {
        // 从项目Store获取项目名称
        const projectStore = useProjectStore.getState();
        const currentProject = projectStore.currentProject;
        const projectName = currentProject?.name || 'Unknown Project';

        console.log(`[ChatStore] 为项目 ${projectName} 生成工作流...`);

        // 准备消息数据（包括工具使用信息）
        const messagesWithToolUses = messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          toolUses: [], // TODO: 需要从实际数据中提取工具使用信息
        }));

        // 调用 IPC 生成工作流
        const result = await window.electronAPI.invoke(
          IPCChannels.WORKFLOW_GENERATE_FROM_CONVERSATION,
          {
            messages: messagesWithToolUses,
            projectPath: currentProjectPath,
            projectName,
          }
        );

        if (result.workflow) {
          console.log(`[ChatStore] ✅ 成功生成工作流: ${result.workflow.name} (${result.workflow.id})`);
        } else {
          console.log('[ChatStore] 未生成工作流（对话内容不足）');
        }
      } catch (error) {
        console.error('[ChatStore] 生成工作流失败:', error);
        throw error;
      }
    },
  })),
    {
      name: 'chat-storage', // localStorage key
      partialize: (state) => ({
        // ⭐ 只持久化 projectSessionMap，不持久化消息和临时状态
        projectSessionMap: state.projectSessionMap,
        permissionMode: state.permissionMode, // 也持久化授权模式设置
      }),
      // ⭐⭐⭐ 自动清理旧格式的 session ID（带 electron-app- 前缀的）
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return;

          console.log('[ChatStore] 检查 session ID 格式...');
          let needsCleanup = false;

          // 检查 currentSessionId
          if (state.currentSessionId?.startsWith('electron-app-')) {
            console.warn(`[ChatStore] ⚠️ 检测到旧格式 session ID: ${state.currentSessionId}`);
            needsCleanup = true;
          }

          // 检查 projectSessionMap
          for (const [path, sessionId] of Object.entries(state.projectSessionMap || {})) {
            if (sessionId.startsWith('electron-app-')) {
              console.warn(`[ChatStore] ⚠️ 项目 ${path} 使用旧格式 session ID: ${sessionId}`);
              needsCleanup = true;
            }
          }

          if (needsCleanup) {
            console.warn('[ChatStore] 🗑️ 清除所有旧格式 session ID，将重新生成标准 UUID');
            // 清空所有旧 session ID
            state.currentSessionId = generateUUID();
            state.projectSessionMap = {};
            console.log(`[ChatStore] ✅ 已生成新的 session ID: ${state.currentSessionId}`);
          } else {
            console.log('[ChatStore] ✅ Session ID 格式正确');
          }
        };
      },
    }
  )
);
