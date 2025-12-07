/**
 * GitHub Sync Handlers - GitHub 同步相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';

export class GitHubSyncHandlers extends BaseHandler {
  private githubSync: any;

  constructor() {
    super('GitHubSync');
    const { GitHubSyncService } = require('../../services/github/GitHubSyncService');
    this.githubSync = GitHubSyncService.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void,
    sendToRenderer?: (channel: string, ...args: unknown[]) => void
  ): void {
    // 同步操作
    this.registerSyncOperations(registerFn, sendToRenderer);

    // Git 操作
    this.registerGitOperations(registerFn);

    // 历史记录
    this.registerHistoryOperations(registerFn);

    this.logger.info('GitHub Sync IPC handlers registered');
  }

  private registerSyncOperations(registerFn: any, sendToRenderer?: any): void {
    // 手动触发同步
    registerFn(
      IPCChannels.GITHUB_SYNC_MANUAL,
      async (data: { projectPath: string }) => {
        this.logger.info(`[GitHub Sync] Manual sync triggered for: ${data.projectPath}`);
        const result = await this.githubSync.syncProject(data.projectPath);

        // 发送同步结果事件到渲染进程
        if (sendToRenderer) {
          if (result.success) {
            sendToRenderer(IPCChannels.GITHUB_SYNC_COMPLETED, result);
          } else {
            sendToRenderer(IPCChannels.GITHUB_SYNC_FAILED, {
              error: result.error || 'Unknown error',
              projectPath: data.projectPath,
            });
          }
        }

        return result;
      }
    );

    // 配置同步
    registerFn(
      IPCChannels.GITHUB_SYNC_CONFIGURE,
      async (data: any) => {
        this.logger.info(`[GitHub Sync] Updating configuration`);
        await this.githubSync.updateConfig(data.config);
        return { success: true };
      }
    );

    // 测试连接
    registerFn(
      IPCChannels.GITHUB_SYNC_TEST_CONNECTION,
      async (data: { config?: any }) => {
        this.logger.info(`[GitHub Sync] Testing connection`);

        // 如果提供了临时配置，先用它初始化（不保存到数据库）
        if (data.config) {
          this.logger.info(`[GitHub Sync] Using temporary config for testing`);
          await this.githubSync.updateConfig({ ...data.config, enabled: false });
        }

        const result = await this.githubSync.testConnection();
        return result;
      }
    );
  }

  private registerGitOperations(registerFn: any): void {
    // 获取 Git 状态
    registerFn(
      IPCChannels.GITHUB_GET_GIT_STATUS,
      async (data: { projectPath: string }) => {
        this.logger.info(`[GitHub Sync] Getting Git status for: ${data.projectPath}`);
        const status = await this.githubSync.getGitStatus(data.projectPath);
        return status;
      }
    );

    // 初始化 Git 仓库
    registerFn(
      IPCChannels.GITHUB_INIT_REPOSITORY,
      async (data: { projectPath: string; userName: string; userEmail: string }) => {
        this.logger.info(`[GitHub Sync] Initializing Git repository: ${data.projectPath}`);
        const result = await this.githubSync.initializeGitRepository(
          data.projectPath,
          data.userName,
          data.userEmail
        );
        return result;
      }
    );

    // 添加远程仓库
    registerFn(
      IPCChannels.GITHUB_ADD_REMOTE,
      async (data: { projectPath: string; remoteName: string; remoteUrl: string }) => {
        this.logger.info(`[GitHub Sync] Adding remote: ${data.remoteName} -> ${data.remoteUrl}`);
        const result = await this.githubSync.addRemote(
          data.projectPath,
          data.remoteName,
          data.remoteUrl
        );
        return result;
      }
    );
  }

  private registerHistoryOperations(registerFn: any): void {
    // 获取所有同步历史
    registerFn(
      IPCChannels.GITHUB_GET_SYNC_HISTORY,
      async () => {
        this.logger.info(`[GitHub Sync] Getting all sync history`);
        const history = await this.githubSync.getAllSyncHistory();
        return { history };
      }
    );

    // 根据项目获取同步历史
    registerFn(
      IPCChannels.GITHUB_GET_SYNC_HISTORY_BY_PROJECT,
      async (data: { projectPath: string }) => {
        this.logger.info(`[GitHub Sync] Getting sync history for: ${data.projectPath}`);
        const history = await this.githubSync.getSyncHistoryByProject(data.projectPath);
        return { history };
      }
    );
  }
}
