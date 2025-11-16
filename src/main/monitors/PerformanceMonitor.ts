/**
 * Performance Monitor
 * Tracks CPU, memory, and other performance metrics
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { PerformanceStats } from '../../shared/types/ipc.types';

const logger = Logger.getInstance('PerformanceMonitor');

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private interval: NodeJS.Timeout | null = null;
  private checkIntervalMs = 5000; // Check every 5 seconds
  private startTime = Date.now();
  private lastCpuUsage = process.cpuUsage();

  private constructor() {
    super();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public start(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.collectStats();
    }, this.checkIntervalMs);

    logger.info('Performance monitor started');
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Performance monitor stopped');
    }
  }

  private collectStats(): void {
    const stats = this.getStats();
    this.emit('stats', stats);
  }

  public getStats(): PerformanceStats {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);

    // Calculate CPU percentage
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / (this.checkIntervalMs / 1000);

    this.lastCpuUsage = process.cpuUsage();

    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: Math.min(cpuPercent * 100, 100), // Percentage
      uptime: Date.now() - this.startTime,
      timestamp: Date.now(),
    };
  }
}
