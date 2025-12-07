/**
 * Message Module - 消息管理
 * 负责消息的增删改查、流式处理、Claude CLI 执行
 */

import { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import { IPCChannels } from '@shared/types/ipc.types';
import { ToolPermissionRequest } from '@shared/types/domain.types';
import { MessageState, MessageActions, ChatState, Message } from '../types';
import { generateUUID } from '../utils/uuid';
import { useProjectStore } from '../../projectStore';
import { useTerminalStore } from '../../terminalStore';

export type MessageSlice = MessageState & MessageActions;

export const createMessageSlice: StateCreator<
  ChatState,
  [['zustand/immer', never]],
  [],
  MessageSlice
> = (set, get) => ({
  // State
  messages: [],
  isLoading: false,
  isCancelling: false,
  pendingInput: '',
  error: null,

  // Actions
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
});
