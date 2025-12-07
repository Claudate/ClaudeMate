/**
 * Type-safe IPC Communication Layer
 * Ensures compile-time type checking for all main-renderer communication
 */

import { z } from 'zod';

/**
 * IPC Channel definitions with strong typing
 */
export const IPCChannels = {
  // Window management
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  // File system operations
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_DELETE_FILE: 'fs:delete-file',
  FS_DELETE: 'fs:delete', // 删除文件或文件夹
  FS_CREATE_FILE: 'fs:create-file',
  FS_CREATE_FOLDER: 'fs:create-folder',
  FS_LIST_DIRECTORY: 'fs:list-directory',
  FS_OPEN_FILE_DIALOG: 'fs:open-file-dialog',
  FS_OPEN_FOLDER_DIALOG: 'fs:open-folder-dialog',
  FS_SCAN_DIRECTORY: 'fs:scan-directory',
  FS_COPY: 'fs:copy', // 复制文件或文件夹
  FS_MOVE: 'fs:move', // 移动文件或文件夹
  FS_REVEAL_IN_EXPLORER: 'fs:reveal-in-explorer', // 在文件管理器中显示
  FS_GET_FILE_STATS: 'fs:get-file-stats', // 获取文件统计信息（大小、修改时间等）
  FS_WATCH_START: 'fs:watch-start', // 开始监听目录变化
  FS_WATCH_STOP: 'fs:watch-stop', // 停止监听目录变化
  FS_WATCH_CHANGE: 'fs:watch-change', // 文件变化事件 (Main -> Renderer)

  // Shell operations
  SHELL_OPEN_URL: 'shell:open-url',

  // Claude CLI integration
  CLAUDE_EXECUTE: 'claude:execute',
  CLAUDE_STREAM: 'claude:stream',
  CLAUDE_CANCEL: 'claude:cancel',
  CLAUDE_CHECK_AVAILABLE: 'claude:check-available',
  CLAUDE_CHECK_AUTH: 'claude:check-auth',
  CLAUDE_LOGIN: 'claude:login',
  CLAUDE_LOGOUT: 'claude:logout',
  CLAUDE_AUTH_STATUS: 'claude:auth-status', // 检查授权状态（参照 WPF 的 VerifyAuthenticationAsync）
  CLAUDE_AUTH: 'claude:auth', // 启动授权流程（参照 WPF 的 OnStartAuth）

  // ⭐ Tool Permission (工具授权)
  CLAUDE_PERMISSION_REQUEST: 'claude:permission-request',  // 授权请求（Main -> Renderer）
  CLAUDE_PERMISSION_RESPONSE: 'claude:permission-response', // 授权响应（Renderer -> Main）

  // Project management
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_CLOSE: 'project:close',
  PROJECT_LIST: 'project:list',
  PROJECT_DELETE: 'project:delete',

  // Session management
  SESSION_CREATE: 'session:create',
  SESSION_LOAD: 'session:load',
  SESSION_SAVE: 'session:save',
  SESSION_DELETE: 'session:delete',
  SESSION_LIST: 'session:list',

  // Chat History (参照 WPF 的 SessionStorageService)
  HISTORY_CREATE_SESSION: 'history:create-session',         // 创建新会话
  HISTORY_GET_SESSION: 'history:get-session',               // 获取指定会话
  HISTORY_GET_ALL_SESSIONS: 'history:get-all-sessions',     // 获取所有会话（全局）
  HISTORY_SAVE_MESSAGE: 'history:save-message',             // 保存消息到会话
  HISTORY_UPDATE_SESSION: 'history:update-session',         // 更新会话数据
  HISTORY_DELETE_SESSION: 'history:delete-session',         // 删除会话
  HISTORY_SEARCH_SESSIONS: 'history:search-sessions',       // 搜索会话（标题/项目名）
  HISTORY_SEARCH_MESSAGES: 'history:search-messages',       // 搜索消息内容
  HISTORY_GET_STATISTICS: 'history:get-statistics',         // 获取统计信息
  HISTORY_UPDATE_TITLE: 'history:update-title',             // 更新会话标题
  HISTORY_GET_PROJECT_NAMES: 'history:get-project-names',   // 获取所有项目名称

  // ⭐ Chat History - IndexedDB (支持多语言分词搜索)
  HISTORY_LOAD_MESSAGES: 'history:load-messages',                       // 智能加载消息（IndexedDB -> JSONL fallback）
  HISTORY_SEARCH: 'history:search',                                     // 全文搜索（支持中英日分词）
  HISTORY_SEARCH_WITH_FTS5: 'history:search-with-fts5',                 // SQLite FTS5 全文搜索
  HISTORY_REBUILD_SEARCH_INDEX: 'history:rebuild-search-index',         // 重建 SQLite FTS5 搜索索引
  HISTORY_GET_PROJECT_MESSAGES: 'history:get-project-messages',         // 获取项目所有消息
  HISTORY_DELETE_SESSION_MESSAGES: 'history:delete-session-messages',   // 删除会话历史（IndexedDB）
  HISTORY_DELETE_PROJECT_MESSAGES: 'history:delete-project-messages',   // 删除项目历史（IndexedDB）
  HISTORY_GET_STATS: 'history:get-stats',                               // 获取统计信息（IndexedDB）
  HISTORY_CLEAR_ALL: 'history:clear-all',                               // 清空所有历史
  HISTORY_CLEAR_ALL_PROJECTS: 'history:clear-all-projects',             // ⭐⭐⭐ 清空所有项目的历史数据（JSONL + IndexedDB）

  // ⭐⭐⭐ Claude Code Import (导入 Claude Code CLI 的聊天历史)
  CLAUDE_CODE_DETECT: 'claude-code:detect',                             // 检测 Claude Code 数据
  CLAUDE_CODE_PREVIEW: 'claude-code:preview',                           // 预览导入数据（不实际导入）
  CLAUDE_CODE_IMPORT_ALL: 'claude-code:import-all',                     // 导入所有会话
  CLAUDE_CODE_IMPORT_PROGRESS: 'claude-code:import-progress',           // 导入进度事件 (Main -> Renderer)

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',

  // Workflow management
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_GET: 'workflow:get',
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_UPDATE: 'workflow:update',
  WORKFLOW_DELETE: 'workflow:delete',
  WORKFLOW_EXECUTE: 'workflow:execute',
  WORKFLOW_CANCEL: 'workflow:cancel',

  // ⭐ Workflow Auto-Generation
  WORKFLOW_GENERATE_FROM_CONVERSATION: 'workflow:generate-from-conversation',
  WORKFLOW_GET_BY_PROJECT: 'workflow:get-by-project',  // 获取项目相关的工作流

  // ⭐ Skill management
  SKILL_GET_ALL: 'skill:get-all',  // 获取所有可用的 Skills
  SKILL_LOAD: 'skill:load',        // 加载指定 Skill 到 Assistant

  // 🆕 GitHub Sync
  GITHUB_SYNC_MANUAL: 'github:sync-manual',                       // 手动触发同步
  GITHUB_SYNC_STATUS: 'github:sync-status',                       // 获取同步状态
  GITHUB_SYNC_CONFIGURE: 'github:sync-configure',                 // 配置 GitHub 同步
  GITHUB_SYNC_TEST_CONNECTION: 'github:sync-test-connection',     // 测试 GitHub 连接
  GITHUB_GET_GIT_STATUS: 'github:get-git-status',                 // 获取 Git 状态
  GITHUB_INIT_REPOSITORY: 'github:init-repository',               // 初始化 Git 仓库
  GITHUB_ADD_REMOTE: 'github:add-remote',                         // 添加远程仓库
  GITHUB_GET_SYNC_HISTORY: 'github:get-sync-history',             // 获取同步历史
  GITHUB_GET_SYNC_HISTORY_BY_PROJECT: 'github:get-sync-history-by-project', // 根据项目获取同步历史
  GITHUB_SYNC_STARTED: 'github:sync-started',                     // 同步开始事件 (Main -> Renderer)
  GITHUB_SYNC_COMPLETED: 'github:sync-completed',                 // 同步完成事件 (Main -> Renderer)
  GITHUB_SYNC_FAILED: 'github:sync-failed',                       // 同步失败事件 (Main -> Renderer)
  GITHUB_SYNC_PROGRESS: 'github:sync-progress',                   // 同步进度事件 (Main -> Renderer)

  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_CHANGED: 'theme:changed',

  // System
  SYSTEM_INFO: 'system:info',
  SYSTEM_MEMORY: 'system:memory',
  SYSTEM_CPU: 'system:cpu',

  // Performance monitoring
  PERF_MONITOR_START: 'perf:monitor-start',
  PERF_MONITOR_STOP: 'perf:monitor-stop',
  PERF_STATS: 'perf:stats',
} as const;

export type IPCChannel = typeof IPCChannels[keyof typeof IPCChannels];

/**
 * Zod schemas for runtime validation
 */

// File system schemas
export const FileReadSchema = z.object({
  path: z.string().min(1),
  encoding: z.enum(['utf8', 'binary']).optional(),
});

export const FileWriteSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(['utf8', 'binary']).optional(),
});

export const DirectoryListSchema = z.object({
  path: z.string().min(1),
  recursive: z.boolean().optional(),
});

// Claude CLI schemas
export const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().min(1),
  description: z.string().optional(),
});

export const ProjectOpenSchema = z.object({
  id: z.string().uuid(),
});

// Session schemas
export const SessionCreateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

// Settings schemas
export const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.enum(['en', 'zh', 'ja']),
  fontSize: z.number().min(10).max(24),
  claudeModel: z.enum(['opus', 'sonnet', 'haiku']),
  autoSave: z.boolean(),
  maxMemoryUsage: z.number().min(512).max(8192), // MB
});

/**
 * Type-safe IPC request/response types
 */

export interface IPCRequest<T = unknown> {
  channel: IPCChannel;
  data: T;
  requestId: string;
  timestamp: number;
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  requestId: string;
  timestamp: number;
}

/**
 * Type-safe IPC handler function signature
 */
export type IPCHandler<TInput = unknown, TOutput = unknown> = (
  data: TInput
) => Promise<TOutput>;

/**
 * Memory monitoring types
 */
export interface MemoryInfo {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

export interface PerformanceStats {
  memory: MemoryInfo;
  cpu: number;
  uptime: number;
  timestamp: number;
}

/**
 * Error codes for type-safe error handling
 */
export enum IPCErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
  CANCELED = 'CANCELED',
}

/**
 * Type-safe error class
 */
export class IPCError extends Error {
  constructor(
    public code: IPCErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

// ⭐ Claude CLI Schemas
// ⭐⭐⭐ 支持多模态消息格式（文本 + 图片）
export const ClaudeExecuteSchema = z.object({
  message: z.union([
    z.string().min(1),  // 纯文本消息
    z.array(z.any())    // 多模态消息数组（包含文本和图片）
  ]),
  sessionId: z.string().optional(),
  model: z.enum(['opus', 'sonnet', 'haiku']).optional(),
  cwd: z.string().optional(),
  permissionMode: z.enum(['manual', 'auto']).optional(), // ⭐ 授权模式
});

// ⭐ Chat History Schemas (参照 WPF)
export const HistoryCreateSessionSchema = z.object({
  projectPath: z.string().min(1),
  projectName: z.string().min(1),
  title: z.string().optional(),
  sessionId: z.string().optional(),  // ⭐⭐⭐ 添加 sessionId 字段
});

export const HistoryGetSessionSchema = z.object({
  projectPath: z.string().min(1),
  sessionId: z.string().min(1),
});

export const HistorySaveMessageSchema = z.object({
  projectPath: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.number(),
    tokenUsage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
      cacheCreationTokens: z.number().optional(),
      cacheReadTokens: z.number().optional(),
      timestamp: z.number(),
    }).optional(),
    toolUses: z.array(z.any()).optional(),
  }),
});

export const HistoryDeleteSessionSchema = z.object({
  projectPath: z.string().min(1),
  sessionId: z.string().min(1),
});

export const HistorySearchSessionsSchema = z.object({
  keyword: z.string().optional(),
  projectPath: z.string().optional(),
});

export const HistoryUpdateTitleSchema = z.object({
  projectPath: z.string().min(1),
  sessionId: z.string().min(1),
  newTitle: z.string().min(1),
});

// ⭐ Workflow Auto-Generation Schemas
export const WorkflowGenerateFromConversationSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.number(),
    toolUses: z.array(z.object({
      name: z.string(),
      input: z.record(z.any()),
      output: z.any().optional(),
      timestamp: z.number(),
    })).optional(),
  })),
  projectPath: z.string().optional(),
  projectName: z.string().optional(),
  existingWorkflowId: z.string().optional(),  // 如果存在，则更新而不是创建
});

export const WorkflowGetByProjectSchema = z.object({
  projectPath: z.string().min(1),
});

// ⭐ Skill Schemas
export const SkillGetAllSchema = z.object({
  projectPath: z.string().optional(),
});

export const SkillLoadSchema = z.object({
  skillId: z.string().min(1),
});
