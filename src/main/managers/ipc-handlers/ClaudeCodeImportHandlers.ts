/**
 * Claude Code Import Handlers - Claude Code CLI 导入相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';
import { WindowManager } from '../WindowManager';

export class ClaudeCodeImportHandlers extends BaseHandler {
  private importController: any;

  constructor() {
    super('ClaudeCodeImport');
    const { ClaudeCodeImportController } = require('../../services/ClaudeCodeImportController');
    this.importController = new ClaudeCodeImportController();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void,
    sendToRenderer?: (channel: string, ...args: unknown[]) => void
  ): void {
    // 检测 Claude Code 数据
    registerFn(
      IPCChannels.CLAUDE_CODE_DETECT,
      async () => {
        this.logger.info('[ClaudeCodeImport] 检测 Claude Code 数据...');
        const result = await this.importController.detectData();
        this.logger.info(`[ClaudeCodeImport] 检测结果: ${result.exists ? `找到 ${result.totalSessions} 个会话` : '未找到数据'}`);
        return result;
      }
    );

    // 预览导入数据
    registerFn(
      IPCChannels.CLAUDE_CODE_PREVIEW,
      async () => {
        this.logger.info('[ClaudeCodeImport] 预览导入数据...');
        const preview = await this.importController.previewImport();
        this.logger.info(`[ClaudeCodeImport] 预览完成: ${preview.projects.length} 个项目`);
        return preview;
      }
    );

    // 导入所有会话
    registerFn(
      IPCChannels.CLAUDE_CODE_IMPORT_ALL,
      async () => {
        this.logger.info('[ClaudeCodeImport] 🚀 开始导入所有会话...');

        const windowManager = WindowManager.getInstance();
        const mainWindow = windowManager.getMainWindow();

        // 导入进度回调
        const result = await this.importController.importAll((progress: any) => {
          // 发送进度事件到渲染进程
          if (mainWindow && sendToRenderer) {
            sendToRenderer(IPCChannels.CLAUDE_CODE_IMPORT_PROGRESS, progress);
          }
        });

        this.logger.info(`[ClaudeCodeImport] ✅ 导入完成: 成功 ${result.importedSessions}, 跳过 ${result.skippedSessions}, 失败 ${result.failedSessions}`);
        return result;
      }
    );

    this.logger.info('✅ Claude Code Import handlers registered');
  }
}
