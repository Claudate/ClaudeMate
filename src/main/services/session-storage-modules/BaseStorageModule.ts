/**
 * BaseStorageModule - 存储模块基类
 * 提供通用功能：日志、错误处理、路径计算
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../../utils/Logger';

export abstract class BaseStorageModule {
  protected logger: Logger;

  constructor(
    protected moduleName: string,
    protected baseStoragePath: string
  ) {
    this.logger = Logger.getInstance(`Storage:${moduleName}`);
  }

  /**
   * 计算项目路径的 SHA256 Hash（前 16 位）
   */
  protected computePathHash(projectPath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(projectPath.toLowerCase());
    return hash.digest('hex').substring(0, 16).toUpperCase();
  }

  /**
   * 获取项目专属存储目录
   */
  protected getProjectStoragePath(projectPath: string): string {
    const hash = this.computePathHash(projectPath);
    return path.join(this.baseStoragePath, hash);
  }

  /**
   * 获取会话文件存储目录
   */
  protected getSessionsPath(projectPath: string): string {
    return path.join(this.getProjectStoragePath(projectPath), 'sessions');
  }

  /**
   * 获取索引文件路径
   */
  protected getIndexPath(projectPath: string): string {
    return path.join(this.getProjectStoragePath(projectPath), 'sessionIndex.json');
  }

  /**
   * 获取会话文件路径
   */
  protected getSessionFilePath(projectPath: string, sessionId: string): string {
    return path.join(this.getSessionsPath(projectPath), `${sessionId}.json`);
  }

  /**
   * 确保目录存在
   */
  protected async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.logger.error(`创建目录失败 ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * 安全执行异步操作
   */
  protected async safeExecute<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(errorMessage, error);
      throw error;
    }
  }

  /**
   * 读取 JSON 文件
   */
  protected async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 写入 JSON 文件
   */
  protected async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    await this.ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
