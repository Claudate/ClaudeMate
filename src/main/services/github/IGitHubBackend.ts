/**
 * IGitHubBackend - 统一的 GitHub 后端接口
 *
 * Phase 1: 支持 GitHub API 实现
 * Phase 2: 扩展支持 GitHub MCP 实现
 */

import type {
  GitHubSyncConfig,
  GitHubRepository,
  GitHubCommitResult,
  GitStatus,
} from '@shared/types/domain.types';

/**
 * 文件数据
 */
export interface FileData {
  path: string;      // 相对于项目根目录的路径
  content: string;   // 文件内容
}

/**
 * GitHub 后端统一接口
 */
export interface IGitHubBackend {
  /**
   * 初始化后端
   * @param config GitHub 同步配置
   */
  initialize(config: GitHubSyncConfig): Promise<void>;

  /**
   * 提交文件到 GitHub
   * @param files 文件列表
   * @param message 提交消息
   * @param projectPath 项目路径（用于执行 git 命令）
   */
  commitAndPush(
    files: FileData[],
    message: string,
    projectPath: string
  ): Promise<GitHubCommitResult>;

  /**
   * 测试连接
   */
  testConnection(): Promise<{ success: boolean; error?: string }>;

  /**
   * 获取仓库信息
   */
  getRepository(): Promise<GitHubRepository>;

  /**
   * 获取 Git 状态
   * @param projectPath 项目路径
   */
  getGitStatus(projectPath: string): Promise<GitStatus>;

  /**
   * 检查项目是否是 Git 仓库
   * @param projectPath 项目路径
   */
  isGitRepository(projectPath: string): Promise<boolean>;

  /**
   * 初始化 Git 仓库（如果不存在）
   * @param projectPath 项目路径
   * @param config Git 配置（user.name, user.email）
   */
  initializeGitRepository(
    projectPath: string,
    config: { userName: string; userEmail: string }
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * 添加远程仓库
   * @param projectPath 项目路径
   * @param remoteName 远程仓库名称（默认 'origin'）
   * @param remoteUrl 远程仓库 URL
   */
  addRemote(
    projectPath: string,
    remoteName: string,
    remoteUrl: string
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * 获取后端类型
   */
  getBackendType(): 'api' | 'mcp';

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}
