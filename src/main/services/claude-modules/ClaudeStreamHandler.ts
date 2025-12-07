/**
 * Claude Stream Handler - 流式处理模块
 *
 * 职责:
 * 1. 解析 Claude CLI 的 stream-json 输出
 * 2. 处理 stdout/stderr 数据流
 * 3. 发送流式事件 (text, tool_use, thinking, done, error)
 * 4. 管理消息缓冲区
 * 5. Token usage 统计
 * 6. 工具调用检测和记录
 * 7. 触发 GitHub 同步
 */

import { EventEmitter } from 'events';
import { BaseClaudeModule } from './BaseClaudeModule';
import { SessionHistoryService } from '../SessionHistoryService';
import { ChangeTrackerService } from '../github/ChangeTrackerService';
import { GitHubSyncService } from '../github/GitHubSyncService';

/**
 * Claude 流式数据块接口
 */
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

/**
 * 消息缓冲区接口
 */
interface MessageBuffer {
  userMessage: string;
  assistantMessage: string;
  projectPath?: string;
  model?: string;
}

/**
 * ClaudeStreamHandler - 负责处理 Claude CLI 的流式输出
 *
 * 核心功能:
 * - 解析 stream-json 格式的输出
 * - 实时发送流式事件到前端
 * - 累积完整消息并保存到历史
 * - 检测工具调用并触发 GitHub 同步
 */
export class ClaudeStreamHandler extends BaseClaudeModule {
  private static instance: ClaudeStreamHandler;

  // 事件发射器 - 用于向外发送流式事件
  private eventEmitter: EventEmitter;

  // 消息缓冲区 - 累积完整的 assistant 消息
  private messageBuffers = new Map<string, MessageBuffer>();

  // 输出缓冲区 - 用于缓冲不完整的 JSON 行
  private outputBuffers = new Map<string, string>();

  // 服务依赖
  private sessionHistory = SessionHistoryService.getInstance();
  private changeTracker = ChangeTrackerService.getInstance();
  private githubSync = GitHubSyncService.getInstance();

  private constructor() {
    super('StreamHandler');
    this.eventEmitter = new EventEmitter();
  }

  public static getInstance(): ClaudeStreamHandler {
    if (!ClaudeStreamHandler.instance) {
      ClaudeStreamHandler.instance = new ClaudeStreamHandler();
    }
    return ClaudeStreamHandler.instance;
  }

  /**
   * 注册事件监听器
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * 移除事件监听器
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * 初始化消息缓冲区
   *
   * @param sessionId - 会话 ID
   * @param message - 用户消息内容
   * @param cwd - 项目工作目录
   * @param model - 使用的模型
   */
  public initializeMessageBuffer(
    sessionId: string,
    message: string,
    cwd?: string,
    model?: string
  ): void {
    this.logger.info(`初始化消息缓冲区: session=${sessionId}, model=${model || 'sonnet'}`);

    this.messageBuffers.set(sessionId, {
      userMessage: message,
      assistantMessage: '',
      projectPath: cwd,
      model: model || 'sonnet'
    });

    // 初始化输出缓冲区
    this.outputBuffers.set(sessionId, '');

    // 立即保存用户消息到历史
    this.sessionHistory.saveMessage({
      sessionId,
      timestamp: Date.now(),
      role: 'user',
      content: message,
      projectPath: cwd
    }).catch(err => {
      this.logger.warn(`保存用户消息到历史失败: ${err}`);
    });
  }

  /**
   * 清理消息缓冲区
   */
  public clearMessageBuffer(sessionId: string): void {
    this.messageBuffers.delete(sessionId);
    this.outputBuffers.delete(sessionId);
    this.logger.debug(`清理消息缓冲区: session=${sessionId}`);
  }

  /**
   * 处理 stdout 数据 (stream-json 格式)
   *
   * 这是最核心的方法,负责:
   * 1. 解析 stream-json 格式的输出
   * 2. 处理各种类型的 stream_event
   * 3. 发送实时流式事件到前端
   * 4. 累积完整的 assistant 消息
   *
   * @param data - stdout 数据
   * @param sessionId - 会话 ID
   * @param cwd - 项目工作目录 (用于工具调用记录)
   */
  public handleStdout(data: Buffer | string, sessionId: string, cwd?: string): void {
    const chunk = typeof data === 'string' ? data : data.toString('utf8');

    // 获取输出缓冲区
    let outputBuffer = this.outputBuffers.get(sessionId) || '';
    outputBuffer += chunk;

    // 按行分割处理 JSON 流
    const lines = outputBuffer.split('\n');
    // 保留最后一个不完整的行
    outputBuffer = lines.pop() || '';
    this.outputBuffers.set(sessionId, outputBuffer);

    // 逐行解析 JSON
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const jsonData = JSON.parse(line);
        this.processStreamJsonEvent(jsonData, sessionId, cwd);
      } catch (e) {
        // 如果不是 JSON,说明是纯文本输出 (使用 --resume 模式时)
        // 将纯文本作为流式输出发送
        if (line.trim()) {
          this.logger.debug(`Plain text output: ${line.substring(0, 100)}`);
          this.emitStreamEvent(sessionId, {
            type: 'text',
            content: line + '\n',
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  /**
   * 处理 stream-json 格式的事件
   *
   * stream-json 格式包含多种事件类型:
   * - system: 系统初始化事件
   * - stream_event: 流式事件 (message_start, content_block_start, content_block_delta, etc.)
   * - assistant: 完整的 assistant 消息
   * - user: 用户消息 (工具结果)
   * - result: 最终结果 (包含 token usage)
   */
  private processStreamJsonEvent(jsonData: any, sessionId: string, cwd?: string): void {
    const { type } = jsonData;

    switch (type) {
      case 'system':
        this.handleSystemEvent(jsonData, sessionId);
        break;

      case 'stream_event':
        this.handleStreamEvent(jsonData, sessionId, cwd);
        break;

      case 'assistant':
        this.handleAssistantMessage(jsonData, sessionId);
        break;

      case 'user':
        this.handleUserMessage(jsonData, sessionId);
        break;

      case 'result':
        this.handleResultEvent(jsonData, sessionId, cwd);
        break;

      default:
        this.logger.debug(`Unknown event type: ${type}`);
    }
  }

  /**
   * 处理系统初始化事件
   */
  private handleSystemEvent(jsonData: any, sessionId: string): void {
    this.logger.info(
      `System init: session_id=${jsonData.session_id}, model=${jsonData.model}`
    );
  }

  /**
   * 处理流式事件 (最重要!)
   *
   * stream_event 包含实时的消息增量:
   * - message_start: 消息开始
   * - content_block_start: 内容块开始 (文本/工具调用)
   * - content_block_delta: 内容增量 (文本增量/工具参数增量)
   * - content_block_stop: 内容块结束
   * - message_stop: 消息结束
   */
  private handleStreamEvent(jsonData: any, sessionId: string, cwd?: string): void {
    const event = jsonData.event;
    if (!event) return;

    switch (event.type) {
      case 'message_start':
        this.handleMessageStart(sessionId);
        break;

      case 'content_block_start':
        this.handleContentBlockStart(event, sessionId, cwd);
        break;

      case 'content_block_delta':
        this.handleContentBlockDelta(event, sessionId);
        break;

      case 'content_block_stop':
        // 内容块结束 - 不需要特殊处理
        break;

      case 'message_stop':
        // 消息结束 - 不需要特殊处理
        break;

      default:
        this.logger.debug(`Unknown stream_event type: ${event.type}`);
    }
  }

  /**
   * 处理消息开始事件
   */
  private handleMessageStart(sessionId: string): void {
    this.logger.info(`💭 Message started`);
    this.emitStreamEvent(sessionId, {
      type: 'thinking',
      content: '💭 Claude is thinking...\n',
      timestamp: Date.now(),
    });
  }

  /**
   * 处理内容块开始事件
   *
   * 内容块可以是:
   * - text: 文本内容
   * - tool_use: 工具调用
   */
  private handleContentBlockStart(event: any, sessionId: string, cwd?: string): void {
    const contentBlock = event.content_block;
    if (!contentBlock) return;

    if (contentBlock.type === 'text') {
      // 文本块开始 - 不记录日志,避免冗余
    } else if (contentBlock.type === 'tool_use') {
      // 工具调用开始
      const toolName = contentBlock.name || 'Unknown';
      this.logger.info(`🔧 Tool: ${toolName}`);

      // 记录工具调用 (用于 GitHub 同步)
      if (['Edit', 'Write', 'Bash'].includes(toolName) && cwd) {
        this.changeTracker.recordToolCall(cwd, sessionId, toolName);
      }

      this.emitStreamEvent(sessionId, {
        type: 'tool_use',
        content: `\n🔧 ${toolName}\n`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 处理内容块增量事件 (最关键!)
   *
   * delta 可以是:
   * - text_delta: 文本增量 (立即流式输出!)
   * - input_json_delta: 工具参数增量
   */
  private handleContentBlockDelta(event: any, sessionId: string): void {
    const delta = event.delta;
    if (!delta) return;

    if (delta.type === 'text_delta') {
      // 文本增量 - 立即流式输出!
      const textDelta = delta.text;
      this.emitStreamEvent(sessionId, {
        type: 'text',
        content: textDelta,
        timestamp: Date.now(),
      });

      // 累积 assistant 消息文本 (用于后续保存)
      const buffer = this.messageBuffers.get(sessionId);
      if (buffer) {
        buffer.assistantMessage += textDelta;
      }
    } else if (delta.type === 'input_json_delta') {
      // 工具参数增量 - 只在 debug 模式下记录,减少日志冗余
      const partialJson = delta.partial_json || '';
      if (partialJson.trim()) {
        this.logger.debug(`Tool input building: ${partialJson.substring(0, 50)}...`);
      }
      // 不发送"Building parameters..."消息到前端,减少界面冗余
    }
  }

  /**
   * 处理完整的 assistant 消息
   */
  private handleAssistantMessage(jsonData: any, sessionId: string): void {
    const message = jsonData.message;
    if (!message || !message.content) return;

    // 完整消息已经通过 stream_event 发送过了
    // 这里只用于验证或调试
    this.logger.debug(`Complete assistant message received`);
  }

  /**
   * 处理用户消息 (工具结果)
   */
  private handleUserMessage(jsonData: any, sessionId: string): void {
    const message = jsonData.message;
    if (!message || !message.content) return;

    // 遍历内容块,查找工具结果
    for (const contentBlock of message.content) {
      if (contentBlock.type === 'tool_result') {
        // 简化显示: 只显示一个完成标记
        this.emitStreamEvent(sessionId, {
          type: 'tool_use',
          content: `✅\n`,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * 处理最终结果事件
   *
   * 包含:
   * - Token usage 统计
   * - 成本统计
   * - 持续时间
   */
  private handleResultEvent(jsonData: any, sessionId: string, cwd?: string): void {
    const usage = jsonData.usage;
    const tokenUsage = {
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      cache_creation_input_tokens: usage?.cache_creation_input_tokens || 0,
      cache_read_input_tokens: usage?.cache_read_input_tokens || 0,
    };

    // 计算缓存命中率
    const cacheHitRate = tokenUsage.cache_read_input_tokens > 0
      ? ((tokenUsage.cache_read_input_tokens / (tokenUsage.input_tokens + tokenUsage.cache_read_input_tokens)) * 100).toFixed(1)
      : '0.0';

    // 记录统计信息
    this.logger.info(
      `✅ Final result: duration=${jsonData.duration_ms}ms, cost=$${jsonData.total_cost_usd}`
    );
    this.logger.info(
      `📊 Token usage: input=${tokenUsage.input_tokens}, output=${tokenUsage.output_tokens}`
    );
    if (tokenUsage.cache_read_input_tokens > 0) {
      this.logger.info(
        `💾 Cache hit: ${tokenUsage.cache_read_input_tokens} tokens (${cacheHitRate}% hit rate)`
      );
    }
    if (tokenUsage.cache_creation_input_tokens > 0) {
      this.logger.info(
        `📝 Cache created: ${tokenUsage.cache_creation_input_tokens} tokens`
      );
    }

    // 记录消息 (触发 GitHub 自动同步检查)
    if (cwd) {
      this.githubSync.recordMessage(cwd, sessionId);
      this.logger.debug(`📝 Message recorded for GitHub sync check`);
    }

    // 发送 done 事件 (包含 token 统计)
    this.emitStreamEvent(sessionId, {
      type: 'done',
      content: '',
      timestamp: Date.now(),
      tokenUsage,
    });

    // 保存完整的 assistant 消息到历史
    this.saveMessageToHistory(sessionId, tokenUsage.output_tokens);
  }

  /**
   * 处理 stderr 数据
   *
   * stderr 包含:
   * 1. 错误信息
   * 2. 进度信息
   * 3. Token usage 统计
   * 4. 授权请求 (手动模式)
   *
   * @param data - stderr 数据
   * @param sessionId - 会话 ID
   * @param permissionMode - 授权模式
   */
  public handleStderr(
    data: Buffer | string,
    sessionId: string,
    permissionMode: 'manual' | 'auto' = 'auto'
  ): void {
    const chunk = typeof data === 'string' ? data : data.toString('utf8');

    // 记录原始 stderr 数据
    this.logger.info(`📤 收到 stderr 数据 (${chunk.length} 字节): ${chunk}`);

    // 解析 token usage (从 stderr)
    this.parseTokenUsage(chunk, sessionId);

    // 检测授权请求 (手动模式)
    if (permissionMode === 'manual') {
      this.detectPermissionRequest(chunk, sessionId);
    }

    // 检测思考/进度信息
    if (chunk.includes('Thinking') || chunk.includes('Processing') || chunk.includes('Working')) {
      this.emitStreamEvent(sessionId, {
        type: 'thinking',
        content: chunk,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 从 stderr 解析 token usage
   */
  private parseTokenUsage(chunk: string, sessionId: string): void {
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

      this.logger.info(
        `Token 使用统计: Input=${tokenUsage.input_tokens}, Output=${tokenUsage.output_tokens}`
      );

      this.emitStreamEvent(sessionId, {
        type: 'done',
        content: '',
        timestamp: Date.now(),
        tokenUsage,
      });
    }
  }

  /**
   * 检测授权请求 (手动模式)
   */
  private detectPermissionRequest(chunk: string, sessionId: string): void {
    // Claude CLI 授权请求的特征模式
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
      /\(y\/n\)/i,
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

        // 发送 permission_request 事件
        this.logger.warn(`🔐 检测到授权请求 (${toolName}): ${chunk.substring(0, 100)}`);
        this.eventEmitter.emit('permission_request', sessionId, {
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

  /**
   * 发送流式事件
   *
   * @param sessionId - 会话 ID
   * @param chunk - 流式数据块
   */
  public emitStreamEvent(sessionId: string, chunk: ClaudeStreamChunk): void {
    this.eventEmitter.emit('stream', sessionId, chunk);
  }

  /**
   * 发送错误事件
   *
   * @param sessionId - 会话 ID
   * @param error - 错误信息
   */
  public emitError(sessionId: string, error: string): void {
    this.logger.error(`Error in session ${sessionId}: ${error}`);
    this.emitStreamEvent(sessionId, {
      type: 'error',
      content: error,
      timestamp: Date.now(),
    });
  }

  /**
   * 保存完整的 assistant 消息到历史
   *
   * @param sessionId - 会话 ID
   * @param outputTokens - 输出 token 数
   */
  private async saveMessageToHistory(sessionId: string, outputTokens?: number): Promise<void> {
    const buffer = this.messageBuffers.get(sessionId);

    if (!buffer || buffer.assistantMessage.trim().length === 0) {
      this.logger.debug(`No assistant message to save for session ${sessionId}`);
      return;
    }

    try {
      await this.sessionHistory.saveMessage({
        sessionId,
        timestamp: Date.now(),
        role: 'assistant',
        content: buffer.assistantMessage,
        projectPath: buffer.projectPath,
        metadata: {
          model: buffer.model,
          tokenCount: outputTokens
        }
      });

      this.logger.info(
        `💾 Assistant 消息已保存到历史: ${buffer.assistantMessage.length} 字符`
      );

      // 清理缓冲区
      this.clearMessageBuffer(sessionId);
    } catch (err) {
      this.logger.warn(`保存 assistant 消息失败: ${err}`);
    }
  }
}
