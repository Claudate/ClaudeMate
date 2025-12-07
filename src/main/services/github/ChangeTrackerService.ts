/**
 * ChangeTrackerService - 项目文件变更追踪服务
 *
 * 策略: 方案 A + 方案 B 结合
 * - 方案 A: 监控 Claude CLI 工具调用 (Edit, Write, Bash)
 * - 方案 B: 使用 git status 检测文件变更
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../utils/Logger';
import type { FileChange } from '@shared/types/domain.types';

const execAsync = promisify(exec);
const logger = Logger.getInstance('ChangeTrackerService');

/**
 * 工具调用记录
 */
interface ToolCallRecord {
  sessionId: string;
  toolName: string;
  filePath?: string;
  timestamp: number;
}

/**
 * 文件变更追踪服务
 */
export class ChangeTrackerService {
  private static instance: ChangeTrackerService;
  private toolCalls: Map<string, ToolCallRecord[]> = new Map(); // projectPath -> records

  private constructor() {}

  public static getInstance(): ChangeTrackerService {
    if (!ChangeTrackerService.instance) {
      ChangeTrackerService.instance = new ChangeTrackerService();
    }
    return ChangeTrackerService.instance;
  }

  /**
   * 记录工具调用
   * 在 ClaudeService 中调用此方法
   */
  public recordToolCall(
    projectPath: string,
    sessionId: string,
    toolName: string,
    filePath?: string
  ): void {
    if (!this.toolCalls.has(projectPath)) {
      this.toolCalls.set(projectPath, []);
    }

    const records = this.toolCalls.get(projectPath)!;
    records.push({
      sessionId,
      toolName,
      filePath,
      timestamp: Date.now(),
    });

    logger.debug(
      `[ChangeTrackerService] Tool call recorded: ${toolName} on ${filePath || 'N/A'}`
    );
  }

  /**
   * 获取自上次同步以来的变更文件
   * 结合方案 A 和方案 B
   */
  public async getChangedFiles(
    projectPath: string,
    lastSyncTime?: number
  ): Promise<FileChange[]> {
    try {
      // 方案 B: 使用 git status 检测所有变更
      const gitChanges = await this.getGitChanges(projectPath);

      // 方案 A: 从工具调用记录中提取会话关联
      const toolRecords = this.toolCalls.get(projectPath) || [];
      const filteredRecords = lastSyncTime
        ? toolRecords.filter((r) => r.timestamp > lastSyncTime)
        : toolRecords;

      // 合并两种方案的结果
      const fileChanges: FileChange[] = [];
      const fileMap = new Map<string, FileChange>();

      // 添加 git 检测到的变更
      for (const gitChange of gitChanges) {
        fileMap.set(gitChange.path, gitChange);
      }

      // 关联工具调用记录（添加 sessionId）
      for (const record of filteredRecords) {
        if (record.filePath) {
          const existing = fileMap.get(record.filePath);
          if (existing) {
            existing.sessionId = record.sessionId;
          } else {
            // 工具记录了文件，但 git status 没有（可能已提交），添加到结果
            fileMap.set(record.filePath, {
              path: record.filePath,
              type: 'modified',
              sessionId: record.sessionId,
            });
          }
        }
      }

      // 转换为数组
      return Array.from(fileMap.values());
    } catch (error) {
      logger.error('[ChangeTrackerService] Failed to get changed files:', error);
      return [];
    }
  }

  /**
   * 使用 git status 检测文件变更 (方案 B)
   */
  private async getGitChanges(projectPath: string): Promise<FileChange[]> {
    try {
      const changes: FileChange[] = [];

      // 1. 获取已修改的文件 (modified)
      const { stdout: modifiedOutput } = await execAsync('git diff --name-only', {
        cwd: projectPath,
      });
      const modifiedFiles = modifiedOutput.trim().split('\n').filter(Boolean);
      for (const file of modifiedFiles) {
        changes.push({
          path: file,
          type: 'modified',
        });
      }

      // 2. 获取已暂存的文件 (staged)
      const { stdout: stagedOutput } = await execAsync('git diff --cached --name-only', {
        cwd: projectPath,
      });
      const stagedFiles = stagedOutput.trim().split('\n').filter(Boolean);
      for (const file of stagedFiles) {
        if (!modifiedFiles.includes(file)) {
          changes.push({
            path: file,
            type: 'modified',
          });
        }
      }

      // 3. 获取未跟踪的文件 (added)
      const { stdout: untrackedOutput } = await execAsync(
        'git ls-files --others --exclude-standard',
        { cwd: projectPath }
      );
      const untrackedFiles = untrackedOutput.trim().split('\n').filter(Boolean);
      for (const file of untrackedFiles) {
        changes.push({
          path: file,
          type: 'added',
        });
      }

      logger.info(
        `[ChangeTrackerService] Detected ${changes.length} changed files via git`
      );

      return changes;
    } catch (error) {
      logger.error('[ChangeTrackerService] Failed to get git changes:', error);
      return [];
    }
  }

  /**
   * 清除指定项目的工具调用记录
   * 在成功同步后调用
   */
  public clearToolCalls(projectPath: string, beforeTimestamp?: number): void {
    if (!this.toolCalls.has(projectPath)) {
      return;
    }

    if (beforeTimestamp) {
      // 只清除指定时间之前的记录
      const records = this.toolCalls.get(projectPath)!;
      this.toolCalls.set(
        projectPath,
        records.filter((r) => r.timestamp > beforeTimestamp)
      );
    } else {
      // 清除所有记录
      this.toolCalls.delete(projectPath);
    }

    logger.info(`[ChangeTrackerService] Tool calls cleared for: ${projectPath}`);
  }

  /**
   * 获取项目的工具调用统计
   */
  public getToolCallStats(projectPath: string): {
    totalCalls: number;
    editCalls: number;
    writeCalls: number;
    bashCalls: number;
    lastCallTime?: number;
  } {
    const records = this.toolCalls.get(projectPath) || [];

    return {
      totalCalls: records.length,
      editCalls: records.filter((r) => r.toolName === 'Edit').length,
      writeCalls: records.filter((r) => r.toolName === 'Write').length,
      bashCalls: records.filter((r) => r.toolName === 'Bash').length,
      lastCallTime: records.length > 0 ? Math.max(...records.map((r) => r.timestamp)) : undefined,
    };
  }

  /**
   * 检查是否有敏感文件
   * 返回敏感文件列表
   */
  public checkSensitiveFiles(files: FileChange[]): string[] {
    const sensitivePatterns = [
      /\.env$/i,
      /\.env\./i,
      /credentials/i,
      /secret/i,
      /\.pem$/i,
      /\.key$/i,
      /\.p12$/i,
      /\.pfx$/i,
      /id_rsa/i,
      /\.git\/config$/i,
    ];

    const sensitiveFiles: string[] = [];

    for (const file of files) {
      for (const pattern of sensitivePatterns) {
        if (pattern.test(file.path)) {
          sensitiveFiles.push(file.path);
          break;
        }
      }
    }

    if (sensitiveFiles.length > 0) {
      logger.warn(
        `[ChangeTrackerService] Detected ${sensitiveFiles.length} sensitive files:`,
        sensitiveFiles
      );
    }

    return sensitiveFiles;
  }

  /**
   * 清理所有记录
   */
  public cleanup(): void {
    this.toolCalls.clear();
    logger.info('[ChangeTrackerService] Cleaned up all records');
  }
}
