/**
 * Permission Module - 工具授权管理
 * 负责处理手动授权模式下的权限请求和响应
 */

import { StateCreator } from 'zustand';
import { IPCChannels } from '@shared/types/ipc.types';
import { PermissionState, PermissionActions, ChatState } from '../types';

export type PermissionSlice = PermissionState & PermissionActions;

export const createPermissionSlice: StateCreator<
  ChatState,
  [['zustand/immer', never]],
  [],
  PermissionSlice
> = (set, get) => ({
  // State
  permissionRequest: null,
  permissionMode: 'manual',

  // Actions
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
});
