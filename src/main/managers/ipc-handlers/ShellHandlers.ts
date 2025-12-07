/**
 * Shell Handlers - Shell 操作相关的 IPC 处理器
 */

import { shell, clipboard } from 'electron';
import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';

export class ShellHandlers extends BaseHandler {
  constructor() {
    super('Shell');
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    // 在浏览器中打开 URL
    registerFn(
      IPCChannels.SHELL_OPEN_URL,
      async (data: { url: string }) => {
        try {
          await shell.openExternal(data.url);
          this.logger.info(`Opened URL: ${data.url}`);
          return { success: true };
        } catch (error) {
          this.logger.error('Failed to open URL:', error);
          throw error;
        }
      }
    );

    // ⭐⭐⭐ 写入剪贴板
    registerFn(
      'clipboard:write-text' as IPCChannel,
      async (data: { text: string }) => {
        try {
          clipboard.writeText(data.text);
          return { success: true };
        } catch (error) {
          this.logger.error('Failed to write to clipboard:', error);
          throw error;
        }
      }
    );

    this.logger.info('Shell IPC handlers registered');
  }
}
