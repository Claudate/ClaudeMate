/**
 * GitHubAPIBackend - GitHub API 实现
 *
 * 使用 @octokit/rest 连接 GitHub
 * 使用本地 git 命令执行 commit 和 push 操作
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '../../utils/Logger';
import type { IGitHubBackend, FileData } from './IGitHubBackend';
import type {
  GitHubSyncConfig,
  GitHubRepository,
  GitHubCommitResult,
  GitStatus,
} from '@shared/types/domain.types';

// Dynamic import for ESM module
type Octokit = any;

const execAsync = promisify(exec);
const logger = Logger.getInstance('GitHubAPIBackend');

/**
 * GitHub API 后端实现
 */
export class GitHubAPIBackend implements IGitHubBackend {
  private config: GitHubSyncConfig | null = null;
  private octokit: Octokit | null = null;
  private owner: string = '';
  private repo: string = '';
  private OctokitClass: any = null;

  getBackendType(): 'api' | 'mcp' {
    return 'api';
  }

  async initialize(config: GitHubSyncConfig): Promise<void> {
    if (!config.token) {
      throw new Error('GitHub token is required for API backend');
    }

    if (!config.repository) {
      throw new Error('Repository is required (format: owner/repo)');
    }

    this.config = config;

    // 解析仓库地址
    const [owner, repo] = config.repository.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected: owner/repo');
    }
    this.owner = owner;
    this.repo = repo;

    // 动态导入 Octokit (ESM module)
    // 使用 eval 绕过 TypeScript 编译器将 import() 转换为 require()
    if (!this.OctokitClass) {
      // eslint-disable-next-line no-eval
      const octokitModule = await eval('import("@octokit/rest")');
      this.OctokitClass = octokitModule.Octokit;
    }

    // 初始化 Octokit
    this.octokit = new this.OctokitClass({
      auth: config.token,
    });

    // 测试连接
    await this.testConnection();

    logger.info(`[GitHubAPIBackend] 初始化成功: ${config.repository}`);
  }

  /**
   * 提交并推送到 GitHub
   *
   * 策略:
   * 1. 使用 git 命令在本地提交
   * 2. 使用 git push 推送到 GitHub
   * 3. 从 git 输出中提取 commit SHA
   */
  async commitAndPush(
    files: FileData[],
    message: string,
    projectPath: string
  ): Promise<GitHubCommitResult> {
    if (!this.config) {
      throw new Error('Backend not initialized');
    }

    try {
      const branch = this.config.syncBranch || 'main';

      // 1. 检查是否是 Git 仓库
      const isRepo = await this.isGitRepository(projectPath);
      if (!isRepo) {
        throw new Error('Project is not a Git repository. Please initialize Git first.');
      }

      // 2. 检查是否配置了远程仓库
      const status = await this.getGitStatus(projectPath);
      if (!status.hasRemote) {
        throw new Error('No remote repository configured. Please add remote first.');
      }

      // 3. 拉取最新更改（避免冲突）
      logger.info('[GitHubAPIBackend] Pulling latest changes...');
      try {
        await execAsync(`git pull origin ${branch}`, { cwd: projectPath });
      } catch (error) {
        // 如果拉取失败（例如首次推送），继续执行
        logger.warn('[GitHubAPIBackend] Pull failed (might be first push):', error);
      }

      // 4. 添加文件到暂存区
      logger.info(`[GitHubAPIBackend] Adding ${files.length} files to staging...`);
      for (const file of files) {
        await execAsync(`git add "${file.path}"`, { cwd: projectPath });
      }

      // 5. 检查是否有更改需要提交
      const { stdout: diffOutput } = await execAsync('git diff --cached --name-only', {
        cwd: projectPath,
      });
      const changedFiles = diffOutput.trim().split('\n').filter(Boolean);

      if (changedFiles.length === 0) {
        logger.info('[GitHubAPIBackend] No changes to commit');
        return {
          success: true,
          filesChanged: 0,
          timestamp: Date.now(),
        };
      }

      // 6. 提交更改
      logger.info('[GitHubAPIBackend] Committing changes...');
      await execAsync(`git commit -m "${message}"`, { cwd: projectPath });

      // 7. 获取 commit SHA
      const { stdout: shaOutput } = await execAsync('git rev-parse HEAD', {
        cwd: projectPath,
      });
      const commitSha = shaOutput.trim();

      // 8. 推送到 GitHub
      logger.info('[GitHubAPIBackend] Pushing to GitHub...');
      await execAsync(`git push origin ${branch}`, { cwd: projectPath });

      // 9. 构造 commit URL
      const commitUrl = `https://github.com/${this.owner}/${this.repo}/commit/${commitSha}`;

      logger.info(`[GitHubAPIBackend] Commit successful: ${commitSha}`);

      return {
        success: true,
        commitSha,
        commitUrl,
        filesChanged: changedFiles.length,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('[GitHubAPIBackend] Commit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        filesChanged: 0,
        timestamp: Date.now(),
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.octokit) {
      return { success: false, error: 'Octokit not initialized' };
    }

    try {
      // 尝试获取仓库信息
      await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async getRepository(): Promise<GitHubRepository> {
    if (!this.octokit) {
      throw new Error('Octokit not initialized');
    }

    try {
      const { data } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        description: data.description || undefined,
        url: data.html_url,
        defaultBranch: data.default_branch,
        isPrivate: data.private,
      };
    } catch (error) {
      throw new Error(`Failed to get repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGitStatus(projectPath: string): Promise<GitStatus> {
    try {
      // 检查是否是 Git 仓库
      const isRepo = await this.isGitRepository(projectPath);
      if (!isRepo) {
        return {
          isRepo: false,
          hasRemote: false,
          hasUncommitted: false,
          hasUnpushed: false,
          modifiedFiles: [],
          untrackedFiles: [],
        };
      }

      // 获取当前分支
      const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
      });
      const currentBranch = branchOutput.trim();

      // 检查远程仓库
      let hasRemote = false;
      try {
        const { stdout: remoteOutput } = await execAsync('git remote', { cwd: projectPath });
        hasRemote = remoteOutput.trim().length > 0;
      } catch {
        hasRemote = false;
      }

      // 获取修改的文件
      const { stdout: modifiedOutput } = await execAsync('git diff --name-only', {
        cwd: projectPath,
      });
      const modifiedFiles = modifiedOutput.trim().split('\n').filter(Boolean);

      // 获取未跟踪的文件
      const { stdout: untrackedOutput } = await execAsync('git ls-files --others --exclude-standard', {
        cwd: projectPath,
      });
      const untrackedFiles = untrackedOutput.trim().split('\n').filter(Boolean);

      // 检查是否有未提交的更改
      const hasUncommitted = modifiedFiles.length > 0 || untrackedFiles.length > 0;

      // 检查是否有未推送的提交
      let hasUnpushed = false;
      if (hasRemote) {
        try {
          const { stdout: unpushedOutput } = await execAsync(`git log origin/${currentBranch}..HEAD`, {
            cwd: projectPath,
          });
          hasUnpushed = unpushedOutput.trim().length > 0;
        } catch {
          // 如果远程分支不存在（首次推送），也算作有未推送的提交
          hasUnpushed = true;
        }
      }

      return {
        isRepo: true,
        hasRemote,
        currentBranch,
        hasUncommitted,
        hasUnpushed,
        modifiedFiles,
        untrackedFiles,
      };
    } catch (error) {
      logger.error('[GitHubAPIBackend] Failed to get git status:', error);
      throw error;
    }
  }

  async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      const gitDir = join(projectPath, '.git');
      return existsSync(gitDir);
    } catch {
      return false;
    }
  }

  async initializeGitRepository(
    projectPath: string,
    config: { userName: string; userEmail: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 初始化 Git 仓库
      await execAsync('git init', { cwd: projectPath });

      // 2. 配置用户信息
      await execAsync(`git config user.name "${config.userName}"`, { cwd: projectPath });
      await execAsync(`git config user.email "${config.userEmail}"`, { cwd: projectPath });

      logger.info('[GitHubAPIBackend] Git repository initialized');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async addRemote(
    projectPath: string,
    remoteName: string,
    remoteUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查远程仓库是否已存在
      try {
        await execAsync(`git remote get-url ${remoteName}`, { cwd: projectPath });
        // 如果存在，先删除
        await execAsync(`git remote remove ${remoteName}`, { cwd: projectPath });
      } catch {
        // 远程仓库不存在，继续添加
      }

      // 添加远程仓库
      await execAsync(`git remote add ${remoteName} ${remoteUrl}`, { cwd: projectPath });

      logger.info(`[GitHubAPIBackend] Remote '${remoteName}' added: ${remoteUrl}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cleanup(): Promise<void> {
    this.config = null;
    this.octokit = null;
    this.owner = '';
    this.repo = '';
    logger.info('[GitHubAPIBackend] Cleaned up');
  }
}
