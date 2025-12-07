/**
 * Session Module - 会话管理
 * 负责会话的 CRUD、项目绑定、会话恢复等
 */

import { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import { IPCChannels } from '@shared/types/ipc.types';
import { SessionState, SessionActions, ChatState } from '../types';
import { generateUUID } from '../utils/uuid';
import { useProjectStore } from '../../projectStore';
import { useTerminalStore, SessionData } from '../../terminalStore';
import { generateSessionTitle } from '../../../services/sessionSummaryService';

export type SessionSlice = SessionState & SessionActions;

export const createSessionSlice: StateCreator<
  ChatState,
  [['zustand/immer', never]],
  [],
  SessionSlice
> = (set, get) => ({
  // State
  currentSessionId: generateUUID(),
  currentProjectPath: null,
  projectSessionMap: {},

  // Actions
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
        const messages = session.messages.map((msg: any) => ({
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
});
