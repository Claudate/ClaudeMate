/**
 * Session Limit Module - 会话限制管理
 * 负责 Token 使用量统计和会话限制检查
 */

import { StateCreator } from 'zustand';
import { SessionLimitState, SessionLimitActions, ChatState } from '../types';
import { useSessionConfigStore } from '../../sessionConfigStore';

export type SessionLimitSlice = SessionLimitState & SessionLimitActions;

export const createSessionLimitSlice: StateCreator<
  ChatState,
  [['zustand/immer', never]],
  [],
  SessionLimitSlice
> = (set, get) => ({
  // State
  totalTokens: 0,
  sessionWarningShown: false,

  // Actions
  /**
   * 检查会话限制
   * 参照 WPF 的 CheckSessionLimitAsync 方法
   */
  checkSessionLimit: () => {
    const { messages, totalTokens } = get();
    const configStore = useSessionConfigStore.getState();
    const currentMessageCount = messages.length;

    console.log('[ChatStore] 检查会话限制:');
    console.log(`  - 消息数: ${currentMessageCount}/${configStore.config.maxMessagesPerSession}`);
    console.log(`  - Token: ${totalTokens}/${configStore.config.maxTokensPerSession}`);

    // 检查是否达到限制
    const hasReachedMessageLimit = configStore.hasReachedMessageLimit(currentMessageCount);
    const hasReachedTokenLimit = configStore.hasReachedTokenLimit(totalTokens);

    if (hasReachedMessageLimit || hasReachedTokenLimit) {
      const limitType = hasReachedMessageLimit && hasReachedTokenLimit
        ? '消息数量和 Token'
        : hasReachedMessageLimit
        ? '消息数量'
        : 'Token 数量';

      console.log(`[ChatStore] 会话已达到 ${limitType} 限制`);

      return {
        canContinue: !configStore.config.autoCreateNewSession,
        limitReached: true,
        warning: `当前会话的 ${limitType} 已达到上限。\n建议创建新会话以继续对话。`,
      };
    }

    // 检查是否接近限制
    const isNearMessageLimit = configStore.isNearMessageLimit(currentMessageCount);
    const isNearTokenLimit = configStore.isNearTokenLimit(totalTokens);

    if (isNearMessageLimit || isNearTokenLimit) {
      const messagePercent = configStore.getMessageUsagePercent(currentMessageCount);
      const tokenPercent = configStore.getTokenUsagePercent(totalTokens);

      const warning =
        `📊 会话使用情况:\n` +
        `  • 消息数: ${currentMessageCount}/${configStore.config.maxMessagesPerSession} (${messagePercent}%)\n` +
        `  • Token: ${totalTokens.toLocaleString()}/${configStore.config.maxTokensPerSession.toLocaleString()} (${tokenPercent}%)\n` +
        `\n⚠️ 接近会话限制，建议稍后创建新会话`;

      console.log('[ChatStore] 会话接近限制');

      return {
        canContinue: true,
        warning,
      };
    }

    return { canContinue: true };
  },

  /**
   * 获取会话统计信息
   * 参照 WPF 的 GetSessionStatsDisplay 方法
   */
  getSessionStats: () => {
    const { messages, totalTokens } = get();
    const configStore = useSessionConfigStore.getState();
    const messageCount = messages.length;
    const messagePercent = configStore.getMessageUsagePercent(messageCount);
    const tokenPercent = configStore.getTokenUsagePercent(totalTokens);

    return (
      `消息: ${messageCount}/${configStore.config.maxMessagesPerSession} (${messagePercent}%) | ` +
      `Token: ${totalTokens.toLocaleString()}/${configStore.config.maxTokensPerSession.toLocaleString()} (${tokenPercent}%)`
    );
  },

  /**
   * 更新 Token 计数
   */
  updateTokenCount: (tokens: number) => {
    set((state) => {
      state.totalTokens += tokens;
    });
  },
});
