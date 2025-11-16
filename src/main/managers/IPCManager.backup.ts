/**
 * IPC Manager
 * Centralized and type-safe IPC communication handler
 * Implements security checks and validation
 */

import { app, BrowserWindow, ipcMain, dialog, shell, screen } from 'electron';

import { z, ZodSchema } from 'zod';
import {
  IPCChannels,
  IPCChannel,
  IPCResponse,
  IPCError,
  IPCErrorCode,
  IPCHandler,
} from '../../shared/types/ipc.types';
import { Logger } from '../utils/Logger';
import { WindowManager } from './WindowManager';
import { PerformanceMonitor } from '../monitors/PerformanceMonitor';

const logger = Logger.getInstance('IPCManager');

export class IPCManager {
  private static instance: IPCManager;
  private handlers = new Map<IPCChannel, IPCHandler>();
  private validators = new Map<IPCChannel, ZodSchema>();
  private rateLimiters = new Map<string, number[]>();

  private constructor() {}

  public static getInstance(): IPCManager {
    if (!IPCManager.instance) {
      IPCManager.instance = new IPCManager();
    }
    return IPCManager.instance;
  }

  /**
   * Register a type-safe IPC handler with optional validation
   */
  public register<TInput, TOutput>(
    channel: IPCChannel,
    handler: IPCHandler<TInput, TOutput>,
    validator?: ZodSchema<TInput>
  ): void {
    if (this.handlers.has(channel)) {
      logger.warn(`Handler for channel ${channel} already registered, overwriting`);
    }

    this.handlers.set(channel, handler as IPCHandler);

    if (validator) {
      this.validators.set(channel, validator);
    }

    logger.debug(`Registered handler for channel: ${channel}`);
  }

  /**
   * Register all application IPC handlers
   */
  public async registerHandlers(): Promise<void> {
    // Window management
    this.registerWindowHandlers();

    // System information
    this.registerSystemHandlers();

    // Performance monitoring
    this.registerPerformanceHandlers();

    // Setup main IPC invoke handler with security and validation
    ipcMain.handle('ipc:invoke', async (event: IpcMainInvokeEvent, channel: string, data: unknown) => {
      return this.handleInvoke(event, channel as IPCChannel, data);
    });

    logger.info('All IPC handlers registered');
  }

  /**
   * Main IPC invoke handler with security, validation, and error handling
   */
  private async handleInvoke(
    event: IpcMainInvokeEvent,
    channel: IPCChannel,
    data: unknown
  ): Promise<IPCResponse> {
    const startTime = Date.now();
    const requestId = `${channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Security: Check if sender is from main window
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();

      if (!mainWindow || event.sender !== mainWindow.webContents) {
        throw new IPCError(
          IPCErrorCode.PERMISSION_DENIED,
          'IPC call from unauthorized source'
        );
      }

      // Rate limiting
      if (!this.checkRateLimit(channel)) {
        throw new IPCError(
          IPCErrorCode.TIMEOUT,
          'Too many requests, please slow down'
        );
      }

      // Get handler
      const handler = this.handlers.get(channel);
      if (!handler) {
        throw new IPCError(
          IPCErrorCode.INVALID_REQUEST,
          `No handler registered for channel: ${channel}`
        );
      }

      // Validate input data
      const validator = this.validators.get(channel);
      let validatedData = data;

      if (validator) {
        const result = validator.safeParse(data);
        if (!result.success) {
          throw new IPCError(
            IPCErrorCode.VALIDATION_ERROR,
            'Invalid request data',
            result.error.errors
          );
        }
        validatedData = result.data;
      }

      // Execute handler
      const result = await Promise.race([
        handler(validatedData),
        this.createTimeout(channel),
      ]);

      const duration = Date.now() - startTime;
      logger.debug(`IPC ${channel} completed in ${duration}ms`);

      return {
        success: true,
        data: result,
        requestId,
        timestamp: Date.now(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`IPC ${channel} failed in ${duration}ms:`, error);

      if (error instanceof IPCError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          },
          requestId,
          timestamp: Date.now(),
        };
      }

      return {
        success: false,
        error: {
          code: IPCErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
        },
        requestId,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Rate limiting: Max 100 requests per channel per second
   */
  private checkRateLimit(channel: IPCChannel): boolean {
    const now = Date.now();
    const requests = this.rateLimiters.get(channel) ?? [];

    // Remove requests older than 1 second
    const recentRequests = requests.filter(time => now - time < 1000);

    if (recentRequests.length >= 100) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimiters.set(channel, recentRequests);
    return true;
  }

  /**
   * Create timeout promise for IPC handlers
   */
  private createTimeout(channel: IPCChannel): Promise<never> {
    const timeout = channel.startsWith('claude:') ? 60000 : 10000; // 60s for Claude, 10s for others

    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new IPCError(IPCErrorCode.TIMEOUT, `Request timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Register window management handlers
   */
  private registerWindowHandlers(): void {
    const windowManager = WindowManager.getInstance();

    this.register(IPCChannels.WINDOW_MINIMIZE, async () => {
      windowManager.minimizeMainWindow();
    });

    this.register(IPCChannels.WINDOW_MAXIMIZE, async () => {
      windowManager.maximizeMainWindow();
    });

    this.register(IPCChannels.WINDOW_CLOSE, async () => {
      windowManager.closeMainWindow();
    });

    this.register(IPCChannels.WINDOW_IS_MAXIMIZED, async () => {
      return windowManager.isMaximized();
    });
  }

  /**
   * Register system information handlers
   */
  private registerSystemHandlers(): void {
    this.register(IPCChannels.SYSTEM_INFO, async () => {
      return {
        platform: process.platform,
        arch: process.arch,
        version: process.getSystemVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromiumVersion: process.versions.chrome,
      };
    });

    this.register(IPCChannels.SYSTEM_MEMORY, async () => {
      return process.memoryUsage();
    });

    this.register(IPCChannels.SYSTEM_CPU, async () => {
      return process.cpuUsage();
    });
  }

  /**
   * Register performance monitoring handlers
   */
  private registerPerformanceHandlers(): void {
    const perfMonitor = PerformanceMonitor.getInstance();

    this.register(IPCChannels.PERF_MONITOR_START, async () => {
      perfMonitor.start();
    });

    this.register(IPCChannels.PERF_MONITOR_STOP, async () => {
      perfMonitor.stop();
    });

    this.register(IPCChannels.PERF_STATS, async () => {
      return perfMonitor.getStats();
    });
  }

  /**
   * Send event to renderer process (one-way communication)
   */
  public sendToRenderer(channel: string, ...args: unknown[]): void {
    const windowManager = WindowManager.getInstance();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  }

  /**
   * Cleanup: Remove all handlers
   */
  public cleanup(): void {
    ipcMain.removeHandler('ipc:invoke');
    this.handlers.clear();
    this.validators.clear();
    this.rateLimiters.clear();
    logger.info('IPC Manager cleaned up');
  }
}
