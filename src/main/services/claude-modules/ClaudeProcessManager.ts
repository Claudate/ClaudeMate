/**
 * Claude Process Manager - 进程管理模块
 * 负责 Claude CLI 进程的创建、管理、清理
 */

import { spawn, ChildProcess, exec, execSync } from 'child_process';
import { existsSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { BaseClaudeModule } from './BaseClaudeModule';
import { ClaudePathDetector } from './ClaudePathDetector';

export interface ProcessOptions {
  sessionId: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Claude 进程管理器
 * 负责进程的创建、复用、清理等操作
 */
export class ClaudeProcessManager extends BaseClaudeModule {
  // 使用项目路径作为 key，每个项目一个持久的 Claude CLI 进程
  private activeProcesses = new Map<string, ChildProcess>();

  // Session 存储目录（应用数据目录）
  private sessionStorageDir: string;

  // 路径检测器
  private pathDetector: ClaudePathDetector;

  constructor() {
    super('ProcessManager');

    // 初始化路径检测器
    this.pathDetector = new ClaudePathDetector();

    // 初始化 session 存储目录（使用应用根目录）
    // 在开发模式下：项目根目录/.claude-sessions
    // 在生产模式下：应用安装目录/.claude-sessions
    const appPath = app.isPackaged
      ? process.resourcesPath  // 打包后：resources 目录
      : app.getAppPath();      // 开发时：项目根目录

    this.sessionStorageDir = join(appPath, '.claude-sessions');

    if (!existsSync(this.sessionStorageDir)) {
      mkdirSync(this.sessionStorageDir, { recursive: true });
      this.logger.info(`📁 创建 session 存储目录: ${this.sessionStorageDir}`);
    } else {
      this.logger.info(`📁 使用 session 存储目录: ${this.sessionStorageDir}`);
    }
  }

  /**
   * 获取 session 存储目录
   */
  public getSessionStorageDir(): string {
    return this.sessionStorageDir;
  }

  /**
   * 创建 Claude CLI 进程
   * ⭐ 交互模式：每个 session 只启动一次进程，后续消息复用该进程
   */
  public spawnClaudeProcess(options: ProcessOptions): ChildProcess {
    const { sessionId, args, cwd, env } = options;

    this.logger.info(`🆕 创建新的 Claude CLI 进程: ${sessionId}`);

    // 启动前清理锁文件
    this.logger.info(`清理可能存在的锁文件...`);
    this.cleanupSessionLocks(sessionId, cwd);

    // 获取 Claude CLI 路径
    const claudeCliPath = this.pathDetector.getClaudeCliPath();

    // 构建环境变量
    const processEnv = { ...process.env, ...env };
    const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    if (oauthToken) {
      this.logger.info(`Using CLAUDE_CODE_OAUTH_TOKEN (length: ${oauthToken.length})`);
      processEnv.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
    } else {
      this.logger.warn('CLAUDE_CODE_OAUTH_TOKEN environment variable not found');
    }

    // 使用用户项目目录作为 cwd，而不是 session 存储目录
    // 这样 Claude CLI 创建的文件会在用户的项目目录中
    // Session 文件通过 Claude CLI 自动管理（存储在 cwd/.claude-code/ 下）
    const workingDirectory = cwd || this.sessionStorageDir;
    this.logger.info(`✅ 使用工作目录: ${workingDirectory}`);

    this.logger.info(`Spawning process: ${claudeCliPath} ${args.join(' ')}`);
    this.logger.info(`Session 存储目录: ${this.sessionStorageDir}`);
    this.logger.info(`项目目录: ${cwd || 'none'}`);

    // 启动持久的 Claude CLI 进程
    const claudeProcess = spawn(claudeCliPath, args, {
      cwd: workingDirectory,  // 使用项目目录而不是 session 存储目录
      shell: false,  // 关键修改: 不使用 shell,直接执行
      stdio: ['pipe', 'pipe', 'pipe'], // 保持 stdin 打开
      env: processEnv,
    });

    this.logger.info(`Process spawned with PID: ${claudeProcess.pid}`);

    // 关键修复：在 Windows 上必须显式设置 UTF-8 编码
    // Claude CLI 输出的是 UTF-8，但 Windows Node.js 默认使用 GBK
    if (claudeProcess.stdout) {
      claudeProcess.stdout.setEncoding('utf8');
    }
    if (claudeProcess.stderr) {
      claudeProcess.stderr.setEncoding('utf8');
    }

    // 监听进程错误
    claudeProcess.on('error', (error) => {
      this.logger.error(`Claude process error: ${error.message}`);
    });

    // 监听进程退出
    claudeProcess.on('exit', (code, signal) => {
      this.logger.warn(`Claude process exited: code=${code}, signal=${signal}`);

      // 进程退出时清理锁文件（类似 VSCode Claude Code）
      this.cleanupSessionLocks(sessionId, cwd);
      this.activeProcesses.delete(sessionId);
      this.logger.info(`🗑️ 进程退出，已清理 session: ${sessionId}`);
    });

    // 保存进程到 Map (支持进程复用)
    this.activeProcesses.set(sessionId, claudeProcess);

    return claudeProcess;
  }

  /**
   * 获取活跃进程
   */
  public getActiveProcess(sessionId: string): ChildProcess | undefined {
    const process = this.activeProcesses.get(sessionId);

    // 检查进程是否仍在运行
    if (process && !process.killed) {
      this.logger.info(`♻️ 复用现有 Claude CLI 进程: ${sessionId}, PID=${process.pid}`);
      return process;
    }

    // 如果进程已结束，从 Map 中移除
    if (process) {
      this.activeProcesses.delete(sessionId);
    }

    return undefined;
  }

  /**
   * 清理指定 session 的锁文件
   * 类似 VSCode Claude Code 的机制，防止锁文件导致的冲突
   */
  public cleanupSessionLocks(sessionId: string, cwd?: string): void {
    try {
      const claudeDir = join(homedir(), '.claude');
      this.logger.info(`🔍 开始清理锁文件，session: ${sessionId}, cwd: ${cwd}`);

      // ⭐⭐⭐ 清理全局锁文件 ~/.claude.lock (这是关键!)
      const globalLockFile = join(homedir(), '.claude.lock');
      if (existsSync(globalLockFile)) {
        try {
          unlinkSync(globalLockFile);
          this.logger.info(`🗑️ ✅ 已删除全局锁文件: ${globalLockFile}`);
        } catch (e) {
          this.logger.warn(`⚠️ 无法删除全局锁文件: ${e}`);
        }
      }

      // ⭐⭐⭐ 清理 sessions 目录下的锁文件（这是关键修复！）
      const sessionsDir = join(claudeDir, 'sessions');
      if (existsSync(sessionsDir)) {
        // 1. 清理顶层的 session 锁文件
        const sessionLockFiles = [
          join(sessionsDir, `${sessionId}.lock`),
          join(sessionsDir, `${sessionId}.jsonl.lock`),
        ];

        for (const lockFile of sessionLockFiles) {
          if (existsSync(lockFile)) {
            try {
              unlinkSync(lockFile);
              this.logger.info(`🗑️ ✅ 已删除 session 锁文件: ${lockFile}`);
            } catch (e) {
              this.logger.warn(`⚠️ 无法删除 session 锁文件: ${e}`);
            }
          }
        }

        // 2. ⭐⭐⭐ 清理 session 目录下的 in_use.lock 文件（这是导致"already in use"的根本原因）
        const sessionDir = join(sessionsDir, sessionId);
        if (existsSync(sessionDir)) {
          try {
            const sessionFiles = readdirSync(sessionDir);
            this.logger.info(`🔍 session 目录 ${sessionId} 中的文件: ${sessionFiles.join(', ')}`);

            for (const file of sessionFiles) {
              if (file.endsWith('.lock') || file === 'in_use.lock') {
                const lockFile = join(sessionDir, file);
                try {
                  unlinkSync(lockFile);
                  this.logger.info(`🗑️ ✅ 已删除 session 内部锁文件: ${lockFile}`);
                } catch (e) {
                  this.logger.warn(`⚠️ 无法删除锁文件 ${file}: ${e}`);
                }
              }
            }
          } catch (e) {
            this.logger.warn(`⚠️ 无法访问 session 目录: ${e}`);
          }
        }
      }

      // 清理 projects 目录下的锁文件
      if (cwd) {
        // 规范化工作目录路径，匹配 Claude CLI 的命名规则
        // H:\编剧-脚本\测试项目 -> h--编剧-脚本--测试项目
        const normalizedCwd = cwd.toLowerCase().replace(/[:\\\/]/g, '--');
        const projectDir = join(claudeDir, 'projects', normalizedCwd);

        this.logger.info(`🔍 检查项目目录: ${projectDir}`);

        if (existsSync(projectDir)) {
          // 尝试多种可能的锁文件格式
          const lockFiles = [
            join(projectDir, `${sessionId}.lock`),
            join(projectDir, `${sessionId}.jsonl.lock`),
          ];

          for (const lockFile of lockFiles) {
            if (existsSync(lockFile)) {
              unlinkSync(lockFile);
              this.logger.info(`🗑️ ✅ 已删除锁文件: ${lockFile}`);
            }
          }

          // 列出目录中所有文件用于调试
          try {
            const files = readdirSync(projectDir);
            this.logger.info(`📁 项目目录中的文件: ${files.join(', ')}`);

            // 删除所有包含该 session ID 的文件
            for (const file of files) {
              if (file.includes(sessionId)) {
                const filePath = join(projectDir, file);
                if (file.endsWith('.lock')) {
                  unlinkSync(filePath);
                  this.logger.info(`🗑️ ✅ 已删除匹配的锁文件: ${filePath}`);
                }
              }
            }
          } catch (e) {
            this.logger.warn(`无法列出目录: ${e}`);
          }
        } else {
          this.logger.warn(`⚠️ 项目目录不存在: ${projectDir}`);
        }
      }

      // 清理所有可能的锁文件（遍历 projects 目录）
      const projectsDir = join(claudeDir, 'projects');
      if (existsSync(projectsDir)) {
        const projectFolders = readdirSync(projectsDir, { withFileTypes: true });
        this.logger.info(`🔍 遍历 ${projectFolders.length} 个项目文件夹...`);

        for (const folder of projectFolders) {
          if (folder.isDirectory()) {
            const folderPath = join(projectsDir, folder.name);
            try {
              const files = readdirSync(folderPath);
              for (const file of files) {
                if (file.includes(sessionId) && file.endsWith('.lock')) {
                  const lockFile = join(folderPath, file);
                  unlinkSync(lockFile);
                  this.logger.info(`🗑️ ✅ 清理旧锁文件: ${lockFile}`);
                }
              }
            } catch (e) {
              // 忽略无法访问的文件夹
            }
          }
        }
      }

      // ⭐⭐⭐ 清理 IDE 锁文件 ~/.claude/ide/*.lock
      // 这些是 Electron 应用的进程锁文件
      const ideDir = join(claudeDir, 'ide');
      if (existsSync(ideDir)) {
        try {
          const ideFiles = readdirSync(ideDir);
          this.logger.info(`🔍 清理 IDE 目录中的 ${ideFiles.length} 个文件...`);

          for (const file of ideFiles) {
            if (file.endsWith('.lock')) {
              const lockFile = join(ideDir, file);
              try {
                unlinkSync(lockFile);
                this.logger.info(`🗑️ ✅ 已删除 IDE 锁文件: ${lockFile}`);
              } catch (e) {
                this.logger.warn(`⚠️ 无法删除 IDE 锁文件 ${file}: ${e}`);
              }
            }
          }
        } catch (e) {
          this.logger.warn(`⚠️ 清理 IDE 锁文件失败: ${e}`);
        }
      }

      this.logger.info(`✅ 锁文件清理完成`);
    } catch (error) {
      this.logger.warn(`清理锁文件失败: ${error}`);
    }
  }

  /**
   * ⭐⭐⭐ 强制终止所有占用该 session ID 的 Claude CLI 进程
   * 类似 VSCode Claude Code 的进程管理机制
   *
   * 策略：查找所有 claude.exe 进程，检查命令行参数中是否包含该 session ID
   */
  public async killExistingClaudeProcesses(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const platform = process.platform;
        let command: string;

        if (platform === 'win32') {
          // ⭐ Windows: 使用 WMIC 获取 claude.exe 的 PID 和 CommandLine
          // 使用 CSV 格式更容易解析
          command = `wmic process where "name='claude.exe'" get ProcessId,CommandLine /FORMAT:CSV`;
        } else {
          // Unix-like: 使用 ps 查找包含 session ID 的 claude 进程
          command = `ps aux | grep claude | grep "${sessionId}"`;
        }

        this.logger.info(`🔍 查找使用 session ${sessionId} 的进程...`);

        exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
          if (error || !stdout) {
            this.logger.info(`✅ 未找到占用该 session 的进程`);
            resolve();
            return;
          }

          const pidsToKill: number[] = [];

          if (platform === 'win32') {
            // ⭐ 解析 WMIC CSV 输出
            // 格式: Node,CommandLine,ProcessId
            const lines = stdout.split('\n').filter(l => l.trim());

            for (const line of lines) {
              // 跳过标题行
              if (line.includes('Node,CommandLine,ProcessId')) continue;
              if (!line.includes('claude.exe')) continue;

              // 检查命令行是否包含该 session ID
              if (line.includes(sessionId)) {
                // CSV 格式：Node,CommandLine,ProcessId
                const parts = line.split(',');
                if (parts.length >= 3) {
                  const pid = parseInt(parts[parts.length - 1].trim());
                  if (pid && !isNaN(pid)) {
                    this.logger.info(`🔍 发现匹配进程 PID ${pid}: ${line.substring(0, 100)}...`);
                    pidsToKill.push(pid);
                  }
                }
              }
            }
          } else {
            // Unix-like 系统
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes('grep')) continue; // 跳过 grep 自身
              const parts = line.trim().split(/\s+/);
              if (parts[1]) {
                const pid = parseInt(parts[1]);
                if (pid && !isNaN(pid)) {
                  pidsToKill.push(pid);
                }
              }
            }
          }

          // ⭐ 终止找到的进程
          if (pidsToKill.length > 0) {
            this.logger.info(`🔫 发现 ${pidsToKill.length} 个占用 session 的进程，准备强制终止: ${pidsToKill.join(', ')}`);

            let killedCount = 0;
            for (const pid of pidsToKill) {
              try {
                if (platform === 'win32') {
                  execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                } else {
                  execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                }
                killedCount++;
                this.logger.info(`✅ 已终止进程 PID ${pid}`);
              } catch (e) {
                this.logger.warn(`⚠️ 无法终止进程 PID ${pid}: ${e}`);
              }
            }

            this.logger.info(`✅ 成功终止 ${killedCount}/${pidsToKill.length} 个进程`);
            // 等待进程完全终止
            setTimeout(resolve, 1000);
          } else {
            this.logger.info(`✅ 未找到占用该 session 的进程`);
            resolve();
          }
        });
      } catch (error) {
        this.logger.warn(`⚠️ 终止进程失败: ${error}`);
        resolve();
      }
    });
  }

  /**
   * 终止指定 session 的进程
   */
  public killProcess(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);

    if (process && !process.killed) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
      this.logger.info(`Killed Claude process for session: ${sessionId}`);

      // 清理对应的锁文件
      this.cleanupSessionLocks(sessionId);
      return true;
    }

    return false;
  }

  /**
   * 清理所有活跃进程
   * 改进：清理进程的同时也清理锁文件
   */
  public cleanup(): void {
    for (const [sessionId, process] of this.activeProcesses.entries()) {
      if (!process.killed) {
        process.kill('SIGTERM');
        this.logger.info(`Killed Claude process for session: ${sessionId}`);
      }
      // 清理对应的锁文件
      this.cleanupSessionLocks(sessionId);
    }
    this.activeProcesses.clear();
    this.logger.info(`✅ 所有 Claude CLI 进程和锁文件已清理`);
  }

  /**
   * 获取所有活跃的 session ID
   */
  public getActiveSessions(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * 检查指定 session 是否有活跃进程
   */
  public hasActiveProcess(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);
    return !!(process && !process.killed);
  }
}
