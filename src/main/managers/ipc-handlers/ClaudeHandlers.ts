/**
 * Claude Handlers - Claude CLI 集成相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel, ClaudeExecuteSchema } from '../../../shared/types/ipc.types';
import { ClaudeService, ClaudeStreamChunk } from '../../services/ClaudeService';

export class ClaudeHandlers extends BaseHandler {
  private claudeService: ClaudeService;

  constructor() {
    super('Claude');
    this.claudeService = ClaudeService.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void,
    sendToRenderer?: (channel: string, ...args: unknown[]) => void
  ): void {
    // 检查 CLI 是否可用
    registerFn(
      IPCChannels.CLAUDE_CHECK_AVAILABLE,
      async () => {
        this.logger.info('Checking if Claude CLI is available');
        const isAvailable = await this.claudeService.isAvailable();
        this.logger.info(`Claude CLI availability result: ${isAvailable}`);
        return { isAvailable };
      }
    );

    // 检查认证状态
    registerFn(
      IPCChannels.CLAUDE_CHECK_AUTH,
      async () => {
        this.logger.info('Checking Claude CLI authentication status');
        return await this.claudeService.checkAuth();
      }
    );

    // 登录
    registerFn(
      IPCChannels.CLAUDE_LOGIN,
      async () => {
        this.logger.info('Starting Claude CLI login process');
        const success = await this.claudeService.login();
        return { success };
      }
    );

    // 登出
    registerFn(
      IPCChannels.CLAUDE_LOGOUT,
      async () => {
        this.logger.info('Starting Claude CLI logout process');
        const success = await this.claudeService.logout();
        return { success };
      }
    );

    // 执行命令
    registerFn(
      IPCChannels.CLAUDE_EXECUTE,
      async (data: {
        message: string;
        sessionId?: string;
        model?: 'opus' | 'sonnet' | 'haiku';
        cwd?: string;
        permissionMode?: 'manual' | 'auto'
      }) => {
        const { message, sessionId, model, cwd, permissionMode } = data;

        this.logger.info(`Executing Claude CLI for session: ${sessionId || 'default'}, permissionMode: ${permissionMode || 'auto'}`);

        const response = await this.claudeService.execute({
          message,
          sessionId: sessionId || 'default',
          model,
          cwd,
          permissionMode,
        });

        return { response };
      },
      ClaudeExecuteSchema
    );

    // 取消执行
    registerFn(
      IPCChannels.CLAUDE_CANCEL,
      async (data: { sessionId: string }) => {
        const { sessionId } = data;
        const canceled = this.claudeService.cancel(sessionId);
        this.logger.info(`Claude session ${sessionId} cancel result: ${canceled}`);
        return { canceled };
      }
    );

    // 响应权限请求
    registerFn(
      IPCChannels.CLAUDE_PERMISSION_RESPONSE,
      async (data: { sessionId: string; approved: boolean }) => {
        const { sessionId, approved } = data;
        this.logger.info(`Received permission response for session ${sessionId}: ${approved ? 'approved' : 'denied'}`);

        const success = this.claudeService.respondToPermission(sessionId, approved);
        return { success };
      }
    );

    // 设置流式事件转发
    if (sendToRenderer) {
      this.claudeService.on('stream', (sessionId: string, chunk: ClaudeStreamChunk) => {
        sendToRenderer('claude:stream', { sessionId, chunk });
      });

      this.claudeService.on('permission_request', (sessionId: string, request: any) => {
        this.logger.info(`Forwarding permission request to renderer:`, request);
        sendToRenderer(IPCChannels.CLAUDE_PERMISSION_REQUEST, { sessionId, request });
      });
    }

    this.logger.info('Claude IPC handlers registered');
  }
}
