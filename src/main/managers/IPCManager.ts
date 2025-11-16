/**
 * IPC Manager - Enhanced with Claude CLI integration
 * Centralized and type-safe IPC communication handler
 */

import { BrowserWindow, ipcMain, dialog, shell, screen, IpcMainInvokeEvent } from 'electron';

import { z, ZodSchema } from 'zod';
import {
  IPCChannels,
  IPCChannel,
  IPCResponse,
  IPCError,
  IPCErrorCode,
  IPCHandler,
  ClaudeExecuteSchema,
  HistoryCreateSessionSchema,
  HistoryGetSessionSchema,
  HistorySaveMessageSchema,
  HistoryDeleteSessionSchema,
  HistorySearchSessionsSchema,
  HistoryUpdateTitleSchema,
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
    this.registerThemeHandlers(); // ⭐ Theme management!
    this.registerClaudeHandlers(); // ⭐ New!
    this.registerDatabaseHandlers(); // ⭐ Database persistence!
    this.registerFileSystemHandlers(); // ⭐ File system operations!
    this.registerShellHandlers(); // ⭐ Shell operations!
    this.registerWorkflowHandlers(); // ⭐ Workflow management!
    this.registerHistoryHandlers(); // ⭐ Chat History management!

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
   * ⭐ Register Theme handlers
   */
  private registerThemeHandlers(): void {
    // Get theme
    this.register(IPCChannels.THEME_GET, async () => {
      const { nativeTheme } = require('electron');
      return {
        theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
        systemTheme: nativeTheme.themeSource,
      };
    });

    // Set theme
    this.register(IPCChannels.THEME_SET, async (data: { theme: 'light' | 'dark' | 'system' }) => {
      const { nativeTheme } = require('electron');
      nativeTheme.themeSource = data.theme;

      // Notify renderer of theme change
      this.sendToRenderer('theme:changed', {
        theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
        systemTheme: nativeTheme.themeSource,
      });

      return { success: true };
    });

    logger.info('Theme IPC handlers registered');
  }

  /**
   * ⭐ Register Claude CLI handlers
   */
  private registerClaudeHandlers(): void {
    const claudeService = ClaudeService.getInstance();

    // Check if Claude CLI is available
    this.register(
      IPCChannels.CLAUDE_CHECK_AVAILABLE,
      async () => {
        logger.info('Checking if Claude CLI is available');
        const isAvailable = await claudeService.isAvailable();
        logger.info(`Claude CLI availability result: ${isAvailable}`);
        const result = { isAvailable };
        logger.info(`Returning result object:`, JSON.stringify(result));
        return result;
      }
    );

    // Check authentication status
    this.register(
      IPCChannels.CLAUDE_CHECK_AUTH,
      async () => {
        logger.info('Checking Claude CLI authentication status');
        const authStatus = await claudeService.checkAuth();
        return authStatus;
      }
    );

    // Login to Claude CLI
    this.register(
      IPCChannels.CLAUDE_LOGIN,
      async () => {
        logger.info('Starting Claude CLI login process');
        const success = await claudeService.login();
        return { success };
      }
    );

    // Logout from Claude CLI
    this.register(
      IPCChannels.CLAUDE_LOGOUT,
      async () => {
        logger.info('Starting Claude CLI logout process');
        const success = await claudeService.logout();
        return { success };
      }
    );

    // Execute Claude CLI command
    this.register(
      IPCChannels.CLAUDE_EXECUTE,
      async (data: { message: string; sessionId?: string; model?: 'opus' | 'sonnet' | 'haiku'; cwd?: string; permissionMode?: 'manual' | 'auto' }) => {
        const { message, sessionId, model, cwd, permissionMode } = data;

        logger.info(`Executing Claude CLI for session: ${sessionId || 'default'}, permissionMode: ${permissionMode || 'auto'}`);

        const response = await claudeService.execute({
          message,
          sessionId: sessionId || 'default',
          model,
          cwd,
          permissionMode, // ⭐ 传递授权模式
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

    // ⭐ 响应授权请求（手动模式）
    this.register(
      IPCChannels.CLAUDE_PERMISSION_RESPONSE,
      async (data: { sessionId: string; approved: boolean }) => {
        const { sessionId, approved } = data;
        logger.info(`Received permission response for session ${sessionId}: ${approved ? 'approved' : 'denied'}`);

        const success = claudeService.respondToPermission(sessionId, approved);
        return { success };
      }
    );

    // Setup streaming event forwarding
    claudeService.on('stream', (sessionId: string, chunk: ClaudeStreamChunk) => {
      this.sendToRenderer('claude:stream', { sessionId, chunk });
    });

    // ⭐ Setup permission request event forwarding (手动模式)
    claudeService.on('permission_request', (sessionId: string, request: any) => {
      logger.info(`Forwarding permission request to renderer:`, request);
      this.sendToRenderer(IPCChannels.CLAUDE_PERMISSION_REQUEST, { sessionId, request });
    });

    logger.info('Claude IPC handlers registered');
  }

  /**
   * ⭐ Register Database handlers for data persistence
   */
  private registerDatabaseHandlers(): void {
    const dbService = require('../services/DatabaseService').DatabaseService.getInstance();

    // Session handlers
    this.register(IPCChannels.SESSION_LIST, async () => {
      return await dbService.getSessions();
    });

    this.register(IPCChannels.SESSION_CREATE, async (data: any) => {
      await dbService.createSession(data);
      return { success: true };
    });

    this.register(IPCChannels.SESSION_LOAD, async (data: { id: string }) => {
      return await dbService.getSession(data.id);
    });

    this.register(IPCChannels.SESSION_SAVE, async (data: { id: string; updates: any }) => {
      await dbService.updateSession(data.id, data.updates);
      return { success: true };
    });

    this.register(IPCChannels.SESSION_DELETE, async (data: { id: string }) => {
      await dbService.deleteSession(data.id);
      return { success: true };
    });

    // Project handlers
    this.register(IPCChannels.PROJECT_LIST, async () => {
      return await dbService.getProjects();
    });

    this.register(IPCChannels.PROJECT_CREATE, async (data: any) => {
      await dbService.createProject(data);
      return { success: true };
    });

    this.register(IPCChannels.PROJECT_OPEN, async (data: { id: string }) => {
      const project = await dbService.getProject(data.id);
      if (project) {
        await dbService.updateProject(data.id, {
          lastOpened: Date.now(),
          isActive: true
        });
      }
      return project;
    });

    this.register(IPCChannels.PROJECT_DELETE, async (data: { id: string }) => {
      await dbService.deleteProject(data.id);
      return { success: true };
    });

    // Settings handlers
    this.register(IPCChannels.SETTINGS_GET, async () => {
      return await dbService.getSettings();
    });

    this.register(IPCChannels.SETTINGS_SET, async (data: any) => {
      await dbService.updateSettings(data);
      return { success: true };
    });

    logger.info('Database IPC handlers registered');
  }

  /**
   * ⭐ Register File System handlers
   */
  private registerFileSystemHandlers(): void {
    const fsService = require('../services/FileSystemService').FileSystemService.getInstance();

    // Read file
    this.register(
      IPCChannels.FS_READ_FILE,
      async (data: { path: string; encoding?: 'utf8' | 'binary' | 'base64' }) => {
        // ⭐⭐⭐ 支持 base64 编码（用于图片）
        if (data.encoding === 'base64') {
          const fs = require('fs').promises;
          const buffer = await fs.readFile(data.path);
          const content = buffer.toString('base64');
          return { content };
        }

        // 默认使用 fsService
        const content = await fsService.readFile(data);
        return { content };
      }
    );

    // Write file
    this.register(
      IPCChannels.FS_WRITE_FILE,
      async (data: { path: string; content: string; encoding?: 'utf8' | 'binary' }) => {
        await fsService.writeFile(data);
        return { success: true };
      }
    );

    // Delete file
    this.register(IPCChannels.FS_DELETE_FILE, async (data: { path: string }) => {
      await fsService.deleteFile(data.path);
      return { success: true };
    });

    // Create file
    this.register(
      IPCChannels.FS_CREATE_FILE,
      async (data: { path: string; content?: string }) => {
        const fs = require('fs').promises;
        const path = require('path');

        // 确保父目录存在
        const dir = path.dirname(data.path);
        await fs.mkdir(dir, { recursive: true });

        // 创建文件
        await fs.writeFile(data.path, data.content || '', 'utf8');
        return { success: true, path: data.path };
      }
    );

    // Create folder
    this.register(
      IPCChannels.FS_CREATE_FOLDER,
      async (data: { path: string }) => {
        const fs = require('fs').promises;
        await fs.mkdir(data.path, { recursive: true });
        return { success: true, path: data.path };
      }
    );

    // ⭐⭐⭐ Delete file or folder (递归删除)
    this.register(
      IPCChannels.FS_DELETE,
      async (data: { path: string }) => {
        const fs = require('fs').promises;
        await fs.rm(data.path, { recursive: true, force: true });
        return { success: true };
      }
    );

    // ⭐⭐⭐ Copy file or folder (递归复制)
    this.register(
      IPCChannels.FS_COPY,
      async (data: { source: string; destination: string }) => {
        const fs = require('fs').promises;
        await fs.cp(data.source, data.destination, { recursive: true });
        return { success: true };
      }
    );

    // ⭐⭐⭐ Move file or folder (重命名/移动)
    this.register(
      IPCChannels.FS_MOVE,
      async (data: { source: string; destination: string }) => {
        const fs = require('fs').promises;
        await fs.rename(data.source, data.destination);
        return { success: true };
      }
    );

    // ⭐⭐⭐ Reveal in file explorer (在文件管理器中显示)
    this.register(
      IPCChannels.FS_REVEAL_IN_EXPLORER,
      async (data: { path: string }) => {
        const { shell } = require('electron');
        shell.showItemInFolder(data.path);
        return { success: true };
      }
    );

    // List directory
    this.register(
      IPCChannels.FS_LIST_DIRECTORY,
      async (data: { path: string; recursive?: boolean }) => {
        return await fsService.listDirectory(data);
      }
    );

    // Open file dialog
    this.register(IPCChannels.FS_OPEN_FILE_DIALOG, async () => {
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();

      if (!mainWindow) {
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, 'Main window not found');
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text Files', extensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      return { canceled: false, filePath: result.filePaths[0] };
    });

    // Open folder dialog
    this.register(IPCChannels.FS_OPEN_FOLDER_DIALOG, async () => {
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();

      if (!mainWindow) {
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, 'Main window not found');
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      return { canceled: false, folderPath: result.filePaths[0] };
    });

    // ⭐⭐⭐ Generic file dialog with custom options (用于图片选择等)
    this.register('dialog:open-file' as IPCChannel, async (data: {
      filters?: { name: string; extensions: string[] }[];
      properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
    }) => {
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();

      if (!mainWindow) {
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, 'Main window not found');
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: data.properties || ['openFile'],
        filters: data.filters || [{ name: 'All Files', extensions: ['*'] }],
      });

      return { canceled: result.canceled, filePaths: result.filePaths };
    });

    // ⭐⭐⭐ Check if clipboard has files (检查剪贴板是否有文件)
    // 优化：使用缓存 + 非阻塞检查，避免卡顿
    let clipboardCache: { hasFiles: boolean; lastCheck: number } = { hasFiles: false, lastCheck: 0 };
    const CACHE_DURATION = 500; // 500ms 缓存

    this.register('clipboard:has-files' as IPCChannel, async () => {
      try {
        const now = Date.now();

        // ⭐ 如果缓存未过期，直接返回缓存结果（避免频繁调用 PowerShell）
        if (now - clipboardCache.lastCheck < CACHE_DURATION) {
          return { hasFiles: clipboardCache.hasFiles };
        }

        let hasFiles = false;

        // ⭐ Windows: 使用 PowerShell 检查剪贴板（异步，不阻塞）
        if (process.platform === 'win32') {
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // 使用异步 exec 替代 execSync，避免阻塞主线程
            const psScript = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetFileDropList().Count';
            const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, {
              encoding: 'utf-8',
              windowsHide: true,
              timeout: 2000, // 缩短超时时间
            });

            const count = parseInt(stdout.trim(), 10);
            hasFiles = count > 0;
          } catch (psError) {
            // 静默失败，不影响用户体验
            hasFiles = false;
          }
        }

        // 更新缓存
        clipboardCache = { hasFiles, lastCheck: now };
        return { hasFiles };
      } catch (error) {
        logger.error('[Clipboard] Check error:', error);
        return { hasFiles: false };
      }
    });

    // ⭐⭐⭐ Paste files from system clipboard (支持从外部复制文件)
    this.register('fs:paste-from-clipboard' as IPCChannel, async (data: { targetDir: string }) => {
      const { clipboard } = require('electron');
      const fs = require('fs').promises;
      const path = require('path');

      try {
        const copiedFiles: string[] = [];
        let filePaths: string[] = [];

        // ⭐ Windows: 使用 PowerShell 读取剪贴板文件
        if (process.platform === 'win32') {
          try {
            const { execSync } = require('child_process');
            const psScript = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetFileDropList() | ForEach-Object { $_ }';
            const output = execSync(`powershell -NoProfile -Command "${psScript}"`, {
              encoding: 'utf-8',
              windowsHide: true,
              timeout: 5000,
            });

            filePaths = output
              .split(/\r?\n/)
              .map((p: string) => p.trim())
              .filter((p: string) => p.length > 0);

            logger.info(`[Clipboard] Found ${filePaths.length} files via PowerShell`);
          } catch (psError) {
            logger.warn('[Clipboard] PowerShell failed:', psError);
          }
        }

        // ⭐ 如果 PowerShell 失败，尝试纯文本路径
        if (filePaths.length === 0) {
          const clipboardText = clipboard.readText();
          if (clipboardText) {
            filePaths = clipboardText
              .split(/\r?\n/)
              .map((p: string) => p.trim())
              .filter((p: string) => p.length > 0 && (p.includes('\\') || p.includes('/')));
          }
        }

        if (filePaths.length === 0) {
          throw new Error('剪贴板中没有文件。请在文件管理器中复制文件，或使用拖拽功能。');
        }

        // 复制文件
        for (const sourcePath of filePaths) {
          try {
            const stats = await fs.stat(sourcePath);
            const fileName = path.basename(sourcePath);
            const destPath = path.join(data.targetDir, fileName);

            if (stats.isDirectory()) {
              await fs.cp(sourcePath, destPath, { recursive: true });
            } else {
              await fs.copyFile(sourcePath, destPath);
            }

            copiedFiles.push(fileName);
            logger.info(`[Clipboard] Copied: ${fileName}`);
          } catch (err) {
            logger.warn(`[Clipboard] Failed to copy ${sourcePath}:`, err);
          }
        }

        if (copiedFiles.length === 0) {
          throw new Error('没有成功复制任何文件');
        }

        return { success: true, copiedFiles };
      } catch (error) {
        logger.error('[Clipboard] Failed:', error);
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, `粘贴失败: ${error}`);
      }
    });

    // ⭐⭐⭐ Copy files from drag & drop (拖拽文件)
    this.register('fs:copy-files' as IPCChannel, async (data: { sourcePaths: string[]; targetDir: string }) => {
      const fs = require('fs').promises;
      const path = require('path');

      try {
        const copiedFiles: string[] = [];

        for (const sourcePath of data.sourcePaths) {
          try {
            const stats = await fs.stat(sourcePath);
            const fileName = path.basename(sourcePath);
            const destPath = path.join(data.targetDir, fileName);

            if (stats.isDirectory()) {
              await fs.cp(sourcePath, destPath, { recursive: true });
            } else {
              await fs.copyFile(sourcePath, destPath);
            }

            copiedFiles.push(fileName);
            logger.info(`[DragDrop] Copied: ${fileName}`);
          } catch (err) {
            logger.warn(`[DragDrop] Failed to copy ${sourcePath}:`, err);
          }
        }

        return { success: true, copiedFiles };
      } catch (error) {
        logger.error('[DragDrop] Failed:', error);
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, `复制失败: ${error}`);
      }
    });

    // Scan directory (with filtering)
    this.register(
      IPCChannels.FS_SCAN_DIRECTORY,
      async (data: { path: string }) => {
        const fs = require('fs').promises;
        const path = require('path');

        const shouldIgnore = (name: string): boolean => {
          const ignorePatterns = [
            'node_modules',
            '.git',
            '.vscode',
            'dist',
            'build',
            '.next',
            '.nuxt',
            'coverage',
            '.DS_Store',
            'Thumbs.db',
          ];
          return ignorePatterns.includes(name) || name.startsWith('.');
        };

        const scanDir = async (dirPath: string, maxDepth: number = 3, currentDepth: number = 0): Promise<any[]> => {
          if (currentDepth >= maxDepth) {
            return [];
          }

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const result: any[] = [];

            for (const entry of entries) {
              if (shouldIgnore(entry.name)) {
                continue;
              }

              const fullPath = path.join(dirPath, entry.name);

              if (entry.isDirectory()) {
                const children = await scanDir(fullPath, maxDepth, currentDepth + 1);
                result.push({
                  name: entry.name,
                  path: fullPath,
                  type: 'folder',
                  isExpanded: false,
                  children: children.length > 0 ? children : undefined,
                });
              } else {
                result.push({
                  name: entry.name,
                  path: fullPath,
                  type: 'file',
                });
              }
            }

            return result.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
            });
          } catch (error) {
            logger.error(`Error scanning directory ${dirPath}:`, error);
            return [];
          }
        };

        const fileTree = await scanDir(data.path);
        return { fileTree, rootPath: data.path };
      }
    );

    logger.info('File System IPC handlers registered');
  }

  /**
   * ⭐ Register Shell handlers
   */
  private registerShellHandlers(): void {
    const { shell, clipboard } = require('electron');

    // Open URL in default browser
    this.register(
      IPCChannels.SHELL_OPEN_URL,
      async (data: { url: string }) => {
        try {
          await shell.openExternal(data.url);
          logger.info(`Opened URL: ${data.url}`);
          return { success: true };
        } catch (error) {
          logger.error('Failed to open URL:', error);
          throw error;
        }
      }
    );

    // ⭐⭐⭐ Write text to clipboard
    this.register(
      'clipboard:write-text' as IPCChannel,
      async (data: { text: string }) => {
        try {
          clipboard.writeText(data.text);
          return { success: true };
        } catch (error) {
          logger.error('Failed to write to clipboard:', error);
          throw error;
        }
      }
    );

    logger.info('Shell IPC handlers registered');
  }

  /**
   * ⭐ Register Workflow handlers
   */
  private registerWorkflowHandlers(): void {
    const dbService = require('../services/DatabaseService').DatabaseService.getInstance();
    const workflowEngine = require('../workflow/WorkflowEngine').WorkflowEngine.getInstance();

    // List all workflows
    this.register(IPCChannels.WORKFLOW_LIST, async () => {
      return await dbService.getWorkflows();
    });

    // Get workflow by ID
    this.register(IPCChannels.WORKFLOW_GET, async (data: { id: string }) => {
      return await dbService.getWorkflow(data.id);
    });

    // Create workflow
    this.register(IPCChannels.WORKFLOW_CREATE, async (data: any) => {
      await dbService.createWorkflow(data);
      return { success: true };
    });

    // Update workflow
    this.register(IPCChannels.WORKFLOW_UPDATE, async (data: { id: string; updates: any }) => {
      await dbService.updateWorkflow(data.id, data.updates);
      return { success: true };
    });

    // Delete workflow
    this.register(IPCChannels.WORKFLOW_DELETE, async (data: { id: string }) => {
      await dbService.deleteWorkflow(data.id);
      return { success: true };
    });

    // ⭐ Execute workflow
    this.register(IPCChannels.WORKFLOW_EXECUTE, async (data: { id: string; variables?: Record<string, any> }) => {
      const workflow = await dbService.getWorkflow(data.id);
      if (!workflow) {
        throw new Error(`Workflow not found: ${data.id}`);
      }

      logger.info(`Executing workflow: ${workflow.name} (${workflow.id})`);
      const context = await workflowEngine.execute(workflow, data.variables);

      return {
        executionId: context.executionId,
        status: context.status,
        startTime: context.startTime,
        endTime: context.endTime,
        error: context.error,
        nodeResults: context.nodeResults,
        variables: context.variables,
      };
    });

    // ⭐ Cancel workflow execution
    this.register(IPCChannels.WORKFLOW_CANCEL, async (data: { executionId: string }) => {
      const canceled = workflowEngine.cancel(data.executionId);
      return { canceled };
    });

    // ⭐ Setup workflow event forwarding
    workflowEngine.on('workflow-event', (event: any) => {
      this.sendToRenderer('workflow:event', event);
    });

    logger.info('Workflow IPC handlers registered');
  }

  /**
   * ⭐ Register Chat History handlers (参照 WPF SessionStorageService)
   */
  private registerHistoryHandlers(): void {
    const { SessionStorageService } = require('../services/SessionStorageService');
    const sessionStorage = new SessionStorageService();

    // 创建新会话
    this.register(
      IPCChannels.HISTORY_CREATE_SESSION,
      async (data: { projectPath: string; projectName: string; title?: string; sessionId?: string }) => {
        // ⭐⭐⭐ 调试日志：记录 IPC 接收到的参数
        logger.info(`[IPCManager] 📨 HISTORY_CREATE_SESSION 收到请求`, {
          projectPath: data.projectPath,
          projectName: data.projectName,
          title: data.title,
          sessionId: data.sessionId || '(未提供)',
        });

        const result = await sessionStorage.createSessionAsync(
          data.projectPath,
          data.projectName,
          data.title,
          data.sessionId  // ⭐ 传递 sessionId
        );

        logger.info(`[IPCManager] 📤 HISTORY_CREATE_SESSION 返回结果`, {
          id: result.id,
          title: result.title,
        });

        return result;
      },
      HistoryCreateSessionSchema
    );

    // 获取指定会话
    this.register(
      IPCChannels.HISTORY_GET_SESSION,
      async (data: { projectPath: string; sessionId: string }) => {
        return await sessionStorage.getSessionAsync(data.projectPath, data.sessionId);
      },
      HistoryGetSessionSchema
    );

    // 获取所有会话（全局）
    this.register(IPCChannels.HISTORY_GET_ALL_SESSIONS, async () => {
      const sessions = await sessionStorage.getAllGlobalSessionsAsync();
      return { sessions };
    });

    // 保存消息到会话
    this.register(
      IPCChannels.HISTORY_SAVE_MESSAGE,
      async (data: { projectPath: string; sessionId: string; message: any }) => {
        await sessionStorage.saveMessageAsync(
          data.projectPath,
          data.sessionId,
          data.message
        );
        return { success: true };
      }
      // Note: 不使用 HistorySaveMessageSchema 以避免类型推断问题
    );

    // 更新会话数据
    this.register(
      IPCChannels.HISTORY_UPDATE_SESSION,
      async (data: { projectPath: string; session: any }) => {
        await sessionStorage.updateSessionAsync(data.projectPath, data.session);
        return { success: true };
      }
    );

    // 删除会话
    this.register(
      IPCChannels.HISTORY_DELETE_SESSION,
      async (data: { projectPath: string; sessionId: string }) => {
        await sessionStorage.deleteSessionAsync(data.projectPath, data.sessionId);
        return { success: true };
      },
      HistoryDeleteSessionSchema
    );

    // 搜索会话（标题/项目名）
    this.register(
      IPCChannels.HISTORY_SEARCH_SESSIONS,
      async (data: { keyword?: string; projectPath?: string }) => {
        return await sessionStorage.searchSessionsAsync(
          data.keyword || '',
          data.projectPath
        );
      },
      HistorySearchSessionsSchema
    );

    // 搜索消息内容
    this.register(
      IPCChannels.HISTORY_SEARCH_MESSAGES,
      async (data: { keyword: string; projectPath?: string }) => {
        return await sessionStorage.searchSessionsByMessageContentAsync(
          data.keyword,
          data.projectPath
        );
      }
    );

    // 获取统计信息
    this.register(IPCChannels.HISTORY_GET_STATISTICS, async () => {
      return await sessionStorage.getGlobalSessionStatisticsAsync();
    });

    // 更新会话标题
    this.register(
      IPCChannels.HISTORY_UPDATE_TITLE,
      async (data: { projectPath: string; sessionId: string; newTitle: string }) => {
        await sessionStorage.updateSessionTitleAsync(
          data.projectPath,
          data.sessionId,
          data.newTitle
        );
        return { success: true };
      },
      HistoryUpdateTitleSchema
    );

    // 获取所有项目名称
    this.register(IPCChannels.HISTORY_GET_PROJECT_NAMES, async () => {
      return await sessionStorage.getAllProjectNamesAsync();
    });

    // ⭐⭐⭐ SQLite FTS5 全文搜索（使用搜索索引）
    this.register(IPCChannels.HISTORY_SEARCH_WITH_FTS5, async (data: {
      query: string;
      limit?: number;
      offset?: number;
      projectPath?: string;
      sortBy?: 'relevance' | 'time';
    }) => {
      const results = sessionStorage.searchWithIndex(data.query, {
        limit: data.limit,
        offset: data.offset,
        projectPath: data.projectPath,
        sortBy: data.sortBy,
      });
      return { results };
    });

    // ⭐⭐⭐ 重建 SQLite FTS5 搜索索引
    this.register(IPCChannels.HISTORY_REBUILD_SEARCH_INDEX, async () => {
      await sessionStorage.rebuildSearchIndexAsync();
      return { success: true };
    });

    // ⭐⭐⭐ JSONL 备份服务（仅主进程）
    // IndexedDB 操作已移至渲染进程直接处理
    const { SessionHistoryService } = require('../services/SessionHistoryService');
    const historyService = SessionHistoryService.getInstance();

    // 从 JSONL 文件加载会话历史（渲染进程 IndexedDB 为空时的备用方案）
    this.register('history:load-from-jsonl' as IPCChannel, async (data: { sessionId: string }) => {
      return await historyService.getSessionMessages(data.sessionId);
    });

    logger.info('Chat History IPC handlers registered (JSONL backup only, IndexedDB in renderer)');
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
