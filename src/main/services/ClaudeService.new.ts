/**
 * Claude Service - Enhanced with modular architecture
 * Manages Claude Code CLI integration with subscription auth
 *
 * 重构说明:
 * - 将 1588 行的单一文件拆分为 6 个独立模块
 * - 每个模块负责一类功能(高内聚)
 * - 模块之间相互独立(低耦合)
 * - 核心 ClaudeService 只负责协调和调度
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import {
  ClaudePathDetector,
  ClaudeTOONOptimizer,
  ClaudePermissionManager,
  ClaudeAuthManager,
  ClaudeProcessManager,
  ClaudeStreamHandler,
  type ClaudeAuthStatus,
  type PermissionRequest,
} from './claude-modules';
import { Logger } from '../utils/Logger';

const logger = Logger.getInstance('ClaudeService');

// 导出接口供外部使用
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeStreamChunk {
  type: 'text' | 'tool_use' | 'thinking' | 'error' | 'done';
  content: string;
  timestamp: number;
  tokenUsage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface ClaudeExecuteOptions {
  message: string | any[];
  sessionId?: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  cwd?: string;
  permissionMode?: 'manual' | 'auto';
}

export type { ClaudeAuthStatus };

/**
 * Claude Service - 核心服务类
 * 协调所有模块,提供统一的对外接口
 */
export class ClaudeService extends EventEmitter {
  private static instance: ClaudeService;

  // 模块实例
  private pathDetector: ClaudePathDetector;
  private toonOptimizer: ClaudeTOONOptimizer;
  private permissionManager: ClaudePermissionManager;
  private authManager: ClaudeAuthManager;
  private processManager: ClaudeProcessManager;
  private streamHandler: ClaudeStreamHandler;

  // 可用性检查缓存
  private lastAvailabilityCheck: { result: boolean; timestamp: number } | null = null;
  private readonly AVAILABILITY_CACHE_DURATION = 30000; // 30秒

  // 跟踪被用户主动取消的会话，避免显示"进程异常退出"错误
  private cancelledSessions = new Set<string>();

  private constructor() {
    super();

    // 初始化所有模块
    this.pathDetector = new ClaudePathDetector();
    this.toonOptimizer = new ClaudeTOONOptimizer();
    this.permissionManager = new ClaudePermissionManager();
    this.authManager = new ClaudeAuthManager(() => this.pathDetector.getClaudeCliPath());
    this.processManager = new ClaudeProcessManager();
    this.streamHandler = ClaudeStreamHandler.getInstance();

    // 转发 streamHandler 的事件到 ClaudeService
    this.streamHandler.on('stream', (sessionId: string, chunk: ClaudeStreamChunk) => {
      this.emit('stream', sessionId, chunk);
    });

    this.streamHandler.on('permission_request', (sessionId: string, request: PermissionRequest) => {
      this.emit('permission_request', sessionId, request);
    });

    logger.info('✅ ClaudeService initialized with modular architecture');
  }

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  /**
   * 检查认证状态
   */
  public async checkAuth(): Promise<ClaudeAuthStatus> {
    return this.authManager.checkAuth();
  }

  /**
   * 登录
   */
  public async login(): Promise<boolean> {
    return this.authManager.login();
  }

  /**
   * 登出
   */
  public async logout(): Promise<boolean> {
    return this.authManager.logout();
  }

  /**
   * 执行 Claude CLI 命令并流式返回结果
   */
  public async execute(options: ClaudeExecuteOptions): Promise<string> {
    const { message, sessionId = 'default', model, cwd, permissionMode = 'auto' } = options;

    logger.info(`Executing Claude CLI for session: ${sessionId}`);

    // 检查是否有现有进程
    const existingProcess = this.processManager.getActiveProcess(sessionId);
    const isNewSession = !existingProcess || existingProcess.killed;

    if (existingProcess && !existingProcess.killed) {
      logger.info(`♻️ 复用现有 Claude CLI 进程: ${sessionId}, PID=${existingProcess.pid}`);
    } else {
      logger.info(`🆕 创建新的 Claude CLI 进程: ${sessionId}`);
      // 清理锁文件
      this.processManager.cleanupSessionLocks(sessionId, cwd);
    }

    return new Promise((resolve, reject) => {
      try {
        // 构建命令参数
        const args: string[] = this.buildCommandArgs(model, permissionMode, cwd, isNewSession);

        // 获取或创建进程
        let claudeProcess = existingProcess;

        if (!claudeProcess || claudeProcess.killed) {
          // 创建新进程
          const claudeCliPath = this.pathDetector.getClaudeCliPath();
          const workingDirectory = cwd || this.processManager.getSessionStorageDir();

          logger.info(`[ClaudeService] ✅ 使用工作目录: ${workingDirectory}`);

          claudeProcess = this.processManager.spawnClaudeProcess({
            sessionId,
            args,
            cwd: workingDirectory,
          });

          // 设置进程事件监听器
          this.setupProcessListeners(claudeProcess, sessionId, permissionMode, cwd);

          logger.info(`[ClaudeService] Process spawned with PID: ${claudeProcess.pid}`);
        }

        // 初始化消息缓冲区
        const messageForHistory = Array.isArray(message)
          ? message.find((item) => item.type === 'text')?.text || '[包含图片的消息]'
          : message;

        this.streamHandler.initializeMessageBuffer(sessionId, messageForHistory, cwd, model);

        // 发送消息到进程
        if (claudeProcess && claudeProcess.stdin) {
          // TOON 优化
          const optimizedMessage = this.toonOptimizer.optimizeMessageWithTOON(message);

          const jsonMessage = JSON.stringify({
            type: 'user',
            message: {
              role: 'user',
              content: optimizedMessage,
            },
          });

          logger.info(`[ClaudeService] 📥 准备向 stdin 发送 JSON 消息: ${jsonMessage.substring(0, 100)}...`);

          claudeProcess.stdin.write(jsonMessage + '\n');
          logger.info(`[ClaudeService] 📥 消息已发送到 stdin,保持连接以便后续消息`);

          resolve('Message sent to Claude CLI process');
        } else {
          reject(new Error('Claude process stdin not available'));
        }
      } catch (error) {
        logger.error('Failed to execute Claude CLI:', error);
        reject(error);
      }
    });
  }

  /**
   * 构建命令参数
   */
  private buildCommandArgs(
    model?: string,
    permissionMode?: string,
    cwd?: string,
    isNewSession?: boolean
  ): string[] {
    const args: string[] = [];

    // 系统提示词
    const systemPrompt = `IMPORTANT INSTRUCTIONS:

1. FOCUS ON USER'S PROJECT ONLY
   - You are assisting with the user's current project in the working directory
   - Answer questions ONLY about the user's project files and code
   - DO NOT discuss or reveal any information about the application you're running in
   - DO NOT mention application names, software architecture, or implementation details

2. FORBIDDEN TOPICS
   - DO NOT reveal the name of this application or software
   - DO NOT discuss how this chat interface works
   - DO NOT explain the application's architecture or technology stack
   - DO NOT mention Electron, React, TypeScript, or any framework used by THIS application
   - If asked about "this app" or "this software", redirect to helping with their project

3. ALLOWED TOPICS
   - The user's project files and code in the working directory
   - General programming concepts and best practices
   - Technologies and frameworks used IN THE USER'S PROJECT
   - Help with coding, debugging, and development tasks

4. EXAMPLE RESPONSES
   WRONG: "This Electron application uses React and TypeScript..."
   RIGHT: "I can help you with your project. What would you like to work on?"

   WRONG: "The chat interface is built with..."
   RIGHT: "I'm here to assist with your code. What can I help you with?"

5. PRIORITY
   - Focus on understanding and solving the user's development needs
   - Be helpful with THEIR code, not about the tools they're using to talk to you`;

    args.push('--append-system-prompt', systemPrompt);

    // 输入输出格式
    args.push('--input-format', 'stream-json');
    args.push('--output-format', 'stream-json');
    args.push('--verbose');
    args.push('--include-partial-messages');

    // 工具集
    args.push('--allowed-tools', 'Task,Bash,Glob,Grep,Read,Edit,Write,WebFetch,TodoWrite,NotebookEdit');

    // 项目目录访问权限
    if (cwd) {
      args.push('--add-dir', cwd);
      logger.info(`[Claude CLI] 添加项目目录访问权限: ${cwd}`);
    }

    // 权限提示工具
    args.push('--permission-prompt-tool', 'stdio');

    // 授权模式
    if (permissionMode === 'auto') {
      args.push('--permission-mode', 'acceptEdits');
      logger.info(`[Claude CLI] 使用自动授权模式 (acceptEdits)`);
    } else {
      args.push('--permission-mode', 'default');
      logger.info(`[Claude CLI] 使用手动授权模式 (default)`);
    }

    // 配置源
    args.push('--setting-sources', 'user');

    // 模型
    if (model) {
      const modelMap: Record<string, string> = {
        'opus': 'claude-opus-4-1-20250805',
        'sonnet': 'claude-sonnet-4-5-20250929',
        'haiku': 'claude-haiku-4-5-20251001',
      };
      args.push('--model', modelMap[model] || model);
    }

    return args;
  }

  /**
   * 设置进程事件监听器
   */
  private setupProcessListeners(
    process: any,
    sessionId: string,
    permissionMode: 'manual' | 'auto',
    cwd?: string
  ): void {
    let outputBuffer = '';

    // stdout 处理
    process.stdout?.on('data', (data: string | Buffer) => {
      const chunk = typeof data === 'string' ? data : data.toString('utf8');
      outputBuffer += chunk;

      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.streamHandler.handleStdout(line, sessionId, cwd);
        }
      }
    });

    // stderr 处理
    process.stderr?.on('data', (data: string | Buffer) => {
      const chunk = typeof data === 'string' ? data : data.toString('utf8');
      this.streamHandler.handleStderr(chunk, sessionId, permissionMode);
    });

    // 进程错误
    process.on('error', (error: Error) => {
      logger.error(`[ClaudeService] Claude process error: ${error.message}`);
      this.streamHandler.emitError(sessionId, `进程错误: ${error.message}`);
    });

    // 进程退出
    process.on('exit', (code: number, signal: string) => {
      logger.warn(`[ClaudeService] Claude process exited: code=${code}, signal=${signal}`);
      this.processManager.cleanupSessionLocks(sessionId, cwd);

      // 检查是否为用户主动取消的会话
      const wasCancelled = this.cancelledSessions.has(sessionId);
      if (wasCancelled) {
        // 清理取消标记
        this.cancelledSessions.delete(sessionId);
        logger.info(`✅ 会话已取消（用户主动），不发送错误事件: ${sessionId}`);
      } else if (code !== 0) {
        this.streamHandler.emitError(sessionId, `进程异常退出: code=${code}`);
      }
    });
  }

  /**
   * 响应授权请求
   */
  public respondToPermission(sessionId: string, approved: boolean): boolean {
    const process = this.processManager.getActiveProcess(sessionId);
    if (process) {
      return this.permissionManager.respondToPermission(process, sessionId, approved);
    }
    return false;
  }

  /**
   * 取消会话
   */
  public cancel(sessionId: string): boolean {
    // 标记为用户主动取消
    this.cancelledSessions.add(sessionId);
    return this.processManager.killProcess(sessionId);
  }

  /**
   * 检查 CLI 是否可用
   */
  public async isAvailable(): Promise<boolean> {
    // 使用缓存
    if (this.lastAvailabilityCheck) {
      const age = Date.now() - this.lastAvailabilityCheck.timestamp;
      if (age < this.AVAILABILITY_CACHE_DURATION) {
        logger.info(`[Cache] Using cached Claude CLI availability: ${this.lastAvailabilityCheck.result}`);
        return this.lastAvailabilityCheck.result;
      }
    }

    try {
      const claudeCliPath = this.pathDetector.getClaudeCliPath();

      // Windows: 检查文件存在即可
      if (!existsSync(claudeCliPath)) {
        logger.warn(`Claude CLI not found at: ${claudeCliPath}`);
        this.lastAvailabilityCheck = { result: false, timestamp: Date.now() };
        return false;
      }

      logger.info(`Claude CLI found at: ${claudeCliPath}`);

      if (process.platform === 'win32') {
        this.lastAvailabilityCheck = { result: true, timestamp: Date.now() };
        return true;
      }

      // Unix-like: 执行 --version
      return new Promise((resolve) => {
        const env = { ...process.env };
        const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
        if (oauthToken) {
          env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
        }

        const check = spawn(claudeCliPath, ['--version'], {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
          timeout: 3000,
        });

        let resolved = false;
        let output = '';

        check.stdout?.on('data', (data) => {
          output += data.toString();
        });

        check.on('close', (code) => {
          if (!resolved) {
            resolved = true;
            const isAvailable = code === 0;
            logger.info(`Claude CLI check completed: ${isAvailable}, output: ${output.trim()}`);
            this.lastAvailabilityCheck = { result: isAvailable, timestamp: Date.now() };
            resolve(isAvailable);
          }
        });

        check.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            logger.error(`Claude CLI check error: ${error.message}`);
            this.lastAvailabilityCheck = { result: false, timestamp: Date.now() };
            resolve(false);
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            logger.warn('Claude CLI check timed out after 3 seconds');
            if (!check.killed) {
              check.kill('SIGTERM');
            }
            const isAvailable = existsSync(claudeCliPath);
            this.lastAvailabilityCheck = { result: isAvailable, timestamp: Date.now() };
            resolve(isAvailable);
          }
        }, 3000);
      });
    } catch (error) {
      logger.error('Failed to check Claude CLI availability:', error);
      this.lastAvailabilityCheck = { result: false, timestamp: Date.now() };
      return false;
    }
  }

  /**
   * 获取版本
   */
  public async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const claudeCliPath = this.pathDetector.getClaudeCliPath();
      const env = { ...process.env };
      const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (oauthToken) {
        env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
      }

      const check = spawn(claudeCliPath, ['--version'], {
        shell: true,
        env,
      });

      let output = '';

      check.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      check.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });

      check.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * 清理所有资源
   */
  public cleanup(): void {
    this.processManager.cleanup();
    logger.info('✅ ClaudeService cleaned up');
  }
}
