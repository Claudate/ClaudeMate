/**
 * SessionSummarizer - 会话摘要生成模块
 * 职责：生成会话摘要（AI 智能摘要 + 降级方案）
 */

import { BaseStorageModule } from './BaseStorageModule';
import { ChatSession } from '@shared/types/domain.types';
import { OpenRouterService } from '../OpenRouterService';

export class SessionSummarizer extends BaseStorageModule {
  private openRouter: OpenRouterService;

  constructor(baseStoragePath: string) {
    super('SessionSummarizer', baseStoragePath);
    this.openRouter = OpenRouterService.getInstance();
  }

  /**
   * 生成智能标题（使用 AI）
   */
  async generateSmartTitle(firstMessage: string, projectName: string): Promise<string> {
    // 简单实现：提取前 30 个字符作为标题
    const maxLength = 30;
    let title = firstMessage.trim().substring(0, maxLength);

    // 如果被截断，添加省略号
    if (firstMessage.length > maxLength) {
      title += '...';
    }

    // 移除换行符
    title = title.replace(/\n/g, ' ');

    return title || `${projectName} - ${new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  /**
   * 生成会话摘要（优先使用 AI，降级到简单提取）
   * 策略：
   * 1. 尝试使用 OpenRouter AI 生成智能摘要（推荐）
   * 2. 如果 AI 失败，降级到简单文本提取：
   *    - 提取所有 assistant 消息
   *    - 优先使用最后一条长消息（>300字符）
   *    - 智能截断，保留完整句子
   */
  async generateSessionSummary(session: ChatSession): Promise<string> {
    try {
      // 尝试使用 AI 生成智能摘要
      const messages = session.messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content && typeof m.content === 'string')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as string
        }));

      if (messages.length > 0) {
        this.logger.info(`使用 AI 生成会话摘要: ${session.id}`);
        const aiSummary = await this.openRouter.generateSummary(messages, 200);

        if (aiSummary && aiSummary.length > 0) {
          this.logger.info(`AI 摘要生成成功: ${aiSummary.substring(0, 50)}...`);
          return aiSummary;
        }
      }
    } catch (error) {
      this.logger.warn(`AI 摘要生成失败，使用降级方案:`, error);
    }

    // 降级方案：使用简单文本提取
    this.logger.info(`使用降级方案生成摘要: ${session.id}`);

    // 过滤出所有 assistant 消息
    const assistantMessages = session.messages
      .filter(m => m.role === 'assistant' && m.content && typeof m.content === 'string')
      .reverse(); // 倒序，优先处理最新的消息

    if (assistantMessages.length === 0) {
      // 如果没有 assistant 消息，尝试使用 user 消息
      const userMessages = session.messages.filter(m => m.role === 'user' && m.content);
      if (userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1].content as string;
        return this.truncateToSummary(lastUserMessage, 200);
      }
      return `包含 ${session.messages.length} 条消息`;
    }

    // 查找第一条长消息（>300字符）
    const longMessage = assistantMessages.find(m => {
      const content = m.content as string;
      return content.length > 300;
    });

    if (longMessage) {
      // 使用长消息生成摘要（取前 400 字符）
      return this.truncateToSummary(longMessage.content as string, 400);
    }

    // 如果没有长消息，使用最后一条 assistant 消息
    const lastMessage = assistantMessages[0].content as string;
    return this.truncateToSummary(lastMessage, 200);
  }

  /**
   * 智能截断文本为摘要（保留完整句子）
   */
  private truncateToSummary(text: string, maxLength: number): string {
    // 移除多余的空白字符
    let cleanText = text.trim().replace(/\s+/g, ' ');

    // 如果文本已经够短，直接返回
    if (cleanText.length <= maxLength) {
      return cleanText;
    }

    // 截取到最大长度
    const truncated = cleanText.substring(0, maxLength);

    // 尝试在句子结束处截断（中文句号、英文句号、问号、感叹号、换行符）
    const sentenceEndings = [
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('\n'),
    ];

    const lastSentenceEnd = Math.max(...sentenceEndings);

    if (lastSentenceEnd > maxLength * 0.6) {
      // 如果找到的句子结束位置在合理范围内（60%以上），使用它
      return cleanText.substring(0, lastSentenceEnd + 1).trim() + ' [...]';
    }

    // 否则直接截断并添加省略号
    return truncated.trim() + '...';
  }
}
