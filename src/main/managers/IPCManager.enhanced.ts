/**
 * IPC Manager - Enhanced with Claude CLI integration
 * Centralized and type-safe IPC communication handler
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
  ClaudeExecuteSchema,
} from '../../shared/types/ipc.types';
import { Logger } from '../utils/Logger';
import { WindowManager } from './WindowManager';
import { PerformanceMonitor } from '../monitors/PerformanceMonitor';
import { ClaudeService, ClaudeStreamChunk } from '../services/ClaudeService';

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

  public async registerHandlers(): Promise<void> {
    this.registerWindowHandlers();
    this.registerSystemHandlers();
    this.registerPerformanceHandlers();
    this.registerClaudeHandlers(); // ⭐ New!

    ipcMain.handle('ipc:invoke', async (event: IpcMainInvokeEvent, channel: string, data: unknown) => {
      return this.handleInvoke(event, channel as IPCChannel, data);
    });

    logger.info('All IPC handlers registered');
  }

  private async handleInvoke(
    event: IpcMainInvokeEvent,
    channel: IPCChannel,
    data: unknown
  ): Promise<IPCResponse> {
    const startTime = Date.now();
    const requestId = `${channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();

      if (!mainWindow || event.sender !== mainWindow.webContents) {
        throw new IPCError(
          IPCErrorCode.PERMISSION_DENIED,
          'IPC call from unauthorized source'
        );
      }

      if (!this.checkRateLimit(channel)) {
        throw new IPCError(
          IPCErrorCode.TIMEOUT,
          'Too many requests, please slow down'
        );
      }

      const handler = this.handlers.get(channel);
      if (!handler) {
        throw new IPCError(
          IPCErrorCode.INVALID_REQUEST,
          `No handler registered for channel: ${channel}`
        );
      }

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

  private checkRateLimit(channel: IPCChannel): boolean {
    const now = Date.now();
    const requests = this.rateLimiters.get(channel) ?? [];

    const recentRequests = requests.filter(time => now - time < 1000);

    if (recentRequests.length >= 100) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimiters.set(channel, recentRequests);
    return true;
  }

  private createTimeout(channel: IPCChannel): Promise<never> {
    const timeout = channel.startsWith('claude:') ? 60000 : 10000;

    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new IPCError(IPCErrorCode.TIMEOUT, `Request timeout after ${timeout}ms`));
      }, timeout);
    });
  }

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
   * ⭐ Register Claude CLI handlers
   */
  private registerClaudeHandlers(): void {
    const claudeService = ClaudeService.getInstance();

    // Execute Claude CLI command
    this.register(
      IPCChannels.CLAUDE_EXECUTE,
      async (data: { message: string; sessionId?: string; model?: 'opus' | 'sonnet' | 'haiku'; cwd?: string }) => {
        const { message, sessionId, model, cwd } = data;

        logger.info(`Executing Claude CLI for session: ${sessionId || 'default'}`);

        const response = await claudeService.execute({
          message,
          sessionId: sessionId || 'default',
          model,
          cwd,
        });

        return { response };
      },
      ClaudeExecuteSchema
    );

    // Cancel Claude execution
    this.register(
      IPCChannels.CLAUDE_CANCEL,
      async (data: { sessionId: string }) => {
        const { sessionId } = data;
        const canceled = claudeService.cancel(sessionId);
        logger.info(`Claude session ${sessionId} cancel result: ${canceled}`);
        return { canceled };
      }
    );

    // Setup streaming event forwarding
    claudeService.on('stream', (sessionId: string, chunk: ClaudeStreamChunk) => {
      this.sendToRenderer('claude:stream', { sessionId, chunk });
    });

    logger.info('Claude IPC handlers registered');
  }

  public sendToRenderer(channel: string, ...args: unknown[]): void {
    const windowManager = WindowManager.getInstance();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  }

  public cleanup(): void {
    ipcMain.removeHandler('ipc:invoke');
    this.handlers.clear();
    this.validators.clear();
    this.rateLimiters.clear();
    logger.info('IPC Manager cleaned up');
  }
}
