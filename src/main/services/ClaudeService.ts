/**
 * Claude CLI Service
 * Manages Claude Code CLI integration with subscription auth
 */

import { spawn, ChildProcess, exec, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/Logger';
import { homedir } from 'os';
import { app } from 'electron';
import { SessionHistoryService } from './SessionHistoryService';
import { ConversationMessage } from './ConversationDatabase';
import { ChangeTrackerService } from './github/ChangeTrackerService';
import { GitHubSyncService } from './github/GitHubSyncService';

const logger = Logger.getInstance('ClaudeService');

// ⭐ TOON 库动态导入（ESM 模块）
// 使用 eval 绕过 TypeScript 编译器将 import() 转换为 require()
let toonEncode: ((data: any, options?: any) => string) | null = null;
(async () => {
  try {
    // eslint-disable-next-line no-eval
    const toon = await eval('import("@toon-format/toon")');
    toonEncode = toon.encode;
    logger.info('[TOON] TOON 库加载成功');
  } catch (error) {
    logger.warn('[TOON] TOON 库加载失败，将禁用 TOON 优化:', error);
  }
})();

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
  message: string | any[];  // ⭐⭐⭐ 支持多模态消息（字符串或数组）
  sessionId?: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  cwd?: string;
  permissionMode?: 'manual' | 'auto';  // ⭐ 授权模式
}

export interface ClaudeAuthStatus {
  isAuthenticated: boolean;
  email?: string;
  subscription?: string;
}

export class ClaudeService extends EventEmitter {
  private static instance: ClaudeService;
  // 使用项目路径作为 key，每个项目一个持久的 Claude CLI 进程
  private activeProcesses = new Map<string, ChildProcess>();
  private isAuthenticated = false;
  private claudeCliPath: string | null = null;
  // ⭐ 统一的 session 存储目录（应用数据目录）
  private sessionStorageDir: string;
  // ⭐ 累积完整 assistant 消息的缓冲区（按 sessionId）
  private messageBuffers = new Map<string, {
    userMessage: string;
    assistantMessage: string;
    projectPath?: string;
    model?: string;
  }>();
  // 🆕 GitHub 同步服务
  private changeTracker = ChangeTrackerService.getInstance();
  private githubSync = GitHubSyncService.getInstance();
  // ⭐ 跟踪被用户主动取消的会话，避免显示"进程异常退出"错误
  private cancelledSessions = new Set<string>();

  private constructor() {
    super();
    // ⭐ 初始化 session 存储目录（使用应用根目录）
    // 在开发模式下：项目根目录/.claude-sessions
    // 在生产模式下：应用安装目录/.claude-sessions
    const appPath = app.isPackaged
      ? process.resourcesPath  // 打包后：resources 目录
      : app.getAppPath();      // 开发时：项目根目录

    this.sessionStorageDir = join(appPath, '.claude-sessions');

    if (!existsSync(this.sessionStorageDir)) {
      mkdirSync(this.sessionStorageDir, { recursive: true });
      logger.info(`📁 创建 session 存储目录: ${this.sessionStorageDir}`);
    } else {
      logger.info(`📁 使用 session 存储目录: ${this.sessionStorageDir}`);
    }
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
        // ⭐ Claude Code CLI 官方安装路径（最常见）
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
            logger.info(`Found Claude CLI in PATH: ${fullPath}`);
            return fullPath;
          }
        }
      }
    } catch (error) {
      logger.error('Error searching PATH:', error);
    }

    return null;
  }

  /**
   * 获取 Claude CLI 路径（带缓存和自动检测）
   */
  private getClaudeCliPath(): string {
    // 如果已缓存,直接返回
    if (this.claudeCliPath) {
      return this.claudeCliPath;
    }

    logger.info('[ClaudeService] 开始查找 Claude CLI 路径...');

    // 1. 尝试从 PATH 环境变量查找
    const pathFromEnv = this.findClaudeInPath();
    if (pathFromEnv) {
      this.claudeCliPath = pathFromEnv;
      logger.info(`[ClaudeService] ✓ 从 PATH 找到 Claude CLI: ${pathFromEnv}`);
      return pathFromEnv;
    }

    // 2. 尝试常见安装路径
    logger.info('[ClaudeService] PATH 中未找到，尝试常见安装路径...');
    const commonPaths = this.getCommonInstallPaths();
    logger.info(`[ClaudeService] 检查 ${commonPaths.length} 个常见路径...`);

    for (const path of commonPaths) {
      logger.debug(`[ClaudeService] 检查路径: ${path}`);
      if (existsSync(path)) {
        this.claudeCliPath = path;
        logger.info(`[ClaudeService] ✓ 从常见路径找到 Claude CLI: ${path}`);
        return path;
      }
    }

    // 3. 如果都找不到,返回默认命令名(可能在 PATH 中)
    logger.warn('[ClaudeService] ⚠ Claude CLI 未在常见路径找到，使用默认命令 "claude"');
    logger.warn('[ClaudeService] 如果命令失败，请检查 Claude CLI 是否已安装并在 PATH 中');
    this.claudeCliPath = 'claude';
    return 'claude';
  }

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  /**
   * ⭐ TOON 优化：智能检测并转换结构化数据
   * 只在消息包含 JSON 数组/对象时转换为 TOON 格式，节省 token
   */
  private optimizeMessageWithTOON(message: string | any[]): string | any[] {
    // 🔥 如果 TOON 库未加载，直接返回原消息
    if (!toonEncode) {
      return message;
    }

    // 如果是数组（多模态消息），不做处理
    if (Array.isArray(message)) {
      return message;
    }

    // 尝试检测消息中是否包含 JSON 数据块
    const jsonBlockPattern = /```json\n([\s\S]*?)\n```/g;
    const jsonInlinePattern = /(\{[\s\S]{100,}\}|\[[\s\S]{100,}\])/g;

    let optimizedMessage = message;
    let tokensSaved = 0;

    // 替换 JSON 代码块
    optimizedMessage = optimizedMessage.replace(jsonBlockPattern, (match, jsonContent) => {
      try {
        const data = JSON.parse(jsonContent);

        // 只对数组或大对象使用 TOON
        if (Array.isArray(data) && data.length >= 5 && toonEncode) {
          const toonFormat = toonEncode(data, { indent: 1, delimiter: ',' });
          const originalLength = jsonContent.length;
          const toonLength = toonFormat.length;
          tokensSaved += originalLength - toonLength;

          logger.info(`[TOON] 优化 JSON 代码块: ${originalLength} → ${toonLength} 字符，节省 ${((1 - toonLength / originalLength) * 100).toFixed(1)}%`);

          return `\`\`\`toon\n${toonFormat}\n\`\`\``;
        }

        return match;
      } catch (e) {
        // 无效JSON，保持原样
        return match;
      }
    });

    // 替换内联 JSON（>100字符的对象/数组）
    optimizedMessage = optimizedMessage.replace(jsonInlinePattern, (match) => {
      try {
        const data = JSON.parse(match);

        // 只对均匀数组使用 TOON
        if (Array.isArray(data) && data.length >= 5 && this.isUniformArray(data) && toonEncode) {
          const toonFormat = toonEncode(data, { indent: 1, delimiter: ',' });
          const originalLength = match.length;
          const toonLength = toonFormat.length;
          tokensSaved += originalLength - toonLength;

          logger.info(`[TOON] 优化内联 JSON: ${originalLength} → ${toonLength} 字符，节省 ${((1 - toonLength / originalLength) * 100).toFixed(1)}%`);

          return toonFormat;
        }

        return match;
      } catch (e) {
        // 无效JSON，保持原样
        return match;
      }
    });

    if (tokensSaved > 0) {
      logger.info(`[TOON] 总计节省约 ${tokensSaved} 字符 ≈ ${Math.ceil(tokensSaved / 4)} tokens`);
    }

    return optimizedMessage;
  }

  /**
   * ⭐ 判断数组是否均匀（所有元素结构相似）
   */
  private isUniformArray(arr: any[]): boolean {
    if (arr.length === 0) return false;

    const firstItem = arr[0];
    if (typeof firstItem !== 'object' || firstItem === null) return false;

    const firstKeys = Object.keys(firstItem).sort().join(',');

    // 检查至少 80% 的元素具有相同的键
    const uniformCount = arr.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      const keys = Object.keys(item).sort().join(',');
      return keys === firstKeys;
    }).length;

    return uniformCount / arr.length >= 0.8;
  }

  /**
   * Check authentication status
   */
  public async checkAuth(): Promise<ClaudeAuthStatus> {
    return new Promise((resolve) => {
      try {
        const claudeCliPath = this.getClaudeCliPath();
        logger.info(`Checking Claude CLI auth status: ${claudeCliPath}`);

        // 构建环境变量：继承并传递 OAuth token
        const env = { ...process.env };
        const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
        if (oauthToken) {
          env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
          logger.info('CLAUDE_CODE_OAUTH_TOKEN found for auth check');
        }

        const check = spawn(claudeCliPath, ['auth', 'status'], {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'], // 关键修复：ignore stdin 防止挂起
          env, // 传递环境变量
        });

        let output = '';
        let errorOutput = '';
        let resolved = false;

        check.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        check.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        check.on('close', (code) => {
          if (!resolved) {
            resolved = true;
            logger.info(`Claude CLI auth check completed with code: ${code}`);
            logger.debug(`Auth check output: ${output}`);

            if (code === 0 && output.toLowerCase().includes('authenticated')) {
              this.isAuthenticated = true;

              // 尝试提取邮箱和订阅信息
              const emailMatch = output.match(/email:\s*([^\n]+)/i);
              const subMatch = output.match(/subscription:\s*([^\n]+)/i);

              resolve({
                isAuthenticated: true,
                email: emailMatch ? emailMatch[1].trim() : undefined,
                subscription: subMatch ? subMatch[1].trim() : undefined,
              });
            } else {
              this.isAuthenticated = false;
              resolve({ isAuthenticated: false });
            }
          }
        });

        check.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            logger.error(`Claude CLI auth check error: ${error.message}`);
            this.isAuthenticated = false;
            resolve({ isAuthenticated: false });
          }
        });

        // Timeout - 增加到 15 秒
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            logger.warn('Claude CLI auth check timed out after 15 seconds');
            if (!check.killed) {
              check.kill();
            }
            // 超时时假设已认证，因为 CLI 命令能正常工作
            resolve({ isAuthenticated: true });
          }
        }, 15000);
      } catch (error) {
        logger.error('Failed to check Claude CLI auth:', error);
        resolve({ isAuthenticated: false });
      }
    });
  }

  /**
   * Login to Claude CLI (opens browser for OAuth)
   */
  public async login(): Promise<boolean> {
    logger.info('Starting Claude CLI login...');

    return new Promise((resolve) => {
      const claudeCliPath = this.getClaudeCliPath();
      const loginProcess = spawn(claudeCliPath, ['auth', 'login'], {
        shell: true,
        stdio: 'inherit', // 继承父进程的 stdio,允许用户交互
      });

      loginProcess.on('close', async (code) => {
        if (code === 0) {
          // 验证登录状态
          const status = await this.checkAuth();
          this.isAuthenticated = status.isAuthenticated;

          if (this.isAuthenticated) {
            logger.info('Claude CLI login successful');
            resolve(true);
          } else {
            logger.warn('Claude CLI login completed but auth check failed');
            resolve(false);
          }
        } else {
          logger.error(`Claude CLI login failed with code ${code}`);
          this.isAuthenticated = false;
          resolve(false);
        }
      });

      loginProcess.on('error', (error) => {
        logger.error('Claude CLI login error:', error);
        this.isAuthenticated = false;
        resolve(false);
      });
    });
  }

  /**
   * Logout from Claude CLI
   */
  public async logout(): Promise<boolean> {
    logger.info('Logging out from Claude CLI...');

    return new Promise((resolve) => {
      const claudeCliPath = this.getClaudeCliPath();
      const logoutProcess = spawn(claudeCliPath, ['auth', 'logout'], {
        shell: true,
        stdio: 'inherit',
      });

      logoutProcess.on('close', (code) => {
        if (code === 0) {
          this.isAuthenticated = false;
          logger.info('Claude CLI logout successful');
          resolve(true);
        } else {
          logger.error(`Claude CLI logout failed with code ${code}`);
          resolve(false);
        }
      });

      logoutProcess.on('error', (error) => {
        logger.error('Claude CLI logout error:', error);
        resolve(false);
      });
    });
  }

  /**
   * Execute Claude CLI command and stream response
   * ⭐ 使用进程复用模式 - 每个 session 复用同一个进程,保持上下文
   */
  public async execute(options: ClaudeExecuteOptions): Promise<string> {
    const { message, sessionId = 'default', model, cwd, permissionMode = 'auto' } = options;

    logger.info(`Executing Claude CLI for session: ${sessionId}`);

    // ⭐⭐⭐ 交互模式：复用进程，保持会话上下文
    // 每个 session 只启动一次进程，后续消息复用该进程
    let existingProcess = this.activeProcesses.get(sessionId);

    if (existingProcess && !existingProcess.killed) {
      // ⭐ 进程还在运行，直接复用
      logger.info(`♻️ 复用现有 Claude CLI 进程: ${sessionId}, PID=${existingProcess.pid}`);

      // 直接发送消息到现有进程（后面的代码会处理）
      // 不需要等待，不需要重启，这就是交互模式的优势！
    } else {
      // ⭐ 进程不存在或已结束 - 创建新进程
      logger.info(`🆕 创建新的 Claude CLI 进程: ${sessionId}`);

      // ⭐⭐⭐ 启动前清理锁文件
      logger.info(`清理可能存在的锁文件...`);
      this.cleanupSessionLocks(sessionId, cwd);
    }

    return new Promise((resolve, reject) => {
      try {

        // Build command args
        const args: string[] = [];
        let claudeProcess: ChildProcess | null = null;

        // ⭐ 定义进程输出变量（在外部定义，以便 if-else 两个分支都能访问）
        let processOutput = '';
        let processErrorOutput = '';
        let outputBuffer = ''; // 用于缓冲不完整的 JSON 行

        // ⭐ 系统提示词：禁止透露软件内部实现，专注于用户项目
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
        logger.info('[Claude CLI] 已添加系统提示词：禁止透露软件信息');

        // ⭐⭐⭐ 参照 VSCode Claude Code 扩展：不使用 --session-id
        // VSCode 扩展让 Claude CLI 自动管理 session，通过工作目录（cwd）区分不同项目
        // 这样可以避免 "Session ID already in use" 错误
        //
        // 注意：Claude CLI 会自动在 cwd 目录下创建和管理 session 文件
        // 每个工作目录对应一个独立的 session

        const isNewSession = !this.activeProcesses.has(sessionId);

        // ⭐ 不使用 --session-id，让 Claude CLI 自动管理（参照 VSCode）
        // args.push('--session-id', sessionId);  // ⭐ 注释掉，改用自动 session 管理

        if (isNewSession) {
          logger.info(`[Claude CLI] 启动新会话进程，自动 session 管理`);
        } else {
          logger.info(`[Claude CLI] 复用现有会话进程`);
        }

        // 使用流式 JSON 输入输出格式（参照 VSCode Claude Code）
        // ⭐⭐⭐ 不使用 --print，保持进程长期运行（交互模式）
        // ⭐ input-format stream-json: stdin 接收 JSON 格式消息
        // ⭐ output-format stream-json: 实时流式输出 JSON 事件
        // ⭐ verbose: stream-json 必需
        // ⭐ include-partial-messages: 包含部分消息块(真正的流式体验!)
        // args.push('--print');  // ⭐ 移除 --print，改用交互模式
        args.push('--input-format', 'stream-json');  // ⭐ 添加输入格式（参照 VSCode）
        args.push('--output-format', 'stream-json');
        args.push('--verbose');
        args.push('--include-partial-messages');

        // ⭐ 授权模式配置（支持两种模式）
        // 参照 Claude Code 底层逻辑，支持完整的工具集
        args.push('--allowed-tools', 'Task,Bash,Glob,Grep,Read,Edit,Write,WebFetch,TodoWrite,NotebookEdit');

        // ⭐⭐⭐ 关键修复：添加项目目录访问权限
        // 因为我们使用固定的 cwd（session 存储目录），需要通过 --add-dir 让 Claude 访问项目目录
        if (cwd) {
          args.push('--add-dir', cwd);
          logger.info(`[Claude CLI] 添加项目目录访问权限: ${cwd}`);
        }

        // ⭐⭐⭐ 参照 VSCode：使用 stdio 模式进行权限提示
        args.push('--permission-prompt-tool', 'stdio');

        if (permissionMode === 'auto') {
          // 自动授权模式：自动批准所有工具使用
          args.push('--permission-mode', 'acceptEdits');
          logger.info(`[Claude CLI] 使用自动授权模式 (acceptEdits)`);
        } else {
          // 手动授权模式：使用 default 模式（参照 VSCode）
          args.push('--permission-mode', 'default');
          logger.info(`[Claude CLI] 使用手动授权模式 (default)`);
        }

        // ⚠️ 禁止使用危险的 --dangerously-skip-permissions
        // 该选项会跳过所有安全检查，不允许使用

        // 只加载用户级别的配置，忽略项目和本地配置
        args.push('--setting-sources', 'user');

        // 映射 model 到实际的 Claude CLI 模型 ID
        if (model) {
          const modelMap: Record<string, string> = {
            'opus': 'claude-opus-4-1-20250805',
            'sonnet': 'claude-sonnet-4-5-20250929',  // Sonnet 4.5
            'haiku': 'claude-haiku-4-5-20251001',    // Haiku 4.5
          };
          args.push('--model', modelMap[model] || model);
        }

        logger.debug(`Claude CLI 启动参数: claude ${args.join(' ')}`);
        logger.debug(`用户消息将通过 stdin 发送: "${message}"`);

        // Spawn Claude CLI process
        const claudeCliPath = this.getClaudeCliPath();

        // 构建环境变量
        const env = { ...process.env };
        const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
        if (oauthToken) {
          logger.info(`Using CLAUDE_CODE_OAUTH_TOKEN (length: ${oauthToken.length})`);
          env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
        } else {
          logger.warn('CLAUDE_CODE_OAUTH_TOKEN environment variable not found');
        }

        // ⭐⭐⭐ 只在进程不存在时才启动新进程（交互模式核心逻辑）
        if (!existingProcess || existingProcess.killed) {
          // 启动持久的 Claude CLI 进程
          logger.info(`[ClaudeService] Spawning process: ${claudeCliPath} ${args.join(' ')}`);
          logger.info(`[ClaudeService] Session 存储目录: ${this.sessionStorageDir}`);
          logger.info(`[ClaudeService] 项目目录: ${cwd || 'none'}`);

          // ⭐⭐⭐ 修复：使用用户项目目录作为 cwd，而不是 session 存储目录
          // 这样 Claude CLI 创建的文件会在用户的项目目录中
          // Session 文件通过 Claude CLI 自动管理（存储在 cwd/.claude-code/ 下）
          const workingDirectory = cwd || this.sessionStorageDir;
          logger.info(`[ClaudeService] ✅ 使用工作目录: ${workingDirectory}`);

          claudeProcess = spawn(claudeCliPath, args, {
            cwd: workingDirectory,  // ⭐ 使用项目目录而不是 session 存储目录
            shell: false,  // ⭐ 关键修改: 不使用 shell,直接执行
            stdio: ['pipe', 'pipe', 'pipe'], // 保持 stdin 打开
            env,
          });

          logger.info(`[ClaudeService] Process spawned with PID: ${claudeProcess.pid}`);

        // ⭐ 关键修复：在 Windows 上必须显式设置 UTF-8 编码
        // Claude CLI 输出的是 UTF-8，但 Windows Node.js 默认使用 GBK
        if (claudeProcess.stdout) {
          claudeProcess.stdout.setEncoding('utf8');
        }
        if (claudeProcess.stderr) {
          claudeProcess.stderr.setEncoding('utf8');
        }

        // 设置进程事件监听器（仅在创建时设置一次）
        // Handle stdout (stream-json format)
        claudeProcess.stdout?.on('data', (data: string | Buffer) => {
          const chunk = typeof data === 'string' ? data : data.toString('utf8');
          processOutput += chunk;
          outputBuffer += chunk;

          // ⭐ 只在 debug 模式下显示原始数据，减少日志冗余
          // logger.info(`[ClaudeService] 📤 收到 stdout 数据 (${chunk.length} 字节): ${chunk.substring(0, 200)}`);

          // 按行分割处理 JSON 流
          const lines = outputBuffer.split('\n');
          // 保留最后一个不完整的行
          outputBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const jsonData = JSON.parse(line);
              // ⭐ 只显示关键事件，不显示每个文本片段
              // logger.debug(`[ClaudeService] stream-json event: type=${jsonData.type}`);

              // ⭐ 处理 stream-json 格式的事件
              if (jsonData.type === 'system') {
                // 系统初始化事件 - 忽略
                logger.info(`[ClaudeService] System init: session_id=${jsonData.session_id}, model=${jsonData.model}`);
              } else if (jsonData.type === 'stream_event') {
                // ⭐ 流式事件 (使用 --include-partial-messages 时)
                // 参照 Claude Code 底层逻辑，处理所有类型的 stream_event
                const event = jsonData.event;
                if (event) {
                  // 1️⃣ 消息开始事件
                  if (event.type === 'message_start') {
                    logger.info(`[ClaudeService] 💭 Message started`);
                    // 可以在这里显示 "Claude is thinking..."
                    this.emit('stream', sessionId, {
                      type: 'thinking',
                      content: '💭 Claude is thinking...\n',
                      timestamp: Date.now(),
                    } as ClaudeStreamChunk);
                  }

                  // 2️⃣ 内容块开始事件
                  else if (event.type === 'content_block_start') {
                    if (event.content_block?.type === 'text') {
                      // 文本块开始 - 不记录日志，避免冗余
                    } else if (event.content_block?.type === 'tool_use') {
                      // ⭐ 工具调用开始 - 简化显示，只显示工具名称
                      const toolName = event.content_block.name || 'Unknown';
                      logger.info(`[ClaudeService] 🔧 Tool: ${toolName}`);

                      // 🆕 记录工具调用（用于 GitHub 同步）
                      if (['Edit', 'Write', 'Bash'].includes(toolName) && cwd) {
                        // 暂时不提取 filePath，等待 tool_use delta 来获取参数
                        this.changeTracker.recordToolCall(cwd, sessionId, toolName);
                      }

                      this.emit('stream', sessionId, {
                        type: 'tool_use',
                        content: `\n ${toolName}\n`,
                        timestamp: Date.now(),
                      } as ClaudeStreamChunk);
                    }
                  }

                  // 3️⃣ 内容块增量事件（最重要！）
                  else if (event.type === 'content_block_delta') {
                    if (event.delta?.type === 'text_delta') {
                      // ⭐ 文本增量 - 立即流式输出!
                      const textDelta = event.delta.text;
                      this.emit('stream', sessionId, {
                        type: 'text',
                        content: textDelta,
                        timestamp: Date.now(),
                      } as ClaudeStreamChunk);

                      // ⭐ 累积 assistant 消息文本（用于后续保存）
                      const buffer = this.messageBuffers.get(sessionId);
                      if (buffer) {
                        buffer.assistantMessage += textDelta;
                      }
                    } else if (event.delta?.type === 'input_json_delta') {
                      // ⭐ 工具参数增量 - 显示工具正在构建参数
                      // 这是 Claude Code 的关键特性：实时显示工具参数构建过程
                      const partialJson = event.delta.partial_json || '';
                      if (partialJson.trim()) {
                        // ⭐ 只在 debug 模式下显示参数构建过程，减少日志冗余
                        // logger.debug(`[ClaudeService] Tool input building: ${partialJson.substring(0, 50)}...`);

                        // ⭐⭐⭐ 不显示"Building parameters..."消息，减少界面冗余
                        // 用户反馈：这些消息太多了，界面上重复显示
                        // 如果需要显示，应该只显示一次，而不是每个 delta 都显示
                        /*
                        this.emit('stream', sessionId, {
                          type: 'tool_use',
                          content: `   📝 Building parameters...\n`,
                          timestamp: Date.now(),
                        } as ClaudeStreamChunk);
                        */
                      }
                    }
                  }

                  // 4️⃣ 内容块结束事件
                  else if (event.type === 'content_block_stop') {
                    // ⭐ 减少日志冗余 - 内容块结束事件不重要
                    // logger.debug(`[ClaudeService] Content block stopped at index ${event.index}`);
                  }

                  // 5️⃣ 消息结束事件
                  else if (event.type === 'message_stop') {
                    // ⭐ 减少日志冗余 - 只在需要时记录
                    // logger.debug(`[ClaudeService] Message stopped`);
                  }
                }
              } else if (jsonData.type === 'assistant') {
                // ⭐ 完整的 assistant 消息 (最后发送)
                const message = jsonData.message;
                if (message && message.content) {
                  for (const contentBlock of message.content) {
                    if (contentBlock.type === 'text') {
                      // 文本内容 - 这通常是完整消息,已经通过 stream_event 发送过了
                      // 可以选择忽略或者用于验证
                      // ⭐ 减少日志冗余
                      // logger.debug(`[ClaudeService] Complete assistant message received`);
                    } else if (contentBlock.type === 'tool_use') {
                      // 工具调用信息
                      // ⭐ 减少日志冗余 - 只在需要时记录
                      // logger.debug(`[ClaudeService] Tool use complete: ${contentBlock.name}`);
                    }
                  }
                }
              } else if (jsonData.type === 'user') {
                // ⭐ 用户消息(工具结果) - 不显示详细结果，减少界面冗余
                // 工具结果会在stderr中显示，这里不需要重复
                const message = jsonData.message;
                if (message && message.content) {
                  for (const contentBlock of message.content) {
                    if (contentBlock.type === 'tool_result') {
                      // ⭐ 简化显示：只显示一个简单的完成标记
                      this.emit('stream', sessionId, {
                        type: 'tool_use',
                        content: `✅\n`,
                        timestamp: Date.now(),
                      } as ClaudeStreamChunk);
                    }
                  }
                }
              } else if (jsonData.type === 'result') {
                // ⭐ 最终结果 - 发送 done 事件和 token 统计
                // 参照 Claude Code 底层逻辑，显示完整的 token 使用信息（包括缓存）
                const usage = jsonData.usage;
                const tokenUsage = {
                  input_tokens: usage?.input_tokens || 0,
                  output_tokens: usage?.output_tokens || 0,
                  cache_creation_input_tokens: usage?.cache_creation_input_tokens || 0,
                  cache_read_input_tokens: usage?.cache_read_input_tokens || 0,
                };

                // 计算缓存节省的成本
                const cacheHitRate = tokenUsage.cache_read_input_tokens > 0
                  ? ((tokenUsage.cache_read_input_tokens / (tokenUsage.input_tokens + tokenUsage.cache_read_input_tokens)) * 100).toFixed(1)
                  : '0.0';

                logger.info(`[ClaudeService] ✅ Final result: duration=${jsonData.duration_ms}ms, cost=$${jsonData.total_cost_usd}`);
                logger.info(`[ClaudeService] 📊 Token usage: input=${tokenUsage.input_tokens}, output=${tokenUsage.output_tokens}`);
                if (tokenUsage.cache_read_input_tokens > 0) {
                  logger.info(`[ClaudeService] 💾 Cache hit: ${tokenUsage.cache_read_input_tokens} tokens (${cacheHitRate}% hit rate)`);
                }
                if (tokenUsage.cache_creation_input_tokens > 0) {
                  logger.info(`[ClaudeService] 📝 Cache created: ${tokenUsage.cache_creation_input_tokens} tokens`);
                }


                // 🆕 记录消息（触发自动同步检查）
                if (cwd) {
                  this.githubSync.recordMessage(cwd, sessionId);
                  logger.debug(`[ClaudeService] 📝 Message recorded for GitHub sync check`);
                }

                // ⭐ 不再发送统计摘要消息到前端
                // this.emit('stream', sessionId, {
                //   type: 'text',
                //   content: summaryMessage,
                //   timestamp: Date.now(),
                // } as ClaudeStreamChunk);

                this.emit('stream', sessionId, {
                  type: 'done',
                  content: '',
                  timestamp: Date.now(),
                  tokenUsage,
                } as ClaudeStreamChunk);

                // ⭐ 保存完整的 assistant 消息到历史
                const buffer = this.messageBuffers.get(sessionId);
                if (buffer && buffer.assistantMessage.trim().length > 0) {
                  SessionHistoryService.getInstance().saveMessage({
                    sessionId,
                    timestamp: Date.now(),
                    role: 'assistant',
                    content: buffer.assistantMessage,
                    projectPath: buffer.projectPath,
                    metadata: {
                      model: buffer.model,
                      tokenCount: tokenUsage.output_tokens
                    }
                  }).then(() => {
                    logger.info(`💾 Assistant 消息已保存到历史: ${buffer.assistantMessage.length} 字符`);
                    // 清理缓冲区
                    this.messageBuffers.delete(sessionId);
                  }).catch(err => {
                    logger.warn(`保存 assistant 消息失败: ${err}`);
                  });
                }
              }
            } catch (e) {
              // ⭐ 如果不是 JSON，说明是纯文本输出(使用 --resume 模式时)
              // 将纯文本作为流式输出发送
              if (line.trim()) {
                logger.debug(`[ClaudeService] Plain text output: ${line.substring(0, 100)}`);
                this.emit('stream', sessionId, {
                  type: 'text',
                  content: line + '\n',
                  timestamp: Date.now(),
                } as ClaudeStreamChunk);
              }
            }
          }
        });

        // Handle stderr (errors, progress, thinking, token usage, tool calls)
        claudeProcess.stderr?.on('data', (data: string | Buffer) => {
          const chunk = typeof data === 'string' ? data : data.toString('utf8');
          processErrorOutput += chunk;

          // ⭐ 添加原始 stderr 日志
          logger.info(`[ClaudeService] 📤 收到 stderr 数据 (${chunk.length} 字节): ${chunk}`);

          // ⭐⭐⭐ 移除重复的工具调用检测
          // stdout 中已经有完整的工具调用信息（来自stream_event）
          // stderr 中的工具调用信息是重复的，不需要再次显示
          // 只保留关键的进度信息（如果需要）

          // 不再显示所有的工具调用细节，减少界面冗余

          // Parse token usage from stderr
          const inputMatch = chunk.match(/Input tokens?:\s*(\d+)/i);
          const outputMatch = chunk.match(/Output tokens?:\s*(\d+)/i);
          const cacheCreationMatch = chunk.match(/Cache creation input tokens?:\s*(\d+)/i);
          const cacheReadMatch = chunk.match(/Cache read input tokens?:\s*(\d+)/i);

          if (inputMatch || outputMatch || cacheCreationMatch || cacheReadMatch) {
            const tokenUsage = {
              input_tokens: inputMatch ? parseInt(inputMatch[1], 10) : undefined,
              output_tokens: outputMatch ? parseInt(outputMatch[1], 10) : undefined,
              cache_creation_input_tokens: cacheCreationMatch ? parseInt(cacheCreationMatch[1], 10) : undefined,
              cache_read_input_tokens: cacheReadMatch ? parseInt(cacheReadMatch[1], 10) : undefined,
            };

            logger.info(`[ClaudeService] Token 使用统计: Input=${tokenUsage.input_tokens}, Output=${tokenUsage.output_tokens}`);

            this.emit('stream', sessionId, {
              type: 'done',
              content: '',
              timestamp: Date.now(),
              tokenUsage,
            } as ClaudeStreamChunk);
          }

          // ⭐ 检测授权请求（手动模式下）
          // 参照 Claude Code 底层逻辑，Claude CLI 会在 stderr 输出授权提示
          if (permissionMode === 'manual') {
            // Claude CLI 授权请求的特征模式（更全面的匹配）
            const permissionPatterns = [
              // 工具使用授权
              /approve.*?(write|edit|create|delete|bash|execute|read|glob|grep|task)/i,
              /permission.*?(write|edit|create|delete|bash|read|glob|grep|task)/i,
              /allow.*?(write|edit|create|delete|bash|execute|read|glob|grep|task)/i,
              // 文件操作授权
              /do you want to.*?(write|edit|create|delete|read).*?file/i,
              /confirm.*?(write|edit|create|delete).*?file/i,
              // 命令执行授权
              /execute.*?command/i,
              /run.*?(command|script)/i,
              // 通用授权提示
              /\(y\/n\)/i,  // 检测 y/n 提示
              /continue\?/i,
            ];

            for (const pattern of permissionPatterns) {
              if (pattern.test(chunk)) {
                // 尝试解析工具名称
                let toolName = 'Unknown';
                const toolMatch = chunk.match(/(Write|Edit|Read|Bash|Glob|Grep|Task|Delete|Create)/i);
                if (toolMatch) {
                  toolName = toolMatch[1];
                }

                // 检测到授权请求，发送 permission_request 事件
                logger.warn(`[ClaudeService] 🔐 检测到授权请求 (${toolName}): ${chunk.substring(0, 100)}`);
                this.emit('permission_request', sessionId, {
                  id: `${sessionId}-${Date.now()}`,
                  sessionId,
                  toolName,
                  action: chunk.trim(),
                  timestamp: Date.now(),
                });
                break;
              }
            }
          }

          // Check if it's thinking/progress or actual error
          if (chunk.includes('Thinking') || chunk.includes('Processing') || chunk.includes('Working')) {
            this.emit('stream', sessionId, {
              type: 'thinking',
              content: chunk,
              timestamp: Date.now(),
            } as ClaudeStreamChunk);
          }
        });

        // 监听进程错误
        claudeProcess.on('error', (error) => {
          logger.error(`[ClaudeService] Claude process error: ${error.message}`);
          this.emit('stream', sessionId, {
            type: 'error',
            content: `进程错误: ${error.message}`,
            timestamp: Date.now(),
          } as ClaudeStreamChunk);
        });

        // 监听进程退出（用于调试）
        claudeProcess.on('exit', (code, signal) => {
          logger.warn(`[ClaudeService] Claude process exited: code=${code}, signal=${signal}`);

          // ⭐ 进程退出时清理锁文件（类似 VSCode Claude Code）
          this.cleanupSessionLocks(sessionId, cwd);
          this.activeProcesses.delete(sessionId);
          logger.info(`🗑️ 进程退出，已清理 session: ${sessionId}`);

          // ⭐ 检查是否为用户主动取消的会话
          const wasCancelled = this.cancelledSessions.has(sessionId);
          if (wasCancelled) {
            // 清理取消标记
            this.cancelledSessions.delete(sessionId);
            logger.info(`✅ 会话已取消（用户主动），不发送错误事件: ${sessionId}`);
          } else if (code !== 0) {
            // 只有非主动取消且退出码非0时才发送错误
            this.emit('stream', sessionId, {
              type: 'error',
              content: `进程异常退出: code=${code}`,
              timestamp: Date.now(),
            } as ClaudeStreamChunk);
          }
        });

          // ⭐ 保存进程到 Map (支持进程复用)
          this.activeProcesses.set(sessionId, claudeProcess);

          // ⭐ 发送初始消息到新创建的进程
          logger.info(`发送初始消息到新 Claude CLI 进程 (session: ${sessionId})`);
        } else {
          // ⭐⭐⭐ 复用现有进程
          claudeProcess = existingProcess;
          logger.info(`♻️ 发送消息到现有 Claude CLI 进程 (session: ${sessionId})`);
        }

        // ⭐⭐⭐ 处理多模态消息：提取文本部分用于历史记录
        const messageForHistory = Array.isArray(message)
          ? message.find((item) => item.type === 'text')?.text || '[包含图片的消息]'
          : message;

        // ⭐ 初始化消息缓冲区（用于后续保存到历史）
        this.messageBuffers.set(sessionId, {
          userMessage: messageForHistory,
          assistantMessage: '',
          projectPath: cwd,
          model: model || 'sonnet'
        });

        // ⭐ 立即保存用户消息到历史
        SessionHistoryService.getInstance().saveMessage({
          sessionId,
          timestamp: Date.now(),
          role: 'user',
          content: messageForHistory,
          projectPath: cwd
        }).catch(err => {
          logger.warn(`保存用户消息到历史失败: ${err}`);
        });

        // ⭐⭐⭐ 发送消息到 stdin（新进程或现有进程都需要）
        if (claudeProcess && claudeProcess.stdin) {
          // ⭐⭐⭐ 使用 stream-json 输入格式（参照 VSCode Claude Code）
          // 支持多模态消息格式

          // 🔥 TOON优化：自动检测并转换JSON数据为TOON格式，节省token
          const optimizedMessage = this.optimizeMessageWithTOON(message);

          const jsonMessage = JSON.stringify({
            type: 'user',
            message: {
              role: 'user',
              content: optimizedMessage  // ⭐ 使用优化后的消息（可能包含TOON格式）
            }
          });

          logger.info(`[ClaudeService] 📥 准备向 stdin 发送 JSON 消息: ${jsonMessage.substring(0, 100)}...`);

          // 发送 JSON 消息到 stdin（每行一个 JSON 对象）
          const writeSuccess = claudeProcess.stdin.write(jsonMessage + '\n');

          // ⭐⭐⭐ 交互模式：不关闭 stdin，保持进程运行以便后续消息
          // 旧的 --print 模式需要关闭 stdin，但交互模式下 stdin 必须保持打开
          // claudeProcess.stdin.end();  // ⭐ 移除此行，改用交互模式
          logger.info(`[ClaudeService] 📥 消息已发送到 stdin，保持连接以便后续消息`);

          // ⭐ 记录写入结果
          logger.info(`[ClaudeService] 📥 stdin.write() 返回: ${writeSuccess}`);

          // ⭐ 检查进程状态
          logger.info(`[ClaudeService] 进程状态: PID=${claudeProcess.pid}, killed=${claudeProcess.killed}`)

          // ⭐ 5秒后检查是否有输出
          setTimeout(() => {
            if (processOutput.length === 0 && processErrorOutput.length === 0) {
              logger.error(`[ClaudeService] ⚠️ 警告: 进程启动5秒后仍未产生任何输出!`);
              logger.error(`[ClaudeService] PID: ${claudeProcess?.pid}, killed: ${claudeProcess?.killed}`);
            } else {
              logger.info(`[ClaudeService] ✅ 进程已产生输出: stdout=${processOutput.length}字节, stderr=${processErrorOutput.length}字节`);
            }
          }, 5000);

          resolve('Message sent to new Claude CLI process');
        } else {
          reject(new Error('Claude process stdin not available'));
          return;
        }
      } catch (error) {
        logger.error('Failed to execute Claude CLI:', error);
        reject(error);
      }
    });
  }

  /**
   * ⭐ 响应授权请求（手动模式下）
   */
  public respondToPermission(sessionId: string, approved: boolean): boolean {
    const process = this.activeProcesses.get(sessionId);

    if (process && process.stdin && !process.killed) {
      // 向 Claude CLI 的 stdin 发送授权响应
      const response = approved ? 'y\n' : 'n\n';
      process.stdin.write(response);
      logger.info(`[ClaudeService] 发送授权响应: ${approved ? 'approved' : 'denied'} for session ${sessionId}`);
      return true;
    }

    logger.warn(`[ClaudeService] 无法发送授权响应: session ${sessionId} not found or stdin not available`);
    return false;
  }

  /**
   * Cancel an active Claude session
   */
  public cancel(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);

    if (process && !process.killed) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
      logger.info(`Cancelled Claude session: ${sessionId}`);
      return true;
    }

    return false;
  }

  /**
   * Check if Claude CLI is available
   * 优化：添加缓存、更好的错误处理、减少不必要的检查
   */
  private lastAvailabilityCheck: { result: boolean; timestamp: number } | null = null;
  private readonly AVAILABILITY_CACHE_DURATION = 30000; // 30秒缓存

  public async isAvailable(): Promise<boolean> {
    // ⭐ 优化：使用缓存，避免频繁检查
    if (this.lastAvailabilityCheck) {
      const age = Date.now() - this.lastAvailabilityCheck.timestamp;
      if (age < this.AVAILABILITY_CACHE_DURATION) {
        logger.info(`[Cache] Using cached Claude CLI availability: ${this.lastAvailabilityCheck.result}`);
        return this.lastAvailabilityCheck.result;
      }
    }

    try {
      const claudeCliPath = this.getClaudeCliPath();

      // ⭐ 修复：在 Windows 上，直接检查文件是否存在且可执行
      // 避免执行 --version 命令导致的超时问题
      if (!existsSync(claudeCliPath)) {
        logger.warn(`Claude CLI not found at: ${claudeCliPath}`);
        this.lastAvailabilityCheck = { result: false, timestamp: Date.now() };
        return false;
      }

      logger.info(`Claude CLI found at: ${claudeCliPath}`);

      // ⭐ 在 Windows 上，只检查文件存在性就足够了
      // 因为执行 --version 可能会因为需要认证而挂起
      if (process.platform === 'win32') {
        // Windows: 文件存在即可用
        this.lastAvailabilityCheck = { result: true, timestamp: Date.now() };
        return true;
      }

      // ⭐ Unix-like 系统：尝试执行 --version（快速检查）
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
          timeout: 3000, // 缩短超时时间到 3 秒
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

        // 3 秒超时
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            logger.warn('Claude CLI check timed out after 3 seconds');
            if (!check.killed) {
              check.kill('SIGTERM');
            }
            // 超时时，如果文件存在，假设可用
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
   * Get Claude CLI version
   */
  public async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const claudeCliPath = this.getClaudeCliPath();

      // 构建环境变量：继承并传递 OAuth token
      const env = { ...process.env };
      const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (oauthToken) {
        env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
      }

      const check = spawn(claudeCliPath, ['--version'], {
        shell: true,
        env, // 传递环境变量
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
   * ⭐ 清理指定 session 的锁文件
   * 类似 VSCode Claude Code 的机制，防止锁文件导致的冲突
   */
  private cleanupSessionLocks(sessionId: string, cwd?: string): void {
    try {
      const claudeDir = join(homedir(), '.claude');
      logger.info(`🔍 开始清理锁文件，session: ${sessionId}, cwd: ${cwd}`);

      // ⭐⭐⭐ 清理全局锁文件 ~/.claude.lock (这是关键!)
      const globalLockFile = join(homedir(), '.claude.lock');
      if (existsSync(globalLockFile)) {
        try {
          unlinkSync(globalLockFile);
          logger.info(`🗑️ ✅ 已删除全局锁文件: ${globalLockFile}`);
        } catch (e) {
          logger.warn(`⚠️ 无法删除全局锁文件: ${e}`);
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
              logger.info(`🗑️ ✅ 已删除 session 锁文件: ${lockFile}`);
            } catch (e) {
              logger.warn(`⚠️ 无法删除 session 锁文件: ${e}`);
            }
          }
        }

        // 2. ⭐⭐⭐ 清理 session 目录下的 in_use.lock 文件（这是导致"already in use"的根本原因）
        const sessionDir = join(sessionsDir, sessionId);
        if (existsSync(sessionDir)) {
          try {
            const sessionFiles = readdirSync(sessionDir);
            logger.info(`🔍 session 目录 ${sessionId} 中的文件: ${sessionFiles.join(', ')}`);

            for (const file of sessionFiles) {
              if (file.endsWith('.lock') || file === 'in_use.lock') {
                const lockFile = join(sessionDir, file);
                try {
                  unlinkSync(lockFile);
                  logger.info(`🗑️ ✅ 已删除 session 内部锁文件: ${lockFile}`);
                } catch (e) {
                  logger.warn(`⚠️ 无法删除锁文件 ${file}: ${e}`);
                }
              }
            }
          } catch (e) {
            logger.warn(`⚠️ 无法访问 session 目录: ${e}`);
          }
        }
      }

      // 清理 projects 目录下的锁文件
      if (cwd) {
        // 规范化工作目录路径，匹配 Claude CLI 的命名规则
        // H:\编剧-脚本\测试项目 -> h--编剧-脚本--测试项目
        const normalizedCwd = cwd.toLowerCase().replace(/[:\\\/]/g, '--');
        const projectDir = join(claudeDir, 'projects', normalizedCwd);

        logger.info(`🔍 检查项目目录: ${projectDir}`);

        if (existsSync(projectDir)) {
          // 尝试多种可能的锁文件格式
          const lockFiles = [
            join(projectDir, `${sessionId}.lock`),
            join(projectDir, `${sessionId}.jsonl.lock`),
          ];

          for (const lockFile of lockFiles) {
            if (existsSync(lockFile)) {
              unlinkSync(lockFile);
              logger.info(`🗑️ ✅ 已删除锁文件: ${lockFile}`);
            }
          }

          // 列出目录中所有文件用于调试
          try {
            const files = readdirSync(projectDir);
            logger.info(`📁 项目目录中的文件: ${files.join(', ')}`);

            // 删除所有包含该 session ID 的文件
            for (const file of files) {
              if (file.includes(sessionId)) {
                const filePath = join(projectDir, file);
                if (file.endsWith('.lock')) {
                  unlinkSync(filePath);
                  logger.info(`🗑️ ✅ 已删除匹配的锁文件: ${filePath}`);
                }
              }
            }
          } catch (e) {
            logger.warn(`无法列出目录: ${e}`);
          }
        } else {
          logger.warn(`⚠️ 项目目录不存在: ${projectDir}`);
        }
      }

      // 清理所有可能的锁文件（遍历 projects 目录）
      const projectsDir = join(claudeDir, 'projects');
      if (existsSync(projectsDir)) {
        const projectFolders = readdirSync(projectsDir, { withFileTypes: true });
        logger.info(`🔍 遍历 ${projectFolders.length} 个项目文件夹...`);

        for (const folder of projectFolders) {
          if (folder.isDirectory()) {
            const folderPath = join(projectsDir, folder.name);
            try {
              const files = readdirSync(folderPath);
              for (const file of files) {
                if (file.includes(sessionId) && file.endsWith('.lock')) {
                  const lockFile = join(folderPath, file);
                  unlinkSync(lockFile);
                  logger.info(`🗑️ ✅ 清理旧锁文件: ${lockFile}`);
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
          logger.info(`🔍 清理 IDE 目录中的 ${ideFiles.length} 个文件...`);

          for (const file of ideFiles) {
            if (file.endsWith('.lock')) {
              const lockFile = join(ideDir, file);
              try {
                unlinkSync(lockFile);
                logger.info(`🗑️ ✅ 已删除 IDE 锁文件: ${lockFile}`);
              } catch (e) {
                logger.warn(`⚠️ 无法删除 IDE 锁文件 ${file}: ${e}`);
              }
            }
          }
        } catch (e) {
          logger.warn(`⚠️ 清理 IDE 锁文件失败: ${e}`);
        }
      }

      logger.info(`✅ 锁文件清理完成`);
    } catch (error) {
      logger.warn(`清理锁文件失败: ${error}`);
    }
  }

  /**
   * ⭐⭐⭐ 强制终止所有占用该 session ID 的 Claude CLI 进程
   * 类似 VSCode Claude Code 的进程管理机制
   *
   * 策略：查找所有 claude.exe 进程，检查命令行参数中是否包含该 session ID
   */
  private async killExistingClaudeProcesses(sessionId: string): Promise<void> {
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

        logger.info(`🔍 查找使用 session ${sessionId} 的进程...`);

        exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
          if (error || !stdout) {
            logger.info(`✅ 未找到占用该 session 的进程`);
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
                    logger.info(`🔍 发现匹配进程 PID ${pid}: ${line.substring(0, 100)}...`);
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
            logger.info(`🔫 发现 ${pidsToKill.length} 个占用 session 的进程，准备强制终止: ${pidsToKill.join(', ')}`);

            let killedCount = 0;
            for (const pid of pidsToKill) {
              try {
                if (platform === 'win32') {
                  execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                } else {
                  execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                }
                killedCount++;
                logger.info(`✅ 已终止进程 PID ${pid}`);
              } catch (e) {
                logger.warn(`⚠️ 无法终止进程 PID ${pid}: ${e}`);
              }
            }

            logger.info(`✅ 成功终止 ${killedCount}/${pidsToKill.length} 个进程`);
            // 等待进程完全终止
            setTimeout(resolve, 1000);
          } else {
            logger.info(`✅ 未找到占用该 session 的进程`);
            resolve();
          }
        });
      } catch (error) {
        logger.warn(`⚠️ 终止进程失败: ${error}`);
        resolve();
      }
    });
  }

  /**
   * Cleanup all active processes
   * ⭐ 改进：清理进程的同时也清理锁文件
   */
  public cleanup(): void {
    for (const [sessionId, process] of this.activeProcesses.entries()) {
      if (!process.killed) {
        process.kill('SIGTERM');
        logger.info(`Killed Claude process for session: ${sessionId}`);
      }
      // ⭐ 清理对应的锁文件
      this.cleanupSessionLocks(sessionId);
    }
    this.activeProcesses.clear();
    logger.info(`✅ 所有 Claude CLI 进程和锁文件已清理`);
  }
}
