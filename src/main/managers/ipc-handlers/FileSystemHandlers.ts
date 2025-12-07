/**
 * File System Handlers - 文件系统操作相关的 IPC 处理器
 * 处理文件/文件夹的读写、删除、复制、移动、拖拽、剪贴板等操作
 */

import { dialog, shell, clipboard } from 'electron';
import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel, IPCError, IPCErrorCode } from '../../../shared/types/ipc.types';
import { WindowManager } from '../WindowManager';

export class FileSystemHandlers extends BaseHandler {
  private fileSystemService: any;
  private clipboardCache: { hasFiles: boolean; lastCheck: number } = { hasFiles: false, lastCheck: 0 };
  private readonly CACHE_DURATION = 500; // 500ms 缓存

  constructor() {
    super('FileSystem');
    const { FileSystemService } = require('../../services/FileSystemService');
    this.fileSystemService = FileSystemService.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    // 基础文件操作
    this.registerBasicFileOperations(registerFn);

    // 文件对话框
    this.registerFileDialogs(registerFn);

    // 剪贴板和拖拽
    this.registerClipboardAndDragDrop(registerFn);

    // 目录扫描和监听
    this.registerDirectoryOperations(registerFn);

    this.logger.info('File System IPC handlers registered');
  }

  /**
   * 注册基础文件操作
   */
  private registerBasicFileOperations(registerFn: any): void {
    // 读取文件
    registerFn(
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
        const content = await this.fileSystemService.readFile(data);
        return { content };
      }
    );

    // 写入文件
    registerFn(
      IPCChannels.FS_WRITE_FILE,
      async (data: { path: string; content: string; encoding?: 'utf8' | 'binary' }) => {
        await this.fileSystemService.writeFile(data);
        return { success: true };
      }
    );

    // 删除文件
    registerFn(IPCChannels.FS_DELETE_FILE, async (data: { path: string }) => {
      await this.fileSystemService.deleteFile(data.path);
      return { success: true };
    });

    // 创建文件
    registerFn(
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

    // 创建文件夹
    registerFn(
      IPCChannels.FS_CREATE_FOLDER,
      async (data: { path: string }) => {
        const fs = require('fs').promises;
        await fs.mkdir(data.path, { recursive: true });
        return { success: true, path: data.path };
      }
    );

    // ⭐⭐⭐ 删除文件或文件夹（递归删除）
    registerFn(
      IPCChannels.FS_DELETE,
      async (data: { path: string }) => {
        const fs = require('fs').promises;
        await fs.rm(data.path, { recursive: true, force: true });
        return { success: true };
      }
    );

    // ⭐⭐⭐ 复制文件或文件夹（递归复制）
    registerFn(
      IPCChannels.FS_COPY,
      async (data: { source: string; destination: string }) => {
        const fs = require('fs').promises;
        await fs.cp(data.source, data.destination, { recursive: true });
        return { success: true };
      }
    );

    // ⭐⭐⭐ 移动文件或文件夹（重命名/移动）
    registerFn(
      IPCChannels.FS_MOVE,
      async (data: { source: string; destination: string }) => {
        const fs = require('fs').promises;
        await fs.rename(data.source, data.destination);
        return { success: true };
      }
    );

    // ⭐⭐⭐ 在文件管理器中显示
    registerFn(
      IPCChannels.FS_REVEAL_IN_EXPLORER,
      async (data: { path: string }) => {
        shell.showItemInFolder(data.path);
        return { success: true };
      }
    );

    // ⭐⭐⭐ 获取文件统计信息（大小、修改时间等）
    registerFn(
      IPCChannels.FS_GET_FILE_STATS,
      async (data: { path: string }) => {
        const fs = require('fs').promises;
        const stats = await fs.stat(data.path);
        return {
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          modified: stats.mtime,
          created: stats.birthtime,
        };
      }
    );

    // 列出目录
    registerFn(
      IPCChannels.FS_LIST_DIRECTORY,
      async (data: { path: string; recursive?: boolean }) => {
        return await this.fileSystemService.listDirectory(data);
      }
    );
  }

  /**
   * 注册文件对话框
   */
  private registerFileDialogs(registerFn: any): void {
    // 打开文件对话框
    registerFn(IPCChannels.FS_OPEN_FILE_DIALOG, async () => {
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

    // 打开文件夹对话框
    registerFn(IPCChannels.FS_OPEN_FOLDER_DIALOG, async () => {
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

    // ⭐⭐⭐ 通用文件对话框（用于图片选择等）
    registerFn('dialog:open-file' as IPCChannel, async (data: {
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
  }

  /**
   * 注册剪贴板和拖拽操作
   */
  private registerClipboardAndDragDrop(registerFn: any): void {
    // ⭐⭐⭐ 检查剪贴板是否有文件
    registerFn('clipboard:has-files' as IPCChannel, async () => {
      try {
        const now = Date.now();

        // ⭐ 如果缓存未过期，直接返回缓存结果
        if (now - this.clipboardCache.lastCheck < this.CACHE_DURATION) {
          return { hasFiles: this.clipboardCache.hasFiles };
        }

        let hasFiles = false;

        // ⭐ Windows: 使用 PowerShell 检查剪贴板
        if (process.platform === 'win32') {
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const psScript = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetFileDropList().Count';
            const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, {
              encoding: 'utf-8',
              windowsHide: true,
              timeout: 2000,
            });

            const count = parseInt(stdout.trim(), 10);
            hasFiles = count > 0;
          } catch (psError) {
            hasFiles = false;
          }
        }

        // 更新缓存
        this.clipboardCache = { hasFiles, lastCheck: now };
        return { hasFiles };
      } catch (error) {
        this.logger.error('[Clipboard] Check error:', error);
        return { hasFiles: false };
      }
    });

    // ⭐⭐⭐ 从剪贴板粘贴文件
    registerFn('fs:paste-from-clipboard' as IPCChannel, async (data: { targetDir: string }) => {
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

            this.logger.info(`[Clipboard] Found ${filePaths.length} files via PowerShell`);
          } catch (psError) {
            this.logger.warn('[Clipboard] PowerShell failed:', psError);
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
            this.logger.info(`[Clipboard] Copied: ${fileName}`);
          } catch (err) {
            this.logger.warn(`[Clipboard] Failed to copy ${sourcePath}:`, err);
          }
        }

        if (copiedFiles.length === 0) {
          throw new Error('没有成功复制任何文件');
        }

        return { success: true, copiedFiles };
      } catch (error) {
        this.logger.error('[Clipboard] Failed:', error);
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, `粘贴失败: ${error}`);
      }
    });

    // ⭐⭐⭐ 拖拽文件复制
    registerFn('fs:copy-files' as IPCChannel, async (data: { sourcePaths: string[]; targetDir: string }) => {
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
            this.logger.info(`[DragDrop] Copied: ${fileName}`);
          } catch (err) {
            this.logger.warn(`[DragDrop] Failed to copy ${sourcePath}:`, err);
          }
        }

        return { success: true, copiedFiles };
      } catch (error) {
        this.logger.error('[DragDrop] Failed:', error);
        throw new IPCError(IPCErrorCode.INTERNAL_ERROR, `复制失败: ${error}`);
      }
    });
  }

  /**
   * 注册目录扫描和监听
   */
  private registerDirectoryOperations(registerFn: any): void {
    // 扫描目录
    registerFn(
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

          if (ignorePatterns.includes(name)) {
            return true;
          }

          // 过滤其他隐藏文件，但保留 .claude
          if (name.startsWith('.') && name !== '.claude') {
            return true;
          }

          return false;
        };

        const scanDir = async (dirPath: string, currentDepth: number = 0): Promise<any[]> => {
          // ⭐⭐⭐ 完全移除深度限制
          // 只通过 shouldIgnore 来过滤不需要的目录

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const result: any[] = [];

            // ⭐ 添加日志，帮助调试
            this.logger.info(`📁 扫描目录: ${dirPath} (深度: ${currentDepth}, 文件数: ${entries.length})`);

            for (const entry of entries) {
              if (shouldIgnore(entry.name)) {
                continue;
              }

              const fullPath = path.join(dirPath, entry.name);

              if (entry.isDirectory()) {
                const children = await scanDir(fullPath, currentDepth + 1);
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
            this.logger.error(`Error scanning directory ${dirPath}:`, error);
            return [];
          }
        };

        const fileTree = await scanDir(data.path);
        return { fileTree, rootPath: data.path };
      }
    );

    // ⭐⭐⭐ 开始监听目录
    registerFn(
      IPCChannels.FS_WATCH_START,
      async (data: { path: string }) => {
        this.fileSystemService.watchDirectory(data.path);
        return { success: true, path: data.path };
      }
    );

    // ⭐⭐⭐ 停止监听目录
    registerFn(
      IPCChannels.FS_WATCH_STOP,
      async (data: { path: string }) => {
        this.fileSystemService.stopWatching(data.path);
        return { success: true, path: data.path };
      }
    );
  }
}
