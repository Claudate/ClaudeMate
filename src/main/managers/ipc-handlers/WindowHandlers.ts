/**
 * Window Handlers - 窗口操作相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';
import { WindowManager } from '../WindowManager';

export class WindowHandlers extends BaseHandler {
  private windowManager: WindowManager;

  constructor() {
    super('Window');
    this.windowManager = WindowManager.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    registerFn(IPCChannels.WINDOW_MINIMIZE, async () => {
      this.windowManager.minimizeMainWindow();
    });

    registerFn(IPCChannels.WINDOW_MAXIMIZE, async () => {
      this.windowManager.maximizeMainWindow();
    });

    registerFn(IPCChannels.WINDOW_CLOSE, async () => {
      this.windowManager.closeMainWindow();
    });

    registerFn(IPCChannels.WINDOW_IS_MAXIMIZED, async () => {
      return this.windowManager.isMaximized();
    });

    this.logger.info('Window IPC handlers registered');
  }
}
