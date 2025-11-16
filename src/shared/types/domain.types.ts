/**
 * Domain models and business logic types
 * These types are shared between main and renderer processes
 */

/**
 * Project entity
 */
export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt?: Date;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  autoSave: boolean;
  indexingEnabled: boolean;
}

/**
 * Session entity
 */
export interface Session {
  id: string;
  projectId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  totalMessages: number;
  totalTokens: number;
  model: string;
  tags: string[];
}

/**
 * Message entity
 */
export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  toolUse?: ToolUse[];
  errorInfo?: ErrorInfo;
  performance?: {
    duration: number;
    modelLatency: number;
  };
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}

export interface ErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * File explorer entity
 */
export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  modifiedAt?: Date;
  icon?: string;
}

/**
 * File reference for chat input (显示用)
 * 在聊天框中显示简洁的文件引用，发送时转换为完整内容
 */
export interface FileReference {
  id: string;                    // 唯一标识
  path: string;                  // 完整文件路径
  name: string;                  // 文件名
  type: 'file' | 'folder';       // 类型
  startLine?: number;            // 起始行号（如果是选中的代码片段）
  endLine?: number;              // 结束行号
  displayText: string;           // 显示文本（如 "file.ts:10-20"）
  content?: string;              // 文件内容（延迟加载）
}

/**
 * Chat history search result
 */
export interface SearchResult {
  sessionId: string;
  messageId: string;
  content: string;
  highlight: string;
  relevance: number;
  timestamp: Date;
}

/**
 * Workflow node types
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export type WorkflowNodeType =
  | 'input'
  | 'output'
  | 'transform'
  | 'condition'
  | 'loop'
  | 'claude-call';

export interface WorkflowNodeData {
  label: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional';
  data?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  projectId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Application settings
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'zh' | 'ja';
  fontSize: number;
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  autoSave: boolean;
  maxMemoryUsage: number;
  telemetryEnabled: boolean;
  experimental: ExperimentalFeatures;
  // ⭐ 授权模式设置
  permissionMode: 'manual' | 'auto';  // manual: 手动授权（弹窗）, auto: 自动授权
}

export interface ExperimentalFeatures {
  workflowEngine: boolean;
  advancedSearch: boolean;
  aiSuggestions: boolean;
}

/**
 * System information
 */
export interface SystemInfo {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  electronVersion: string;
  nodeVersion: string;
  chromiumVersion: string;
}

/**
 * GitHub integration types
 */
export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
  url: string;
}

/**
 * Claude CLI Permission Types (授权管理)
 */

/**
 * 工具使用授权请求
 */
export interface ToolPermissionRequest {
  id: string;                          // 请求唯一标识
  sessionId: string;                   // 会话ID
  toolName: string;                    // 工具名称 (Bash, Edit, Write, Read, etc.)
  action: string;                      // 具体操作描述
  parameters?: Record<string, any>;    // 工具参数
  timestamp: number;                   // 请求时间戳
  autoApprove?: boolean;               // 是否自动批准
}

/**
 * 授权响应
 */
export interface ToolPermissionResponse {
  requestId: string;                   // 对应的请求ID
  approved: boolean;                   // 是否批准
  remember?: boolean;                  // 是否记住此选择
  timestamp: number;                   // 响应时间戳
}

/**
 * Chat History Types (参照 WPF 版本)
 * 用于会话历史记录的持久化和管理
 */

/**
 * Token 使用量统计
 * 记录单次 Claude API 调用的 token 使用情况
 */
export interface TokenUsage {
  inputTokens: number;              // 输入 token 数量（用户提示词）
  outputTokens: number;             // 输出 token 数量（Claude 响应）
  totalTokens: number;              // 总 token 数量
  cacheCreationTokens?: number;     // 缓存创建的 token 数量（Prompt Caching）
  cacheReadTokens?: number;         // 缓存读取的 token 数量（Prompt Caching）
  timestamp: number;                // 时间戳（Unix timestamp）
}

/**
 * 聊天消息（用于 History）
 * 参照 WPF 的 ChatMessage 模型
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;                // Unix timestamp
  tokenUsage?: TokenUsage;          // Token 使用量（仅 assistant 消息）
  toolUses?: ToolUse[];             // 工具调用记录
}

/**
 * 完整会话数据
 * 参照 WPF 的 ChatSession 模型
 * 包含完整的消息历史和元数据
 */
export interface ChatSession {
  id: string;                       // 会话唯一标识符
  title: string;                    // 会话标题（可编辑，支持智能生成）
  projectPath: string;              // 关联项目路径
  projectName: string;              // 关联项目名称
  createdAt: string;                // 创建时间（ISO 8601 格式）
  modifiedAt: string;               // 最后修改时间（ISO 8601 格式）
  startTime: string;                // 开始时间（ISO 8601 格式）
  duration: number;                 // 会话时长（秒）
  model: string;                    // 使用的模型名称
  approval: string;                 // 审批状态
  cliVersion: string;               // Claude CLI 版本
  messages: ChatMessage[];          // 消息列表
  tokenUsages: TokenUsage[];        // Token 使用记录列表
  terminalOutput?: string;          // 终端输出内容（用于恢复会话）
  metadata?: Record<string, string>; // 扩展元数据
}

/**
 * 会话元数据（用于列表展示）
 * 参照 WPF 的 ChatSessionMetadata 模型
 * 不包含完整消息内容，仅用于快速索引和展示
 */
export interface ChatSessionMetadata {
  id: string;                       // 会话唯一标识符
  title: string;                    // 会话标题
  projectName: string;              // 项目名称
  projectPath: string;              // 项目路径（用于定位会话文件）
  createdAt: string;                // 创建时间（ISO 8601 格式）
  modifiedAt: string;               // 最后修改时间（ISO 8601 格式）
  startTime: string;                // 开始时间（ISO 8601 格式）
  duration: number;                 // 会话时长（秒）
  model: string;                    // 使用的模型
  approval: string;                 // 审批状态
  cliVersion: string;               // CLI 版本
  messageCount: number;             // 消息数量
  fileSize: number;                 // 文件大小（字节）
  totalTokens: number;              // 总 Token 数量
  inputTokens: number;              // 输入 Token 数量
  outputTokens: number;             // 输出 Token 数量
  uploadCount: number;              // 上传次数（Write/Edit 工具使用）
  downloadCount: number;            // 下载次数（Read/Grep 工具使用）
  summary?: string;                 // 会话摘要（自动生成或手动设置）
}

/**
 * 会话统计信息
 * 用于全局统计仪表盘
 */
export interface SessionStatistics {
  projectCount: number;             // 项目数量
  totalSessions: number;            // 总会话数
  totalMessages: number;            // 总消息数
  totalFileSize: number;            // 总文件大小（字节）
  totalTokens: number;              // 总 Token 使用量
  earliestSession?: string;         // 最早会话时间（ISO 8601）
  latestSession?: string;           // 最新会话时间（ISO 8601）
  projectStatistics?: Record<string, {
    sessionCount: number;
    messageCount: number;
    fileSize: number;
    lastModified: string;
  }>;
}

/**
 * Event types for pub/sub pattern
 */
export type AppEvent =
  | { type: 'PROJECT_OPENED'; payload: Project }
  | { type: 'PROJECT_CLOSED'; payload: { projectId: string } }
  | { type: 'SESSION_CREATED'; payload: Session }
  | { type: 'MESSAGE_RECEIVED'; payload: Message }
  | { type: 'THEME_CHANGED'; payload: { theme: AppSettings['theme'] } }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<AppSettings> }
  | { type: 'MEMORY_WARNING'; payload: { usage: number; limit: number } }
  | { type: 'ERROR_OCCURRED'; payload: { error: Error; context: string } }
  | { type: 'SESSION_UPDATED'; payload: ChatSessionMetadata }
  | { type: 'SESSION_DELETED'; payload: { sessionId: string } };
