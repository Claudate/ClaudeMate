/**
 * OpenRouter API Service
 * 使用 OpenRouter 免费模型生成文本摘要
 */

import { Logger } from '../utils/Logger';
import * as https from 'https';

const logger = Logger.getInstance('OpenRouterService');

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * ⭐ 系统预设模型配置
 * 这些模型使用内置加密的 API Key
 */
export const SYSTEM_AI_MODELS = {
  // 对话模型
  DEEPSEEK_CHAT: {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat V3.1',
    modelId: 'deepseek/deepseek-chat-v3.1:free',
    description: '强大的对话模型，适合日常交流',
  },
  // 代码模型
  QWEN_CODER: {
    id: 'qwen-coder',
    name: 'Qwen 3 Coder',
    modelId: 'qwen/qwen3-coder:free',
    description: '专注于代码生成和分析',
  },
  // 通用模型
  GEMMA: {
    id: 'gemma',
    name: 'Gemma 3N',
    modelId: 'google/gemma-3n-e2b-it:free',
    description: 'Google 的通用 AI 模型',
  },
  // 摘要模型（当前使用）
  DEEPSEEK_R1: {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (摘要专用)',
    modelId: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
    description: '优化的文本摘要模型',
  },
};

export class OpenRouterService {
  private static instance: OpenRouterService;
  // ⭐ 临时使用明文 API Key 进行测试
  // 警告：生产环境应使用环境变量或安全的配置存储
  private readonly systemApiKey: string = ''; // 已移除硬编码的敏感信息
  private readonly apiUrl: string = 'https://openrouter.ai/api/v1/chat/completions';

  // ⭐ 可配置的模型和 API Key
  private currentModel: string = 'qwen/qwen3-235b-a22b:free'; // 默认摘要模型（Qwen 3 4B 稳定免费）
  private customApiKey: string | null = null; // 用户自定义 API Key

  private constructor() {}

  /**
   * 获取当前使用的 API Key
   * 优先使用用户自定义 Key，否则使用系统 Key
   */
  private getApiKey(): string {
    const apiKey = this.customApiKey || this.systemApiKey;
    // 清理 API Key，移除可能的空白字符
    return apiKey.trim();
  }

  /**
   * ⭐ 构建并验证 Authorization 头部
   * 统一处理 API Key 的格式化和验证，遵循高内聚低耦合原则
   * @returns 验证通过的 Authorization 头部值
   * @throws {Error} 如果头部包含非法字符
   */
  private buildAuthorizationHeader(): string {
    const apiKey = this.getApiKey();
    const authHeader = `Bearer ${apiKey}`;

    // ⚠️ 只验证是否包含控制字符（HTTP header 真正禁止的字符）
    // 允许所有可打印字符，包括 API Key 中常见的字符（如 / + = 等）
    if (/[\r\n\t\0\x00-\x1F\x7F-\x9F]/.test(authHeader)) {
      logger.error('[OpenRouterService] ❌ Authorization 头部包含控制字符');
      throw new Error('Invalid control characters in Authorization header');
    }

    return authHeader;
  }

  /**
   * 设置自定义 API Key
   */
  public setCustomApiKey(apiKey: string | null): void {
    this.customApiKey = apiKey;
    logger.info(`[OpenRouterService] ${apiKey ? '设置自定义' : '清除自定义'} API Key`);
  }

  /**
   * 设置当前使用的模型
   */
  public setModel(modelId: string): void {
    this.currentModel = modelId;
    logger.info(`[OpenRouterService] 切换模型: ${modelId}`);
  }

  /**
   * 获取当前模型
   */
  public getCurrentModel(): string {
    return this.currentModel;
  }

  public static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }

  /**
   * 使用 Node.js https 模块发送 POST 请求
   * 替换 fetch() 以支持 Electron 打包后的环境
   */
  private httpsPost(url: string, headers: Record<string, string>, body: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);

      // 验证和清理所有 header 值
      const cleanHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        // 移除可能的非法字符（换行符、回车符等）
        const cleanValue = value.trim().replace(/[\r\n\t]/g, '');
        cleanHeaders[key] = cleanValue;
      }

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          ...cleanHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * 智能截取消息，防止超出上下文限制
   * 策略：优先保留开头和结尾的消息，中间部分进行采样
   * @param messages 原始消息列表
   * @returns 截取后的消息列表
   */
  private truncateMessagesForSummary(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const MAX_MESSAGES = 30; // 最多处理 30 条消息
    const MAX_CONTENT_LENGTH = 50000; // 单次调用最大内容长度（字符数）

    // 如果消息数量在限制内，直接返回
    if (messages.length <= MAX_MESSAGES) {
      // 检查总内容长度
      const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
      if (totalLength <= MAX_CONTENT_LENGTH) {
        return messages;
      }
    }

    // 策略：保留前 10 条 + 后 20 条消息
    const HEAD_COUNT = 10;
    const TAIL_COUNT = 20;

    if (messages.length <= HEAD_COUNT + TAIL_COUNT) {
      // 如果总数不多，直接返回，但可能需要截断内容
      return this.truncateMessageContent(messages, MAX_CONTENT_LENGTH);
    }

    // 取开头和结尾
    const headMessages = messages.slice(0, HEAD_COUNT);
    const tailMessages = messages.slice(-TAIL_COUNT);

    const truncatedMessages = [...headMessages, ...tailMessages];

    // 最后再检查一次总长度，如果还是太长，截断每条消息的内容
    return this.truncateMessageContent(truncatedMessages, MAX_CONTENT_LENGTH);
  }

  /**
   * 截断消息内容，确保总长度不超过限制
   * @param messages 消息列表
   * @param maxTotalLength 最大总长度
   * @returns 截断后的消息列表
   */
  private truncateMessageContent(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTotalLength: number
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);

    if (totalLength <= maxTotalLength) {
      return messages;
    }

    // 需要截断，为每条消息分配平均长度
    const avgLength = Math.floor(maxTotalLength / messages.length);

    return messages.map(msg => {
      if (msg.content.length <= avgLength) {
        return msg;
      }

      // 截断长消息，保留前半部分
      return {
        ...msg,
        content: msg.content.substring(0, avgLength) + '...[已截断]'
      };
    });
  }

  /**
   * 生成对话摘要
   * @param messages 对话消息列表
   * @param maxLength 摘要最大长度（字符数）
   * @returns 生成的摘要文本
   */
  public async generateSummary(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxLength: number = 200
  ): Promise<string> {
    try {
      // ⭐ 智能截取消息，防止超出上下文限制
      const truncatedMessages = this.truncateMessagesForSummary(messages);

      // 构建摘要提示词
      const conversationText = truncatedMessages
        .map((msg) => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
        .join('\n\n');

      const systemPrompt = `你是一个专业的对话摘要助手。请为以下对话生成一个简洁、准确的摘要。

要求：
1. 摘要长度不超过 ${maxLength} 个字符
2. 突出对话的核心内容和关键要点
3. 使用简洁、清晰的语言
4. 只返回摘要内容，不要添加任何额外说明`;

      const userPrompt = `请为以下对话生成摘要：

${conversationText}`;

      // 调用 OpenRouter API
      const requestBody = {
        model: this.currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ] as OpenRouterMessage[],
        max_tokens: Math.floor(maxLength * 1.5), // 预留一些 token 空间
        temperature: 0.3, // 低温度以获得更一致的摘要
      };

      logger.info(`[OpenRouterService] 发起摘要请求，模型: ${this.currentModel}, 原始消息数: ${messages.length}, 截取后: ${truncatedMessages.length}`);

      const data = await this.httpsPost(
        this.apiUrl,
        {
          'Content-Type': 'application/json',
          'Authorization': this.buildAuthorizationHeader(),
          'HTTP-Referer': 'https://github.com/your-repo/claudate',
          'X-Title': 'ClaudeMate',
        },
        JSON.stringify(requestBody)
      ) as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        logger.warn('[OpenRouterService] API 返回空结果');
        throw new Error('OpenRouter API returned no choices');
      }

      let summary = data.choices[0].message.content?.trim() || '';

      // ⭐ 处理 DeepSeek R1 思维链模型的特殊响应格式
      // R1 模型会返回 <think>思考过程</think> 和实际内容
      // 我们只需要提取 <think> 标签之外的实际内容
      if (this.currentModel.includes('deepseek-r1')) {
        // 移除 <think>...</think> 标签及其内容
        summary = summary.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      }

      // 如果提取后内容为空，记录原始响应
      if (!summary || summary.length === 0) {
        logger.warn('[OpenRouterService] ⚠️ 摘要内容为空，原始响应:', JSON.stringify(data.choices[0].message.content).substring(0, 500));
      }

      logger.info(`[OpenRouterService] ✅ 摘要生成成功，长度: ${summary.length} 字符`);
      if (data.usage) {
        logger.info(
          `[OpenRouterService] Token 使用: ${data.usage.prompt_tokens} (prompt) + ${data.usage.completion_tokens} (completion) = ${data.usage.total_tokens} (total)`
        );
      }

      return summary;
    } catch (error) {
      logger.error('[OpenRouterService] 生成摘要失败:', error);
      throw error;
    }
  }

  /**
   * 生成会话智能标题
   * @param firstMessage 第一条用户消息
   * @param maxLength 标题最大长度（字符数）
   * @returns 生成的标题
   */
  public async generateSessionTitle(firstMessage: string, maxLength: number = 20): Promise<string> {
    try {
      const systemPrompt = `你是一个专业的标题生成助手。请为以下对话生成一个简洁的标题。

要求：
1. 标题长度不超过 ${maxLength} 个字符
2. 标题要简洁明了，能概括对话主题
3. 使用简洁、清晰的语言
4. 只返回标题文本，不要添加任何额外说明（如"标题："等前缀）`;

      const requestBody = {
        model: this.currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请为以下对话生成标题：\n\n${firstMessage}` },
        ] as OpenRouterMessage[],
        max_tokens: Math.floor(maxLength * 2), // 预留一些 token 空间
        temperature: 0.3,
      };

      logger.info(`[OpenRouterService] 发起标题生成请求，模型: ${this.currentModel}`);

      const data = await this.httpsPost(
        this.apiUrl,
        {
          'Content-Type': 'application/json',
          'Authorization': this.buildAuthorizationHeader(),
          'HTTP-Referer': 'https://github.com/your-repo/claudate',
          'X-Title': 'ClaudeMate',
        },
        JSON.stringify(requestBody)
      ) as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        logger.warn('[OpenRouterService] API 返回空结果');
        throw new Error('OpenRouter API returned no choices');
      }

      let title = data.choices[0].message.content?.trim() || '';

      // ⭐ 处理 DeepSeek R1 思维链模型的特殊响应格式
      if (this.currentModel.includes('deepseek-r1')) {
        title = title.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      }

      // 清理标题（移除可能的前缀和引号）
      title = title
        .replace(/^标题[：:]\s*/g, '')
        .replace(/["「」『』]/g, '')
        .trim();

      // 截断过长标题
      if (title.length > maxLength) {
        title = title.substring(0, maxLength);
      }

      logger.info(`[OpenRouterService] ✅ 标题生成成功: ${title}`);
      return title;
    } catch (error) {
      logger.error('[OpenRouterService] 生成标题失败:', error);
      throw error;
    }
  }

  /**
   * 为单条长消息生成简短摘要
   * @param content 消息内容
   * @param maxLength 摘要最大长度
   * @returns 生成的摘要
   */
  public async generateMessageSummary(content: string, maxLength: number = 100): Promise<string> {
    try {
      // 如果内容本身很短，直接返回
      if (content.length <= maxLength) {
        return content;
      }

      const systemPrompt = `你是一个专业的文本摘要助手。请为以下文本生成一个简洁的摘要。

要求：
1. 摘要长度不超过 ${maxLength} 个字符
2. 保留核心信息和关键要点
3. 使用简洁、清晰的语言
4. 只返回摘要内容，不要添加任何额外说明`;

      const requestBody = {
        model: this.currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请为以下文本生成摘要：\n\n${content}` },
        ] as OpenRouterMessage[],
        max_tokens: Math.floor(maxLength * 1.5),
        temperature: 0.3,
      };

      logger.info(`[OpenRouterService] 发起消息摘要请求，模型: ${this.currentModel}, 内容长度: ${content.length}`);

      const data = await this.httpsPost(
        this.apiUrl,
        {
          'Content-Type': 'application/json',
          'Authorization': this.buildAuthorizationHeader(),
          'HTTP-Referer': 'https://github.com/your-repo/claudate',
          'X-Title': 'ClaudeMate',
        },
        JSON.stringify(requestBody)
      ) as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        logger.warn('[OpenRouterService] API 返回空结果，使用降级方案');
        return this.fallbackSummary(content, maxLength);
      }

      const summary = data.choices[0].message.content.trim();
      logger.info(`[OpenRouterService] ✅ 消息摘要生成成功`);

      return summary;
    } catch (error) {
      logger.error('[OpenRouterService] 生成消息摘要失败，使用降级方案:', error);
      return this.fallbackSummary(content, maxLength);
    }
  }

  /**
   * 降级方案：简单截断摘要
   * @param content 原始内容
   * @param maxLength 最大长度
   * @returns 截断后的内容
   */
  private fallbackSummary(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // 尝试在句子结束处截断
    const truncated = content.substring(0, maxLength);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('\n')
    );

    if (lastPeriod > maxLength * 0.7) {
      return content.substring(0, lastPeriod + 1).trim() + '...';
    } else {
      return truncated.trim() + '...';
    }
  }
}
