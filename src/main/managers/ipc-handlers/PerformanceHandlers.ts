/**
 * Performance Handlers - 性能监控相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';
import { PerformanceMonitor } from '../../monitors/PerformanceMonitor';

export class PerformanceHandlers extends BaseHandler {
  private perfMonitor: PerformanceMonitor;

  constructor() {
    super('Performance');
    this.perfMonitor = PerformanceMonitor.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    registerFn(IPCChannels.PERF_MONITOR_START, async () => {
      this.perfMonitor.start();
    });

    registerFn(IPCChannels.PERF_MONITOR_STOP, async () => {
      this.perfMonitor.stop();
    });

    registerFn(IPCChannels.PERF_STATS, async () => {
      return this.perfMonitor.getStats();
    });

    this.logger.info('Performance IPC handlers registered');
  }
}
