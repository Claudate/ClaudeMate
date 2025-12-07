/**
 * Claude Path Detector - Claude CLI 路径检测模块
 * 负责检测和缓存 Claude CLI 的安装路径
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { BaseClaudeModule } from './BaseClaudeModule';

export class ClaudePathDetector extends BaseClaudeModule {
  private claudeCliPath: string | null = null;

  constructor() {
    super('PathDetector');
  }

  /**
   * 获取 Claude CLI 常见安装路径
   */
  private getCommonInstallPaths(): string[] {
    const paths: string[] = [];
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows 常见路径
      const appData = process.env.APPDATA || '';
      const localAppData = process.env.LOCALAPPDATA || '';
      const userProfile = process.env.USERPROFILE || '';
      const home = process.env.HOME || process.env.USERPROFILE || '';

      paths.push(
        // Claude Code CLI 官方安装路径
        join(home, '.local', 'bin', 'claude.exe'),
        join(userProfile, '.local', 'bin', 'claude.exe'),
        join(userProfile, '.local', 'bin', 'claude.cmd'),
        // npm global 安装
        join(appData, 'npm', 'claude.cmd'),
        join(appData, 'npm', 'claude.exe'),
        // 自定义 npm global 路径
        'E:\\npm-global\\claude.cmd',
        'E:\\npm-global\\claude.exe',
        // 其他可能位置
        join(localAppData, 'Programs', 'claude', 'claude.exe'),
      );
    } else if (platform === 'darwin') {
      // macOS 常见路径
      const home = process.env.HOME || '';
      paths.push(
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        join(home, '.local', 'bin', 'claude'),
        '/usr/bin/claude',
      );
    } else {
      // Linux 常见路径
      const home = process.env.HOME || '';
      paths.push(
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        join(home, '.local', 'bin', 'claude'),
        '/opt/claude/claude',
      );
    }

    return paths;
  }

  /**
   * 从 PATH 环境变量中查找 Claude CLI
   */
  private findClaudeInPath(): string | null {
    try {
      const pathEnv = process.env.PATH || '';
      const paths = pathEnv.split(process.platform === 'win32' ? ';' : ':');
      const executableNames = process.platform === 'win32'
        ? ['claude.exe', 'claude.cmd', 'claude.bat']
        : ['claude'];

      for (const directory of paths) {
        for (const executableName of executableNames) {
          const fullPath = join(directory, executableName);
          if (existsSync(fullPath)) {
            this.logger.info(`Found Claude CLI in PATH: ${fullPath}`);
            return fullPath;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error searching PATH:', error);
    }

    return null;
  }

  /**
   * 获取 Claude CLI 路径(带缓存和自动检测)
   */
  public getClaudeCliPath(): string {
    // 如果已缓存,直接返回
    if (this.claudeCliPath) {
      return this.claudeCliPath;
    }

    this.logger.info('开始查找 Claude CLI 路径...');

    // 1. 尝试从 PATH 环境变量查找
    const pathFromEnv = this.findClaudeInPath();
    if (pathFromEnv) {
      this.claudeCliPath = pathFromEnv;
      this.logger.info(`✓ 从 PATH 找到 Claude CLI: ${pathFromEnv}`);
      return pathFromEnv;
    }

    // 2. 尝试常见安装路径
    this.logger.info('PATH 中未找到,尝试常见安装路径...');
    const commonPaths = this.getCommonInstallPaths();
    this.logger.info(`检查 ${commonPaths.length} 个常见路径...`);

    for (const path of commonPaths) {
      this.logger.debug(`检查路径: ${path}`);
      if (existsSync(path)) {
        this.claudeCliPath = path;
        this.logger.info(`✓ 从常见路径找到 Claude CLI: ${path}`);
        return path;
      }
    }

    // 3. 如果都找不到,返回默认命令名
    this.logger.warn('⚠ Claude CLI 未在常见路径找到,使用默认命令 "claude"');
    this.logger.warn('如果命令失败,请检查 Claude CLI 是否已安装并在 PATH 中');
    this.claudeCliPath = 'claude';
    return 'claude';
  }

  /**
   * 重置缓存路径(用于测试或重新检测)
   */
  public resetCache(): void {
    this.claudeCliPath = null;
    this.logger.info('Path cache reset');
  }
}
