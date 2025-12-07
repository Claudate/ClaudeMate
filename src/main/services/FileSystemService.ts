/**
 * File System Service
 * Provides secure file system operations with proper error handling
 */

import { promises as fs } from 'fs';
import { watch, FSWatcher } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { Logger } from '../utils/Logger';
import { BrowserWindow } from 'electron';
import { IPCChannels } from '../../shared/types/ipc.types';

const logger = Logger.getInstance('FileSystemService');

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  extension: string;
  modified: Date;
  created: Date;
}

export interface ReadFileOptions {
  path: string;
  encoding?: 'utf8' | 'binary';
}

export interface WriteFileOptions {
  path: string;
  content: string;
  encoding?: 'utf8' | 'binary';
}

export interface DirectoryListOptions {
  path: string;
  recursive?: boolean;
}

export class FileSystemService {
  private static instance: FileSystemService;
  private watchers: Map<string, FSWatcher> = new Map();
  private mainWindow: BrowserWindow | null = null;

  private constructor() {}

  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  /**
   * Set the main window for sending events
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Read a file from the file system
   */
  public async readFile(options: ReadFileOptions): Promise<string> {
    const { path, encoding = 'utf8' } = options;

    try {
      logger.info(`Reading file: ${path}`);

      // Check if file exists
      await fs.access(path);

      // Read file content
      const content = await fs.readFile(path, encoding);
      logger.debug(`File read successfully: ${path} (${content.length} bytes)`);

      return content;
    } catch (error) {
      logger.error(`Failed to read file: ${path}`, error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write content to a file
   */
  public async writeFile(options: WriteFileOptions): Promise<void> {
    const { path, content, encoding = 'utf8' } = options;

    try {
      logger.info(`Writing file: ${path}`);

      // Ensure directory exists
      const dir = dirname(path);
      await fs.mkdir(dir, { recursive: true });

      // Write file content
      await fs.writeFile(path, content, encoding);
      logger.debug(`File written successfully: ${path} (${content.length} bytes)`);
    } catch (error) {
      logger.error(`Failed to write file: ${path}`, error);
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file
   */
  public async deleteFile(path: string): Promise<void> {
    try {
      logger.info(`Deleting file: ${path}`);

      // Check if file exists
      await fs.access(path);

      // Delete file
      await fs.unlink(path);
      logger.debug(`File deleted successfully: ${path}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${path}`, error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List directory contents
   */
  public async listDirectory(options: DirectoryListOptions): Promise<FileInfo[]> {
    const { path, recursive = false } = options;

    try {
      logger.info(`Listing directory: ${path}`);

      // Check if directory exists
      await fs.access(path);

      const files: FileInfo[] = [];

      if (recursive) {
        await this.listDirectoryRecursive(path, files);
      } else {
        const entries = await fs.readdir(path, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(path, entry.name);
          const stats = await fs.stat(fullPath);

          files.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            extension: entry.isFile() ? extname(entry.name) : '',
            modified: stats.mtime,
            created: stats.birthtime,
          });
        }
      }

      logger.debug(`Listed ${files.length} items in directory: ${path}`);
      return files;
    } catch (error) {
      logger.error(`Failed to list directory: ${path}`, error);
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recursively list directory contents
   */
  private async listDirectoryRecursive(path: string, files: FileInfo[]): Promise<void> {
    const entries = await fs.readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      const stats = await fs.stat(fullPath);

      files.push({
        name: entry.name,
        path: fullPath,
        size: stats.size,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        extension: entry.isFile() ? extname(entry.name) : '',
        modified: stats.mtime,
        created: stats.birthtime,
      });

      if (entry.isDirectory()) {
        await this.listDirectoryRecursive(fullPath, files);
      }
    }
  }

  /**
   * Check if a path exists
   */
  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file/directory information
   */
  public async getInfo(path: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(path);
      const name = basename(path);

      return {
        name,
        path,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        extension: stats.isFile() ? extname(name) : '',
        modified: stats.mtime,
        created: stats.birthtime,
      };
    } catch (error) {
      logger.error(`Failed to get info for: ${path}`, error);
      return null;
    }
  }

  /**
   * Create a directory
   */
  public async createDirectory(path: string): Promise<void> {
    try {
      logger.info(`Creating directory: ${path}`);
      await fs.mkdir(path, { recursive: true });
      logger.debug(`Directory created successfully: ${path}`);
    } catch (error) {
      logger.error(`Failed to create directory: ${path}`, error);
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a directory
   */
  public async deleteDirectory(path: string, recursive: boolean = false): Promise<void> {
    try {
      logger.info(`Deleting directory: ${path}`);
      await fs.rm(path, { recursive, force: false });
      logger.debug(`Directory deleted successfully: ${path}`);
    } catch (error) {
      logger.error(`Failed to delete directory: ${path}`, error);
      throw new Error(`Failed to delete directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start watching a directory for changes
   */
  public watchDirectory(path: string): void {
    // Stop existing watcher if any
    this.stopWatching(path);

    try {
      logger.info(`Starting file system watcher for: ${path}`);

      const watcher = watch(
        path,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;

          logger.debug(`File change detected: ${eventType} - ${filename}`);

          // 发送文件变化事件到渲染进程
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(IPCChannels.FS_WATCH_CHANGE, {
              eventType, // 'change' 或 'rename'
              path: join(path, filename),
              filename,
              timestamp: Date.now(),
            });
          }
        }
      );

      watcher.on('error', (error) => {
        logger.error(`File system watcher error for ${path}:`, error);
      });

      this.watchers.set(path, watcher);
      logger.info(`File system watcher started for: ${path}`);
    } catch (error) {
      logger.error(`Failed to start file system watcher for ${path}:`, error);
      throw new Error(`Failed to watch directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop watching a directory
   */
  public stopWatching(path: string): void {
    const watcher = this.watchers.get(path);
    if (watcher) {
      logger.info(`Stopping file system watcher for: ${path}`);
      watcher.close();
      this.watchers.delete(path);
    }
  }

  /**
   * Stop all watchers (cleanup)
   */
  public stopAllWatchers(): void {
    logger.info(`Stopping all file system watchers (${this.watchers.size} active)`);
    for (const [path, watcher] of this.watchers.entries()) {
      watcher.close();
      logger.debug(`Stopped watcher for: ${path}`);
    }
    this.watchers.clear();
  }
}
