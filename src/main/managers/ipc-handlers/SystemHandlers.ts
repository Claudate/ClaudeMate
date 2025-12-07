/**
 * System Handlers - 系统信息相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';

export class SystemHandlers extends BaseHandler {
  constructor() {
    super('System');
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    registerFn(IPCChannels.SYSTEM_INFO, async () => {
      return {
        platform: process.platform,
        arch: process.arch,
        version: process.getSystemVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromiumVersion: process.versions.chrome,
      };
    });

    registerFn(IPCChannels.SYSTEM_MEMORY, async () => {
      return process.memoryUsage();
    });

    registerFn(IPCChannels.SYSTEM_CPU, async () => {
      return process.cpuUsage();
    });

    this.logger.info('System IPC handlers registered');
  }
}
