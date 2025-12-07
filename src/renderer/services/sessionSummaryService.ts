/**
 * Session Summary Service
 * 会话摘要生成服务
 *
 * 参照 WPF 的 GenerateSmartTitleAsync 方法:
 * - 在用户发送第一条消息后自动生成智能标题
 * - 使用 OpenRouter AI 生成简洁的标题（不超过 20 个字符）
 * - 标题能够概括对话主题
 */

import { IPCChannels } from '@shared/types/ipc.types';

export interface SessionSummaryOptions {
  firstMessage: string;
  projectName: string;
  maxLength?: number; // 默认 20
}

/**
 * 生成会话智能标题
 * 参照 WPF 的 GenerateSmartTitleAsync 方法
 * 现在使用 OpenRouter AI 来生成标题
 */
export async function generateSessionTitle(options: SessionSummaryOptions): Promise<string> {
  const { firstMessage, projectName, maxLength = 20 } = options;

  try {
    console.log(`[SessionSummary] 🤖 使用 OpenRouter AI 生成智能标题 - 项目: ${projectName}`);

    // ⭐ 调用 OpenRouter API 生成标题（通过 IPC）
    const response = await window.electronAPI.invoke('ai:generate-title' as any, {
      firstMessage,
      maxLength,
    });

    if (response && response.title) {
      let title = response.title.trim();

      // 清理标题（移除可能的前缀和引号）
      title = title
        .replace(/^标题[：:]\s*/g, '')
        .replace(/["「」『』]/g, '')
        .trim();

      // 截断过长标题
      if (title.length > maxLength) {
        title = title.substring(0, maxLength);
      }

      if (title.length > 0) {
        console.log(`[SessionSummary] ✅ AI 标题生成成功: ${title}`);
        return title;
      }
    }

    console.warn('[SessionSummary] AI 生成的标题无效，使用降级方案');
    return generateDefaultTitle(firstMessage, maxLength);
  } catch (error) {
    console.error('[SessionSummary] ❌ AI 标题生成失败，使用降级方案:', error);
    return generateDefaultTitle(firstMessage, maxLength);
  }
}

/**
 * 生成默认标题（当智能生成失败时）
 * 参照 WPF 的 fallback 逻辑
 */
function generateDefaultTitle(firstMessage: string, maxLength: number): string {
  // 提取第一句话作为标题
  const firstLine = firstMessage.split('\n')[0].trim();

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  // 截断过长文本
  return firstLine.substring(0, maxLength - 3) + '...';
}

/**
 * 生成会话摘要（用于快速预览）
 * 包含会话的关键信息
 */
export interface SessionSummary {
  title: string;
  messageCount: number;
  totalTokens: number;
  firstUserMessage: string;
  lastActivity: string; // 格式化的时间字符串
}

/**
 * 从会话数据生成摘要
 */
export function generateSessionSummary(
  title: string,
  messageCount: number,
  totalTokens: number,
  firstMessage: string,
  lastModifiedAt: number
): SessionSummary {
  return {
    title,
    messageCount,
    totalTokens,
    firstUserMessage: firstMessage.length > 100 ? firstMessage.substring(0, 100) + '...' : firstMessage,
    lastActivity: formatRelativeTime(lastModifiedAt),
  };
}

/**
 * 格式化相对时间（参照 WPF 的时间分组）
 * 今天/昨天/本周/更早
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} 分钟前`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} 小时前`;
  } else if (diff < 2 * day) {
    return '昨天';
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days} 天前`;
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * 获取时间分组标签（参照 WPF 的 ChatSessionGroup）
 */
export function getTimeGroupLabel(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  if (diff < day) {
    return '今天';
  } else if (diff < 2 * day) {
    return '昨天';
  } else if (diff < week) {
    return '本周';
  } else {
    return '更早';
  }
}
