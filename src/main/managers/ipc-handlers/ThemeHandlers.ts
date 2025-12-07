/**
 * Theme Handlers - 主题管理相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';

export class ThemeHandlers extends BaseHandler {
  constructor() {
    super('Theme');
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void,
    sendToRenderer?: (channel: string, ...args: unknown[]) => void
  ): void {
    const { nativeTheme } = require('electron');

    // 获取主题
    registerFn(IPCChannels.THEME_GET, async () => {
      return {
        theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
        systemTheme: nativeTheme.themeSource,
      };
    });

    // 设置主题
    registerFn(IPCChannels.THEME_SET, async (data: { theme: 'light' | 'dark' | 'system' }) => {
      nativeTheme.themeSource = data.theme;

      // 通知渲染进程主题变化
      if (sendToRenderer) {
        sendToRenderer('theme:changed', {
          theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
          systemTheme: nativeTheme.themeSource,
        });
      }

      return { success: true };
    });

    this.logger.info('Theme IPC handlers registered');
  }
}
