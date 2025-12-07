/**
 * Claude Code Import Service
 * 导入 Claude Code CLI 的聊天历史到 ClaudeMate 数据库
 *
 * 功能:
 * 1. 检测 .claude/projects/ 目录
 * 2. 解析 JSONL 会话文件
 * 3. 智能合并相同项目的会话
 * 4. 避免重复导入
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ClaudeCodeSession {
  sessionId: string;
  title: string;
  projectPath: string;
  projectName: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      timestamp: number;
    };
  }>;
  createdAt: number;
  modifiedAt: number;
  totalTokens: number;
  cliVersion?: string;   // ⭐ Claude CLI 版本
  model?: string;        // ⭐ 使用的模型名称
}

export interface ClaudeCodeDetectionResult {
  exists: boolean;
  path?: string;
  projects: Array<{
    encodedName: string;
    decodedPath: string;
    projectName: string;
    sessionCount: number;
  }>;
  totalProjects: number;  // ⭐ 项目总数 (projects.length)
  totalSessions: number;
}

export class ClaudeCodeImportService {
  private claudeProjectsDir: string;

  constructor() {
    // 跨平台支持
    const homeDir = os.homedir();
    this.claudeProjectsDir = path.join(homeDir, '.claude', 'projects');
  }

  /**
   * 检测 Claude Code 数据是否存在
   */
  async detectClaudeCodeData(): Promise<ClaudeCodeDetectionResult> {
    // console.log(`[ClaudeCodeImport] 检测目录: ${this.claudeProjectsDir}`);

    if (!fs.existsSync(this.claudeProjectsDir)) {
      console.error('[ClaudeCodeImport] ❌ Claude Code 数据目录不存在:', this.claudeProjectsDir);
      return {
        exists: false,
        projects: [],
        totalProjects: 0,
        totalSessions: 0,
      };
    }

    const projects: ClaudeCodeDetectionResult['projects'] = [];
    let totalSessions = 0;

    try {
      const projectDirs = fs.readdirSync(this.claudeProjectsDir);

      for (const encodedName of projectDirs) {
        const projectDir = path.join(this.claudeProjectsDir, encodedName);

        // 跳过非目录
        if (!fs.statSync(projectDir).isDirectory()) {
          continue;
        }

        // 统计会话文件
        const sessionFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));

        if (sessionFiles.length === 0) {
          continue;
        }

        // 解码项目路径
        const decodedPath = this.decodeProjectPath(encodedName);
        const projectName = path.basename(decodedPath);

        projects.push({
          encodedName,
          decodedPath,
          projectName,
          sessionCount: sessionFiles.length,
        });

        totalSessions += sessionFiles.length;
      }

      // ⭐ 只打印警告和错误
      if (projects.length === 0) {
        console.warn(`[ClaudeCodeImport] ⚠️ 未检测到有效项目 (目录: ${this.claudeProjectsDir})`);
      }
      // console.log(`[ClaudeCodeImport] ✅ 检测到 ${projects.length} 个项目，${totalSessions} 个会话`);

      return {
        exists: true,
        path: this.claudeProjectsDir,
        projects,
        totalProjects: projects.length,  // ⭐ 项目总数
        totalSessions,
      };
    } catch (error) {
      console.error('[ClaudeCodeImport] ❌ 检测失败:', error);
      return {
        exists: false,
        projects: [],
        totalProjects: 0,
        totalSessions: 0,
      };
    }
  }

  /**
   * 解码 Claude Code 的项目路径编码
   * 例如: "C--Users-Administrator-Desktop-MyProject" → "C:\Users\Administrator\Desktop\MyProject"
   * 例如: "H-------" → "H:\" (根目录)
   */
  private decodeProjectPath(encoded: string): string {
    // Windows: "C--Users-..." → "C:\Users\..."
    if (/^[A-Z]--/.test(encoded)) {
      const drive = encoded[0];
      const restPath = encoded.substring(3).replace(/-/g, path.sep);
      return `${drive}:${path.sep}${restPath}`;
    }

    // Unix: "home-user-..." → "/home/user/..."
    if (!encoded.includes('--')) {
      return path.sep + encoded.replace(/-/g, path.sep);
    }

    // 根目录: "H-------" → "H:\"
    const driveMatch = encoded.match(/^([A-Z])(-+)$/);
    if (driveMatch) {
      return `${driveMatch[1]}:${path.sep}`;
    }

    return encoded;
  }

  /**
   * 编码项目路径为 Claude Code 格式
   * 例如: "C:\Users\Admin\Project" → "C--Users-Admin-Project"
   */
  private encodeProjectPath(projectPath: string): string {
    // Windows: "C:\Users\..." → "C--Users-..."
    if (path.isAbsolute(projectPath) && /^[A-Z]:/.test(projectPath)) {
      const drive = projectPath[0];
      const restPath = projectPath.substring(3).replace(/\\/g, '-').replace(/\//g, '-');
      return restPath ? `${drive}--${restPath}` : `${drive}-------`;
    }

    // Unix: "/home/user/..." → "home-user-..."
    if (projectPath.startsWith('/')) {
      return projectPath.substring(1).replace(/\//g, '-');
    }

    return projectPath.replace(/[\\/]/g, '-');
  }

  /**
   * 解析单个 JSONL 会话文件
   */
  async parseSessionFile(filePath: string, projectPath: string, projectName: string): Promise<ClaudeCodeSession | null> {
    try {
      // 确保使用UTF-8编码读取,并添加BOM处理
      const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // 移除BOM
      const lines = content.split('\n').filter(l => l.trim());

      if (lines.length === 0) {
        // ⭐ 空文件静默跳过,不打印日志
        return null;
      }

      let sessionId = '';
      let title = '未命名会话';
      const messages: ClaudeCodeSession['messages'] = [];
      let totalTokens = 0;
      let createdAt = Date.now();
      let modifiedAt = Date.now();
      let cliVersion = '';
      let modelName = '';
      // ⭐⭐⭐ 从JSONL中提取的真实项目路径和名称
      let actualProjectPath = projectPath;
      let actualProjectName = projectName;
      let projectInfoExtracted = false; // 标记是否已提取项目信息

      // 逐行解析 JSONL
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // ⭐ 提取 CLI 版本信息和SessionID
          if (entry.version) {
            cliVersion = entry.version;
          }
          if (entry.sessionId && !sessionId) {
            sessionId = entry.sessionId;
          }

          // ⭐⭐⭐ 提取项目路径信息（优先使用 cwd 字段，只提取一次）
          if (entry.cwd && !projectInfoExtracted) {
            actualProjectPath = entry.cwd;
            actualProjectName = path.basename(entry.cwd);
            projectInfoExtracted = true;
            // console.log(`[ClaudeCodeImport] ✅ 从 cwd 提取项目信息: ${actualProjectPath}`);
          }

          // ⭐ 提取模型信息
          if (entry.message?.model) {
            modelName = entry.message.model;
          }

          // 1. 解析摘要（会话标题）
          if (entry.type === 'summary' && entry.summary) {
            title = entry.summary;
          }

          // 2. 解析用户消息
          if (entry.type === 'user' && entry.message) {
            const timestamp = new Date(entry.timestamp).getTime();

            if (!createdAt || timestamp < createdAt) {
              createdAt = timestamp;
            }
            if (!modifiedAt || timestamp > modifiedAt) {
              modifiedAt = timestamp;
            }

            // ⭐ 只提取纯文本内容,忽略工具调用等非文本内容
            const content = this.extractTextContent(entry.message);

            if (content) {
              messages.push({
                id: entry.uuid || `user-${timestamp}`,
                role: 'user',
                content,
                timestamp,
              });
            }
          }

          // 3. 解析助手消息（仅提取文本内容）
          if (entry.type === 'assistant' && entry.message) {
            const timestamp = new Date(entry.timestamp).getTime();

            if (!modifiedAt || timestamp > modifiedAt) {
              modifiedAt = timestamp;
            }

            // ⭐ 只提取纯文本内容
            const content = this.extractTextContent(entry.message);

            if (!content) {
              continue; // 跳过无文本内容的消息(如纯thinking或工具调用)
            }

            // 提取 token 使用量
            let tokenUsage;
            if (entry.message.usage) {
              const usage = entry.message.usage;
              tokenUsage = {
                inputTokens: usage.input_tokens || 0,
                outputTokens: usage.output_tokens || 0,
                totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
                cacheReadTokens: usage.cache_read_input_tokens,
                cacheCreationTokens: usage.cache_creation_input_tokens,
                timestamp,
              };
              totalTokens += tokenUsage.totalTokens;
            }

            messages.push({
              id: entry.uuid || `assistant-${timestamp}`,
              role: 'assistant',
              content,
              timestamp,
              tokenUsage,
            });
          }
        } catch (parseError) {
          // ⭐ 单行解析失败不打印(可能是格式异常,不影响其他消息)
          // console.warn(`[ClaudeCodeImport] ⚠️ 解析行失败:`, parseError);
        }
      }

      // 如果没有解析到 sessionId，使用文件名
      if (!sessionId) {
        sessionId = path.basename(filePath, '.jsonl');
      }

      if (messages.length === 0) {
        // ⭐ 无有效消息(可能是用户没有回复的会话)静默跳过
        return null;
      }

      // ⭐ 只在调试模式打印成功信息
      // console.log(`[ClaudeCodeImport] ✅ 解析成功: ${title} (${messages.length} 条消息)`);

      return {
        sessionId,
        title,
        projectPath: actualProjectPath,  // ⭐ 使用从 cwd 提取的真实路径
        projectName: actualProjectName,  // ⭐ 使用从 cwd 提取的真实项目名
        messages,
        createdAt,
        modifiedAt,
        totalTokens,
        cliVersion,
        model: modelName,
      };
    } catch (error) {
      // ⭐ 打印详细的错误信息，包括错误类型和堆栈
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      console.error(`[ClaudeCodeImport] ❌ 解析文件失败`);
      console.error(`  文件: ${filePath}`);
      console.error(`  错误: ${errorMessage}`);
      if (errorStack) {
        console.error(`  堆栈: ${errorStack}`);
      }

      return null;
    }
  }

  /**
   * 获取指定项目的所有会话
   */
  async getProjectSessions(encodedProjectName: string): Promise<ClaudeCodeSession[]> {
    const projectDir = path.join(this.claudeProjectsDir, encodedProjectName);

    if (!fs.existsSync(projectDir)) {
      return [];
    }

    const decodedPath = this.decodeProjectPath(encodedProjectName);
    const projectName = path.basename(decodedPath);

    const sessionFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    const sessions: ClaudeCodeSession[] = [];

    for (const file of sessionFiles) {
      const filePath = path.join(projectDir, file);
      const session = await this.parseSessionFile(filePath, decodedPath, projectName);

      if (session) {
        sessions.push(session);
      }
    }

    // ⭐ 不打印失败计数(空文件和无消息会话是正常情况)
    // 只有真正的解析错误才会在parseSessionFile的catch块中打印
    return sessions;
  }

  /**
   * 获取所有会话（按项目分组）
   */
  async getAllSessions(): Promise<Map<string, ClaudeCodeSession[]>> {
    const detection = await this.detectClaudeCodeData();

    if (!detection.exists) {
      return new Map();
    }

    const sessionsByProject = new Map<string, ClaudeCodeSession[]>();

    for (const project of detection.projects) {
      const sessions = await this.getProjectSessions(project.encodedName);

      if (sessions.length > 0) {
        sessionsByProject.set(project.projectName, sessions);
      }
    }

    return sessionsByProject;
  }

  /**
   * 智能合并项目路径
   * ⭐ 规则: 只有路径完全一致才算同一个项目（即使项目名相同，路径不同也是不同项目）
   */
  async findMatchingProject(
    claudeCodeProjectPath: string,
    claudeCodeProjectName: string,
    existingProjects: Array<{ name: string; path: string }>
  ): Promise<{ path: string; name: string; isExisting: boolean }> {
    // ⭐⭐⭐ 只做精确路径匹配（忽略大小写和路径分隔符差异）
    const normalizedClaudePath = this.normalizePath(claudeCodeProjectPath);

    const exactMatch = existingProjects.find(p =>
      this.normalizePath(p.path) === normalizedClaudePath
    );

    if (exactMatch) {
      // console.log(`[ClaudeCodeImport] ✅ 路径匹配，合并到现有项目: ${exactMatch.path}`);
      return { path: exactMatch.path, name: exactMatch.name, isExisting: true };
    }

    // 无匹配，使用 Claude Code 的路径（新项目）
    // console.log(`[ClaudeCodeImport] 🆕 新项目: ${claudeCodeProjectName} (${claudeCodeProjectPath})`);
    return { path: claudeCodeProjectPath, name: claudeCodeProjectName, isExisting: false };
  }

  /**
   * 规范化路径（用于比较）
   * - 统一使用反斜杠
   * - 转为小写
   * - 去除末尾斜杠
   */
  private normalizePath(p: string): string {
    return p
      .replace(/\//g, '\\')  // 统一为反斜杠
      .toLowerCase()          // 忽略大小写
      .replace(/\\+$/, '');   // 去除末尾斜杠
  }

  /**
   * 从消息对象中提取纯文本内容
   * ⭐ 核心功能:
   * 1. 只提取type='text'的内容,过滤工具调用、thinking等
   * 2. 正确处理\n换行符(将字面量\n转为真实换行)
   * 3. 支持多种消息格式(字符串、对象、数组)
   * 4. 确保UTF-8编码正确处理中文
   *
   * @param message Claude Code消息对象
   * @returns 纯文本内容,如果没有文本则返回空字符串
   */
  private extractTextContent(message: any): string {
    try {
      // 1. 直接是字符串
      if (typeof message === 'string') {
        return this.normalizeTextContent(message);
      }

      // 2. message.content 是字符串
      if (typeof message?.content === 'string') {
        return this.normalizeTextContent(message.content);
      }

      // 3. message.content 是数组(Claude API标准格式)
      if (Array.isArray(message?.content)) {
        const textBlocks = message.content
          .filter((block: any) => block.type === 'text') // ⭐ 只提取text类型
          .map((block: any) => this.normalizeTextContent(block.text || ''))
          .filter((text: string) => text.trim()); // 过滤空文本

        return textBlocks.join('\n\n'); // 多个文本块用双换行分隔
      }

      // 4. 无法解析的格式 - 打印详细信息帮助调试
      console.warn('[ClaudeCodeImport] ⚠️ 无法提取文本内容');
      console.warn(`  消息类型: ${typeof message}`);
      console.warn(`  消息结构: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
      return '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ClaudeCodeImport] ❌ 提取文本内容失败');
      console.error(`  错误: ${errorMessage}`);
      console.error(`  消息类型: ${typeof message}`);
      return '';
    }
  }

  /**
   * 规范化文本内容
   * ⭐ 核心功能:
   * 1. 将JSON中的字面量\n(实际是\\n)转为真正的换行符
   * 2. 将\t转为制表符
   * 3. 将\"转为引号
   * 4. 清理多余的空白字符
   *
   * @param text 原始文本
   * @returns 规范化后的文本
   */
  private normalizeTextContent(text: string): string {
    if (!text) return '';

    return text
      .replace(/\\n/g, '\n')     // ⭐ 字面量\n → 真实换行符
      .replace(/\\t/g, '\t')     // 字面量\t → 制表符
      .replace(/\\"/g, '"')      // 字面量\" → 引号
      .replace(/\\\\/g, '\\')    // 字面量\\ → 单反斜杠
      .trim();                   // 清理首尾空白
  }
}
