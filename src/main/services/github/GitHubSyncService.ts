/**
 * GitHubSyncService - GitHub 同步调度服务
 *
 * 功能:
 * 1. 自动同步调度 (双重触发: 消息计数 + 时间间隔)
 * 2. 手动同步触发
 * 3. 同步历史管理
 * 4. 会话与 commit 的关联管理
 */

import { Logger } from '../../utils/Logger';
import { DatabaseService } from '../DatabaseService';
import { ChangeTrackerService } from './ChangeTrackerService';
import { GitHubAPIBackend } from './GitHubAPIBackend';
import type { IGitHubBackend, FileData } from './IGitHubBackend';
import type {
  GitHubSyncConfig,
  GitHubCommitResult,
  GitHubSyncHistory,
  GitStatus,
  FileChange,
} from '@shared/types/domain.types';

const logger = Logger.getInstance('GitHubSyncService');

/**
 * 项目同步状态
 */
interface ProjectSyncState {
  projectPath: string;
  sessionId?: string;
  messageCount: number;          // 当前会话的消息数
  lastSyncTime: number;          // 上次同步时间
  timerHandle?: NodeJS.Timeout;  // 定时器句柄
}

/**
 * GitHub 同步服务
 */
export class GitHubSyncService {
  private static instance: GitHubSyncService;
  private backend: IGitHubBackend | null = null;
  private config: GitHubSyncConfig | null = null;
  private db: DatabaseService;
  private changeTracker: ChangeTrackerService;

  // 项目同步状态 (projectPath -> state)
  private projectStates: Map<string, ProjectSyncState> = new Map();

  // 是否启用自动同步
  private autoSyncEnabled: boolean = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.changeTracker = ChangeTrackerService.getInstance();
  }

  public static getInstance(): GitHubSyncService {
    if (!GitHubSyncService.instance) {
      GitHubSyncService.instance = new GitHubSyncService();
    }
    return GitHubSyncService.instance;
  }

  /**
   * 初始化 GitHub 同步
   * 从数据库加载配置并启动
   */
  public async initialize(): Promise<void> {
    try {
      const settings = await this.db.getSettings();
      const githubConfig = settings.github;

      if (!githubConfig || !githubConfig.enabled) {
        logger.info('[GitHubSyncService] GitHub sync is disabled');
        return;
      }

      await this.updateConfig(githubConfig);
      logger.info('[GitHubSyncService] Initialized successfully');
    } catch (error) {
      logger.error('[GitHubSyncService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 更新 GitHub 同步配置
   */
  public async updateConfig(config: GitHubSyncConfig): Promise<void> {
    this.config = config;

    // 初始化后端 (Phase 1: 只支持 API)
    if (config.connectionType === 'api') {
      this.backend = new GitHubAPIBackend();
      await this.backend.initialize(config);
    }

    // 启用/禁用自动同步
    if (config.enabled && config.mode === 'auto') {
      this.enableAutoSync();
    } else {
      this.disableAutoSync();
    }

    logger.info(`[GitHubSyncService] Config updated, mode: ${config.mode}`);
  }

  /**
   * 启用自动同步
   */
  private enableAutoSync(): void {
    this.autoSyncEnabled = true;
    logger.info('[GitHubSyncService] Auto sync enabled');
  }

  /**
   * 禁用自动同步
   */
  private disableAutoSync(): void {
    this.autoSyncEnabled = false;

    // 清除所有定时器
    for (const state of this.projectStates.values()) {
      if (state.timerHandle) {
        clearTimeout(state.timerHandle);
        state.timerHandle = undefined;
      }
    }

    logger.info('[GitHubSyncService] Auto sync disabled');
  }

  /**
   * 记录消息（触发消息计数检查）
   * 在 ClaudeService 中调用此方法
   */
  public recordMessage(projectPath: string, sessionId: string): void {
    if (!this.autoSyncEnabled || !this.config) {
      return;
    }

    let state = this.projectStates.get(projectPath);
    if (!state) {
      state = {
        projectPath,
        sessionId,
        messageCount: 0,
        lastSyncTime: this.config.lastSyncTime || 0,
      };
      this.projectStates.set(projectPath, state);
    }

    state.messageCount += 1;
    state.sessionId = sessionId;

    const trigger = this.config.messageCountTrigger || 10;
    logger.debug(
      `[GitHubSyncService] Message count: ${state.messageCount}/${trigger} for ${projectPath}`
    );

    // 检查是否达到消息计数触发阈值
    if (state.messageCount >= trigger) {
      logger.info(
        `[GitHubSyncService] Message count trigger reached (${state.messageCount}), syncing...`
      );
      this.syncProject(projectPath).catch((error) => {
        logger.error('[GitHubSyncService] Auto sync failed:', error);
      });
      // 重置计数
      state.messageCount = 0;
    }
  }

  /**
   * 启动时间间隔定时器
   */
  public startIntervalTimer(projectPath: string): void {
    if (!this.autoSyncEnabled || !this.config) {
      return;
    }

    const state = this.projectStates.get(projectPath);
    if (!state) {
      logger.warn(`[GitHubSyncService] Project state not found: ${projectPath}`);
      return;
    }

    // 清除旧定时器
    if (state.timerHandle) {
      clearTimeout(state.timerHandle);
    }

    const interval = (this.config.autoSyncInterval || 30) * 60 * 1000; // 分钟转毫秒

    state.timerHandle = setTimeout(() => {
      logger.info(`[GitHubSyncService] Interval trigger reached, syncing...`);
      this.syncProject(projectPath).catch((error) => {
        logger.error('[GitHubSyncService] Auto sync failed:', error);
      });
    }, interval);

    logger.info(
      `[GitHubSyncService] Interval timer started: ${this.config.autoSyncInterval} minutes`
    );
  }

  /**
   * 手动同步项目
   */
  public async syncProject(projectPath: string): Promise<GitHubCommitResult> {
    if (!this.backend || !this.config) {
      throw new Error('GitHub sync not configured');
    }

    try {
      logger.info(`[GitHubSyncService] Starting sync for: ${projectPath}`);

      // 1. 检查是否是 Git 仓库
      const isRepo = await this.backend.isGitRepository(projectPath);
      if (!isRepo) {
        throw new Error(
          'Project is not a Git repository. Please initialize Git first via Settings.'
        );
      }

      // 2. 获取变更的文件
      const state = this.projectStates.get(projectPath);
      const lastSyncTime = state?.lastSyncTime || this.config.lastSyncTime;
      const changes = await this.changeTracker.getChangedFiles(projectPath, lastSyncTime);

      if (changes.length === 0) {
        logger.info('[GitHubSyncService] No changes to sync');
        const result: GitHubCommitResult = {
          success: true,
          filesChanged: 0,
          timestamp: Date.now(),
          projectPath,
        };
        return result;
      }

      // 3. 检查敏感文件
      const sensitiveFiles = this.changeTracker.checkSensitiveFiles(changes);
      if (sensitiveFiles.length > 0) {
        // TODO: 通过 IPC 通知前端显示警告
        logger.warn(
          `[GitHubSyncService] Detected ${sensitiveFiles.length} sensitive files, skipping sync`
        );
        throw new Error(
          `Detected sensitive files: ${sensitiveFiles.join(', ')}. Please review before syncing.`
        );
      }

      // 4. 提取会话 ID
      const sessionIds = Array.from(
        new Set(changes.map((c) => c.sessionId).filter(Boolean) as string[])
      );

      // 5. 生成 commit 消息
      const message = await this.generateCommitMessage(projectPath, sessionIds, changes);

      // 6. 准备文件数据
      const fileData: FileData[] = changes
        .filter((c) => c.type !== 'deleted')
        .map((c) => ({
          path: c.path,
          content: c.content || '', // 内容由 git 管理，这里不需要实际读取
        }));

      // 7. 提交并推送
      const result = await this.backend.commitAndPush(fileData, message, projectPath);

      if (result.success && result.commitSha) {
        // 8. 保存同步历史
        await this.saveSyncHistory({
          commitSha: result.commitSha,
          commitUrl: result.commitUrl!,
          projectPath,
          sessionIds,
          filesChanged: result.filesChanged,
          message,
          timestamp: result.timestamp,
          backend: 'api',
        });

        // 9. 更新项目状态
        if (state) {
          state.lastSyncTime = result.timestamp;
          state.messageCount = 0; // 重置消息计数
        }

        // 10. 更新配置中的 lastSyncTime
        this.config.lastSyncTime = result.timestamp;
        this.config.lastSyncCommitSha = result.commitSha;
        await this.saveConfig();

        // 11. 清除工具调用记录
        this.changeTracker.clearToolCalls(projectPath, result.timestamp);

        logger.info(`[GitHubSyncService] Sync completed: ${result.commitSha}`);
      }

      return result;
    } catch (error) {
      logger.error('[GitHubSyncService] Sync failed:', error);
      throw error;
    }
  }

  /**
   * 生成 commit 消息
   * 格式: feat: [会话标题]
   */
  private async generateCommitMessage(
    projectPath: string,
    sessionIds: string[],
    changes: FileChange[]
  ): Promise<string> {
    try {
      // 如果有关联会话，使用第一个会话的标题
      if (sessionIds.length > 0) {
        const session = await this.db.getSession(sessionIds[0]);
        if (session) {
          return `feat: ${session.title}`;
        }
      }

      // 否则使用通用消息
      const timestamp = new Date().toISOString();
      return `chore: auto sync ${changes.length} files at ${timestamp}`;
    } catch {
      return `chore: auto sync ${changes.length} files`;
    }
  }

  /**
   * 保存同步历史
   */
  private async saveSyncHistory(history: GitHubSyncHistory): Promise<void> {
    await this.db.saveSyncHistory(history);
    logger.info(`[GitHubSyncService] Sync history saved: ${history.commitSha}`);
  }

  /**
   * 保存配置到数据库
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) {
      return;
    }

    const settings = await this.db.getSettings();
    await this.db.updateSettings({
      ...settings,
      github: this.config,
    });
  }

  /**
   * 获取 Git 状态
   */
  public async getGitStatus(projectPath: string): Promise<GitStatus> {
    if (!this.backend) {
      // 返回默认状态而不是 null，避免前端解构错误
      return {
        isRepo: false,
        hasRemote: false,
        hasUncommitted: false,
        hasUnpushed: false,
        modifiedFiles: [],
        untrackedFiles: [],
      };
    }

    return this.backend.getGitStatus(projectPath);
  }

  /**
   * 初始化 Git 仓库
   */
  public async initializeGitRepository(
    projectPath: string,
    userName: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.backend) {
      return { success: false, error: 'Backend not initialized' };
    }

    return this.backend.initializeGitRepository(projectPath, { userName, userEmail });
  }

  /**
   * 添加远程仓库
   */
  public async addRemote(
    projectPath: string,
    remoteName: string,
    remoteUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.backend) {
      return { success: false, error: 'Backend not initialized' };
    }

    return this.backend.addRemote(projectPath, remoteName, remoteUrl);
  }

  /**
   * 测试 GitHub 连接
   */
  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.backend) {
      return { success: false, error: 'Backend not initialized' };
    }

    return this.backend.testConnection();
  }

  /**
   * 获取所有同步历史
   */
  public async getAllSyncHistory(): Promise<GitHubSyncHistory[]> {
    return this.db.getAllSyncHistory();
  }

  /**
   * 根据项目获取同步历史
   */
  public async getSyncHistoryByProject(projectPath: string): Promise<GitHubSyncHistory[]> {
    return this.db.getSyncHistoryByProject(projectPath);
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    this.disableAutoSync();
    this.projectStates.clear();

    if (this.backend) {
      await this.backend.cleanup();
      this.backend = null;
    }

    logger.info('[GitHubSyncService] Cleaned up');
  }
}
