/**
 * Memory Monitor
 * Monitors application memory usage and triggers warnings/cleanup
 * Prevents memory leaks and OOM errors
 */

import { app, BrowserWindow, ipcMain, dialog, shell, screen } from 'electron';

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { WindowManager } from '../managers/WindowManager';
import { IPCManager } from '../managers/IPCManager';

const logger = Logger.getInstance('MemoryMonitor');

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  timestamp: number;
}

export interface MemoryThresholds {
  warning: number; // MB
  critical: number; // MB
  emergency: number; // MB
}

export class MemoryMonitor extends EventEmitter {
  private static instance: MemoryMonitor;
  private interval: NodeJS.Timeout | null = null;
  private checkIntervalMs = 10000; // Check every 10 seconds
  private statsHistory: MemoryStats[] = [];
  private maxHistoryLength = 100;

  private thresholds: MemoryThresholds = {
    warning: 512, // 512 MB
    critical: 1024, // 1 GB
    emergency: 1536, // 1.5 GB
  };

  private lastWarningTime = 0;
  private warningCooldownMs = 60000; // 1 minute

  private constructor() {
    super();
  }

  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Start memory monitoring
   */
  public start(): void {
    if (this.interval) {
      logger.warn('Memory monitor already started');
      return;
    }

    this.interval = setInterval(() => {
      this.checkMemory();
    }, this.checkIntervalMs);

    logger.info('Memory monitor started');
  }

  /**
   * Stop memory monitoring
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Memory monitor stopped');
    }
  }

  /**
   * Check current memory usage
   */
  private checkMemory(): void {
    const memUsage = process.memoryUsage();
    const stats: MemoryStats = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now(),
    };

    // Add to history
    this.statsHistory.push(stats);
    if (this.statsHistory.length > this.maxHistoryLength) {
      this.statsHistory.shift();
    }

    const heapUsedMB = stats.heapUsed / 1024 / 1024;
    const rssMB = stats.rss / 1024 / 1024;

    // Check thresholds
    if (rssMB >= this.thresholds.emergency) {
      this.handleEmergency(rssMB);
    } else if (rssMB >= this.thresholds.critical) {
      this.handleCritical(rssMB);
    } else if (rssMB >= this.thresholds.warning) {
      this.handleWarning(rssMB);
    }

    // Emit stats for UI display
    this.emit('stats', stats);
  }

  /**
   * Handle warning level memory usage
   */
  private handleWarning(memoryMB: number): void {
    const now = Date.now();

    if (now - this.lastWarningTime < this.warningCooldownMs) {
      return; // Cooldown
    }

    this.lastWarningTime = now;

    logger.warn(`Memory usage warning: ${memoryMB.toFixed(2)} MB`);

    // Notify renderer
    const ipcManager = IPCManager.getInstance();
    ipcManager.sendToRenderer('memory:warning', {
      level: 'warning',
      usage: memoryMB,
      threshold: this.thresholds.warning,
    });

    this.emit('warning', memoryMB);
  }

  /**
   * Handle critical level memory usage
   */
  private handleCritical(memoryMB: number): void {
    logger.error(`Critical memory usage: ${memoryMB.toFixed(2)} MB`);

    // Notify renderer
    const ipcManager = IPCManager.getInstance();
    ipcManager.sendToRenderer('memory:critical', {
      level: 'critical',
      usage: memoryMB,
      threshold: this.thresholds.critical,
    });

    // Attempt to free memory
    this.tryCleanup();

    this.emit('critical', memoryMB);
  }

  /**
   * Handle emergency level memory usage
   */
  private handleEmergency(memoryMB: number): void {
    logger.error(`EMERGENCY: Memory usage at ${memoryMB.toFixed(2)} MB, forcing cleanup!`);

    // Aggressive cleanup
    this.forceCleanup();

    // Notify renderer
    const ipcManager = IPCManager.getInstance();
    ipcManager.sendToRenderer('memory:emergency', {
      level: 'emergency',
      usage: memoryMB,
      threshold: this.thresholds.emergency,
    });

    this.emit('emergency', memoryMB);

    // If still too high after cleanup, consider restarting
    setTimeout(() => {
      const newUsage = process.memoryUsage().rss / 1024 / 1024;
      if (newUsage >= this.thresholds.emergency) {
        logger.error('Memory usage still critical after cleanup, app may need restart');
        // Optionally: app.relaunch(); app.quit();
      }
    }, 5000);
  }

  /**
   * Try to free memory (non-aggressive)
   */
  private tryCleanup(): void {
    logger.info('Attempting memory cleanup...');

    try {
      // Clear window cache
      const windowManager = WindowManager.getInstance();
      windowManager.clearCache().catch(err => {
        logger.error('Failed to clear window cache:', err);
      });

      // Force garbage collection (if --expose-gc flag is set)
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }

      // Clear some history
      if (this.statsHistory.length > 50) {
        this.statsHistory = this.statsHistory.slice(-50);
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Force aggressive memory cleanup
   */
  private forceCleanup(): void {
    logger.info('Forcing aggressive memory cleanup...');

    try {
      // Clear all caches
      const windowManager = WindowManager.getInstance();
      windowManager.clearCache().catch(err => {
        logger.error('Failed to clear cache:', err);
      });

      // Force GC multiple times
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
        }
        logger.info('Multiple GC cycles triggered');
      }

      // Clear history
      this.statsHistory = [];

      // Notify renderer to cleanup
      const ipcManager = IPCManager.getInstance();
      ipcManager.sendToRenderer('memory:force-cleanup');
    } catch (error) {
      logger.error('Error during force cleanup:', error);
    }
  }

  /**
   * Get current memory stats
   */
  public getCurrentStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now(),
    };
  }

  /**
   * Get stats history
   */
  public getHistory(): MemoryStats[] {
    return [...this.statsHistory];
  }

  /**
   * Get memory trend (increasing/decreasing)
   */
  public getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.statsHistory.length < 10) {
      return 'stable';
    }

    const recent = this.statsHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    if (!first || !last) {
      return 'stable';
    }

    const diff = last.rss - first.rss;
    const threshold = 50 * 1024 * 1024; // 50 MB

    if (diff > threshold) {
      return 'increasing';
    } else if (diff < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Set custom thresholds
   */
  public setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Memory thresholds updated:', this.thresholds);
  }

  /**
   * Get current thresholds
   */
  public getThresholds(): MemoryThresholds {
    return { ...this.thresholds };
  }
}
