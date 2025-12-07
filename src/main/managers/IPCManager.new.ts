/**
 * IPC Manager - Enhanced with modular handler architecture
 * Centralized and type-safe IPC communication handler
 *
 * 重构说明：
 * - 将 1479 行的单一文件拆分为 13 个独立的 Handler 模块
 * - 每个 Handler 模块负责一类功能（高内聚）
 * - Handler 之间相互独立（低耦合）
 * - 核心 IPCManager 只负责注册、调度和错误处理
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ZodSchema } from 'zod';
import {
  IPCChannel,
  IPCResponse,
  IPCError,
  IPCErrorCode,
  IPCHandler,
} from '../../shared/types/ipc.types';
import { Logger } from '../utils/Logger';
import { WindowManager } from './WindowManager';

// 导入所有 Handler 模块
import {
  WindowHandlers,
  SystemHandlers,
  PerformanceHandlers,
  ThemeHandlers,
  ClaudeHandlers,
  DatabaseHandlers,
  FileSystemHandlers,
  ShellHandlers,
  WorkflowHandlers,
  HistoryHandlers,
  SkillHandlers,
  GitHubSyncHandlers,
  ClaudeCodeImportHandlers,
} from './ipc-handlers';

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
   * 注册单个 handler（供 Handler 模块使用）
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
   * 注册所有 handlers（模块化）
   */
  public async registerHandlers(): Promise<void> {
    const registerFn = this.register.bind(this);
    const sendToRenderer = this.sendToRenderer.bind(this);

    // 初始化所有 Handler 模块
    const windowHandlers = new WindowHandlers();
    const systemHandlers = new SystemHandlers();
    const perfHandlers = new PerformanceHandlers();
    const themeHandlers = new ThemeHandlers();
    const claudeHandlers = new ClaudeHandlers();
    const databaseHandlers = new DatabaseHandlers();
    const fileSystemHandlers = new FileSystemHandlers();
    const shellHandlers = new ShellHandlers();
    const workflowHandlers = new WorkflowHandlers();
    const historyHandlers = new HistoryHandlers();
    const skillHandlers = new SkillHandlers();
    const githubSyncHandlers = new GitHubSyncHandlers();
    const claudeCodeImportHandlers = new ClaudeCodeImportHandlers();

    // 注册所有 handlers
    windowHandlers.register(registerFn);
    systemHandlers.register(registerFn);
    perfHandlers.register(registerFn);
    themeHandlers.register(registerFn, sendToRenderer);
    claudeHandlers.register(registerFn, sendToRenderer);
    databaseHandlers.register(registerFn);
    fileSystemHandlers.register(registerFn);
    shellHandlers.register(registerFn);
    workflowHandlers.register(registerFn, sendToRenderer);
    historyHandlers.register(registerFn);
    skillHandlers.register(registerFn);
    githubSyncHandlers.register(registerFn, sendToRenderer);
    claudeCodeImportHandlers.register(registerFn, sendToRenderer);

    // 注册统一的 IPC 调用入口
    ipcMain.handle('ipc:invoke', async (event: IpcMainInvokeEvent, channel: string, data: unknown) => {
      return this.handleInvoke(event, channel as IPCChannel, data);
    });

    logger.info('All IPC handlers registered successfully');
  }

  /**
   * 核心 IPC 调用处理（验证、限流、超时、错误处理）
   */
  private async handleInvoke(
    event: IpcMainInvokeEvent,
    channel: IPCChannel,
    data: unknown
  ): Promise<IPCResponse> {
    const startTime = Date.now();
    const requestId = `${channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 安全检查：确保调用来自主窗口
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();

      if (!mainWindow || event.sender !== mainWindow.webContents) {
        throw new IPCError(
          IPCErrorCode.PERMISSION_DENIED,
          'IPC call from unauthorized source'
        );
      }

      // 限流检查
      if (!this.checkRateLimit(channel)) {
        throw new IPCError(
          IPCErrorCode.TIMEOUT,
          'Too many requests, please slow down'
        );
      }

      // 获取 handler
      const handler = this.handlers.get(channel);
      if (!handler) {
        throw new IPCError(
          IPCErrorCode.INVALID_REQUEST,
          `No handler registered for channel: ${channel}`
        );
      }

      // 数据验证
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

      // 执行 handler（带超时控制）
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
   * 限流检查（防止恶意调用）
   */
  private checkRateLimit(channel: IPCChannel): boolean {
    const now = Date.now();
    const requests = this.rateLimiters.get(channel) ?? [];

    // 保留最近 1 秒内的请求
    const recentRequests = requests.filter(time => now - time < 1000);

    // 限制：每秒最多 100 个请求
    if (recentRequests.length >= 100) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimiters.set(channel, recentRequests);
    return true;
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(channel: IPCChannel): Promise<never> {
    // Claude 相关操作超时 60 秒，其他操作 10 秒
    const timeout = channel.startsWith('claude:') ? 60000 : 10000;

    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new IPCError(IPCErrorCode.TIMEOUT, `Request timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * 向渲染进程发送消息
   */
  public sendToRenderer(channel: string, ...args: unknown[]): void {
    const windowManager = WindowManager.getInstance();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    ipcMain.removeHandler('ipc:invoke');
    this.handlers.clear();
    this.validators.clear();
    this.rateLimiters.clear();
    logger.info('IPC Manager cleaned up');
  }
}
