/**
 * Chat Store Types
 * 共享类型定义
 */

import { ToolPermissionRequest } from '@shared/types/domain.types';

/**
 * Token 使用量统计（参照 WPF 的 TokenUsage 模型）
 * 记录单次 Claude API 调用的 token 使用情况
 */
export interface TokenUsage {
  inputTokens: number; // 输入 token 数量（用户提示词）
  outputTokens: number; // 输出 token 数量（Claude 响应）
  totalTokens: number; // 总 token 数量
  cacheCreationTokens?: number; // 缓存创建的 token 数量（如果使用了 prompt caching）
  cacheReadTokens?: number; // 缓存读取的 token 数量（如果使用了 prompt caching）
  timestamp: number; // 时间戳
}

/**
 * 消息接口
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  tokenUsage?: TokenUsage; // Token 使用量（仅对 assistant 消息有效）
}

/**
 * Message Module State
 */
export interface MessageState {
  messages: Message[];
  isLoading: boolean;
  isCancelling: boolean;
  pendingInput: string;
  error: string | null;
}

/**
 * Message Module Actions
 */
export interface MessageActions {
  sendMessage: (content: string | any[]) => Promise<void>;
  addMessage: (message: Message) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  clearMessages: () => void;
  appendToPendingInput: (text: string) => void;
  clearPendingInput: () => void;
  setError: (error: string | null) => void;
  cancelSession: () => void;
}

/**
 * Session Module State
 */
export interface SessionState {
  currentSessionId: string;
  currentProjectPath: string | null;
  projectSessionMap: Record<string, string>;
}

/**
 * Session Module Actions
 */
export interface SessionActions {
  loadSession: (sessionId: string) => Promise<void>;
  saveSession: () => Promise<void>;
  saveSessionIfNeeded: () => Promise<void>;
  createNewSession: (title?: string) => Promise<void>;
  getOrCreateSessionForProject: (projectPath: string) => string;
  switchToProject: (projectPath: string | null) => Promise<void>;
}

/**
 * Permission Module State
 */
export interface PermissionState {
  permissionRequest: ToolPermissionRequest | null;
  permissionMode: 'manual' | 'auto';
}

/**
 * Permission Module Actions
 */
export interface PermissionActions {
  respondToPermission: (approved: boolean) => Promise<void>;
  setPermissionMode: (mode: 'manual' | 'auto') => void;
}

/**
 * Session Limit Module State
 */
export interface SessionLimitState {
  totalTokens: number;
  sessionWarningShown: boolean;
}

/**
 * Session Limit Module Actions
 */
export interface SessionLimitActions {
  checkSessionLimit: () => {
    canContinue: boolean;
    warning?: string;
    limitReached?: boolean;
  };
  getSessionStats: () => string;
  updateTokenCount: (tokens: number) => void;
}

/**
 * Terminal Module Actions
 */
export interface TerminalActions {
  restoreFromTerminal: (projectPath: string, projectName: string) => void;
}

/**
 * Workflow Module Actions
 */
export interface WorkflowActions {
  generateWorkflowFromCurrentSession: () => Promise<void>;
}

/**
 * Complete Chat Store State
 * 聚合所有模块的 state 和 actions
 */
export interface ChatState
  extends MessageState,
    SessionState,
    PermissionState,
    SessionLimitState,
    MessageActions,
    SessionActions,
    PermissionActions,
    SessionLimitActions,
    TerminalActions,
    WorkflowActions {}
