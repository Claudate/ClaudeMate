/**
 * Chat Store - Enhanced with modular architecture
 * Manages chat messages and Claude CLI interactions
 *
 * 重构说明:
 * - 将 975 行的单一文件拆分为 6 个独立模块
 * - 每个模块负责一类功能(高内聚)
 * - 模块之间相互独立(低耦合)
 * - 核心 chatStore 只负责聚合和配置中间件
 *
 * 参照 WPF 的项目上下文模式:
 * - 每个项目目录都有独立的 Claude CLI 会话
 * - 切换项目时自动切换会话历史
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import {
  createMessageSlice,
  createSessionSlice,
  createPermissionSlice,
  createSessionLimitSlice,
  createTerminalSlice,
  createWorkflowSlice,
} from './chat/modules';
import { ChatState } from './chat/types';
import { generateUUID } from './chat/utils/uuid';

/**
 * Chat Store - 核心 Store
 * 聚合所有模块，提供统一的对外接口
 */
export const useChatStore = create<ChatState>()(
  persist(
    immer((set, get) => ({
      // 组合所有模块
      ...createMessageSlice(set, get),
      ...createSessionSlice(set, get),
      ...createPermissionSlice(set, get),
      ...createSessionLimitSlice(set, get),
      ...createTerminalSlice(set, get),
      ...createWorkflowSlice(set, get),
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

// 导出类型供外部使用
export type { Message, TokenUsage, ChatState } from './chat/types';
