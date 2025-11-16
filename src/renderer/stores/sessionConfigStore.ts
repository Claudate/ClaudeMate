/**
 * Session Configuration Store
 * 管理 Claude CLI 会话限制配置
 *
 * 参照 WPF 的 ChatSessionConfig 模型:
 * - 单个会话最大消息数量（默认 100）
 * - 单个会话最大 Token 数量（默认 200,000）
 * - 警告阈值配置（默认 80%）
 * - 自动创建新会话选项
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionConfig {
  // 限制配置
  maxMessagesPerSession: number; // 默认 100
  maxTokensPerSession: number; // 默认 200,000 (Claude Sonnet 上下文窗口)

  // 警告配置
  showWarningNearLimit: boolean; // 默认 true
  warningThresholdPercent: number; // 默认 80%

  // 自动创建新会话
  autoCreateNewSession: boolean; // 默认 false
}

interface SessionConfigStore {
  config: SessionConfig;

  // 更新配置
  updateConfig: (updates: Partial<SessionConfig>) => void;

  // 重置为默认值
  resetToDefaults: () => void;

  // 检查方法（参照 WPF 的工具方法）
  isNearMessageLimit: (currentMessageCount: number) => boolean;
  hasReachedMessageLimit: (currentMessageCount: number) => boolean;
  isNearTokenLimit: (currentTokenCount: number) => boolean;
  hasReachedTokenLimit: (currentTokenCount: number) => boolean;

  // 获取使用百分比
  getMessageUsagePercent: (currentMessageCount: number) => number;
  getTokenUsagePercent: (currentTokenCount: number) => number;
}

const DEFAULT_CONFIG: SessionConfig = {
  maxMessagesPerSession: 100,
  maxTokensPerSession: 200000,
  showWarningNearLimit: true,
  warningThresholdPercent: 80,
  autoCreateNewSession: false,
};

/**
 * Session Config Store Hook
 *
 * 使用示例:
 * ```typescript
 * const { config, hasReachedMessageLimit } = useSessionConfigStore();
 *
 * if (hasReachedMessageLimit(messages.length)) {
 *   // 提示用户创建新会话
 * }
 * ```
 */
export const useSessionConfigStore = create<SessionConfigStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,

      updateConfig: (updates) => {
        set((state) => ({
          config: { ...state.config, ...updates },
        }));

        console.log('[SessionConfig] 配置已更新:', updates);
      },

      resetToDefaults: () => {
        set({ config: DEFAULT_CONFIG });
        console.log('[SessionConfig] 配置已重置为默认值');
      },

      // 检查是否接近消息限制
      isNearMessageLimit: (currentMessageCount) => {
        const { config } = get();
        return (
          config.showWarningNearLimit &&
          currentMessageCount >= (config.maxMessagesPerSession * config.warningThresholdPercent) / 100
        );
      },

      // 检查是否达到消息限制
      hasReachedMessageLimit: (currentMessageCount) => {
        const { config } = get();
        return currentMessageCount >= config.maxMessagesPerSession;
      },

      // 检查是否接近 Token 限制
      isNearTokenLimit: (currentTokenCount) => {
        const { config } = get();
        return (
          config.showWarningNearLimit &&
          currentTokenCount >= (config.maxTokensPerSession * config.warningThresholdPercent) / 100
        );
      },

      // 检查是否达到 Token 限制
      hasReachedTokenLimit: (currentTokenCount) => {
        const { config } = get();
        return currentTokenCount >= config.maxTokensPerSession;
      },

      // 获取消息使用百分比
      getMessageUsagePercent: (currentMessageCount) => {
        const { config } = get();
        return Math.min(100, Math.floor((currentMessageCount / config.maxMessagesPerSession) * 100));
      },

      // 获取 Token 使用百分比
      getTokenUsagePercent: (currentTokenCount) => {
        const { config } = get();
        return Math.min(100, Math.floor((currentTokenCount / config.maxTokensPerSession) * 100));
      },
    }),
    {
      name: 'session-config-storage', // localStorage key
    }
  )
);
