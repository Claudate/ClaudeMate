/**
 * GitHub Sync Settings Component
 * 按照 react-component.skill.md 和 ipc-handler.skill.md 规范创建
 */

import { useState, useEffect } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { IPCChannels } from '@shared/types/ipc.types';
import type { GitHubSyncConfig, GitStatus } from '@shared/types/domain.types';

interface GitHubSyncSettingsProps {
  projectPath?: string;
}

export function GitHubSyncSettings({ projectPath }: GitHubSyncSettingsProps) {
  const { invoke } = useIPC();

  // 配置状态
  const [config, setConfig] = useState<Partial<GitHubSyncConfig>>({
    enabled: false,
    mode: 'manual',
    connectionType: 'api',
    token: '',
    repository: '',
    autoSyncInterval: 30,
    messageCountTrigger: 10,
    syncBranch: 'main',
    gitUserName: '',
    gitUserEmail: '',
  });

  // UI 状态
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isInitializingRepo, setIsInitializingRepo] = useState(false);
  const [isAddingRemote, setIsAddingRemote] = useState(false);

  // 从数据库加载配置
  useEffect(() => {
    loadConfig();
    if (projectPath) {
      loadGitStatus();
    }
  }, [projectPath]);

  const loadConfig = async () => {
    try {
      const { settings } = await invoke(IPCChannels.SETTINGS_GET, {});
      if (settings?.github) {
        setConfig(settings.github);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const loadGitStatus = async () => {
    if (!projectPath) return;

    try {
      const { status } = await invoke(IPCChannels.GITHUB_GET_GIT_STATUS, {
        projectPath,
      });
      setGitStatus(status);
    } catch (error) {
      console.error('获取 Git 状态失败:', error);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!config.token || !config.repository) {
      setTestResult({ success: false, error: '请填写 Token 和 Repository' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await invoke(IPCChannels.GITHUB_SYNC_TEST_CONNECTION, {
        config: config, // 传递当前配置
      });
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || '连接测试失败',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    setIsSaving(true);

    try {
      await invoke(IPCChannels.GITHUB_SYNC_CONFIGURE, {
        config: config as GitHubSyncConfig,
      });

      alert('配置已保存');
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 初始化 Git 仓库
  const handleInitRepository = async () => {
    if (!projectPath) {
      alert('请先打开一个项目');
      return;
    }

    if (!config.gitUserName || !config.gitUserEmail) {
      alert('请填写 Git 用户信息');
      return;
    }

    setIsInitializingRepo(true);

    try {
      const result = await invoke(IPCChannels.GITHUB_INIT_REPOSITORY, {
        projectPath,
        userName: config.gitUserName,
        userEmail: config.gitUserEmail,
      });

      if (result.success) {
        alert('Git 仓库初始化成功');
        loadGitStatus();
      } else {
        alert(`初始化失败: ${result.error}`);
      }
    } catch (error: any) {
      alert(`初始化失败: ${error.message}`);
    } finally {
      setIsInitializingRepo(false);
    }
  };

  // 添加远程仓库
  const handleAddRemote = async () => {
    if (!projectPath) {
      alert('请先打开一个项目');
      return;
    }

    if (!config.repository) {
      alert('请填写 Repository');
      return;
    }

    const remoteUrl = `https://github.com/${config.repository}.git`;

    setIsAddingRemote(true);

    try {
      const result = await invoke(IPCChannels.GITHUB_ADD_REMOTE, {
        projectPath,
        remoteName: 'origin',
        remoteUrl,
      });

      if (result.success) {
        alert('远程仓库添加成功');
        loadGitStatus();
      } else {
        alert(`添加失败: ${result.error}`);
      }
    } catch (error: any) {
      alert(`添加失败: ${error.message}`);
    } finally {
      setIsAddingRemote(false);
    }
  };

  return (
    <div className="vscode-panel p-4">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <i className="codicon codicon-github text-xl" />
        GitHub 同步配置
      </h2>

      <div className="space-y-4">
        {/* 启用/禁用 */}
        <div className="flex items-center justify-between pb-4 border-b border-vscode-border">
          <div className="flex-1">
            <div className="text-sm font-medium">启用 GitHub 同步</div>
            <p className="text-xs text-vscode-foreground-dim">
              自动将项目变更同步到 GitHub
            </p>
          </div>
          <button
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              config.enabled ? 'bg-vscode-accent' : 'bg-vscode-input-border'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                config.enabled ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Git 状态 */}
        {projectPath && (
          <div className="bg-vscode-input-bg p-3 rounded">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <i className="codicon codicon-git-branch" />
              Git 状态
            </div>
            {gitStatus ? (
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-vscode-foreground-dim">仓库:</span>
                  <span>{gitStatus.isRepository ? '✅ 已初始化' : '❌ 未初始化'}</span>
                </div>
                {gitStatus.isRepository && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-vscode-foreground-dim">分支:</span>
                      <span>{gitStatus.branch || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-vscode-foreground-dim">远程:</span>
                      <span>{gitStatus.remote || '未配置'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-vscode-foreground-dim">修改文件:</span>
                      <span>{gitStatus.modifiedFiles?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-vscode-foreground-dim">未跟踪:</span>
                      <span>{gitStatus.untrackedFiles?.length || 0}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-xs text-vscode-foreground-dim">加载中...</div>
            )}
          </div>
        )}

        {/* GitHub Token */}
        <div>
          <label className="block text-sm text-vscode-foreground-dim mb-2">
            GitHub Personal Access Token
          </label>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              className="vscode-input flex-1"
              placeholder="ghp_xxxxxxxxxxxx"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="vscode-button-secondary flex items-center gap-1"
            >
              <i className={`codicon codicon-${showToken ? 'eye-closed' : 'eye'}`} />
              {showToken ? '隐藏' : '显示'}
            </button>
          </div>
          <p className="text-xs text-vscode-foreground-dim mt-1">
            <a
              href="https://github.com/settings/tokens"
              className="text-vscode-accent hover:underline"
              onClick={(e) => {
                e.preventDefault();
                window.electron.invoke(IPCChannels.SHELL_OPEN_URL, {
                  url: 'https://github.com/settings/tokens',
                });
              }}
            >
              创建 GitHub Token
            </a>{' '}
            (需要 repo 权限)
          </p>
        </div>

        {/* Repository */}
        <div>
          <label className="block text-sm text-vscode-foreground-dim mb-2">
            Repository (仓库)
          </label>
          <input
            type="text"
            value={config.repository}
            onChange={(e) => setConfig({ ...config, repository: e.target.value })}
            className="vscode-input w-full"
            placeholder="owner/repo-name"
          />
          <p className="text-xs text-vscode-foreground-dim mt-1">
            格式: 用户名/仓库名 (例如: octocat/hello-world)
          </p>
        </div>

        {/* 测试连接 */}
        <div>
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !config.token || !config.repository}
            className="vscode-button-secondary flex items-center gap-2"
          >
            <i className={`codicon codicon-${isTesting ? 'loading' : 'plug'} ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? '测试中...' : '测试连接'}
          </button>

          {testResult && (
            <div
              className={`mt-2 p-2 rounded text-xs ${
                testResult.success
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              {testResult.success ? '✅ 连接成功' : `❌ ${testResult.error}`}
            </div>
          )}
        </div>

        {/* 同步模式 */}
        <div>
          <label className="block text-sm text-vscode-foreground-dim mb-2">
            同步模式
          </label>
          <select
            value={config.mode}
            onChange={(e) =>
              setConfig({ ...config, mode: e.target.value as 'manual' | 'auto' })
            }
            className="vscode-input w-full"
          >
            <option value="manual">手动 - 仅手动触发同步</option>
            <option value="auto">自动 - 根据消息数和时间间隔自动同步</option>
          </select>
        </div>

        {/* 自动同步配置 */}
        {config.mode === 'auto' && (
          <>
            <div>
              <label className="block text-sm text-vscode-foreground-dim mb-2">
                自动同步间隔: {config.autoSyncInterval} 分钟
              </label>
              <input
                type="range"
                min="30"
                max="180"
                step="30"
                value={config.autoSyncInterval}
                onChange={(e) =>
                  setConfig({ ...config, autoSyncInterval: Number(e.target.value) })
                }
                className="w-full"
              />
              <p className="text-xs text-vscode-foreground-dim mt-1">
                每隔指定时间自动同步一次 (最小 30 分钟)
              </p>
            </div>

            <div>
              <label className="block text-sm text-vscode-foreground-dim mb-2">
                消息计数触发: {config.messageCountTrigger} 条
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={config.messageCountTrigger}
                onChange={(e) =>
                  setConfig({ ...config, messageCountTrigger: Number(e.target.value) })
                }
                className="vscode-input w-full"
              />
              <p className="text-xs text-vscode-foreground-dim mt-1">
                每发送指定数量的消息后自动同步
              </p>
            </div>
          </>
        )}

        {/* 分支 */}
        <div>
          <label className="block text-sm text-vscode-foreground-dim mb-2">
            同步分支
          </label>
          <input
            type="text"
            value={config.syncBranch}
            onChange={(e) => setConfig({ ...config, syncBranch: e.target.value })}
            className="vscode-input w-full"
            placeholder="main"
          />
        </div>

        {/* Git 用户信息 */}
        <div className="border-t border-vscode-border pt-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <i className="codicon codicon-person" />
            Git 用户信息
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-vscode-foreground-dim mb-2">
                用户名 (user.name)
              </label>
              <input
                type="text"
                value={config.gitUserName}
                onChange={(e) => setConfig({ ...config, gitUserName: e.target.value })}
                className="vscode-input w-full"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-sm text-vscode-foreground-dim mb-2">
                邮箱 (user.email)
              </label>
              <input
                type="email"
                value={config.gitUserEmail}
                onChange={(e) => setConfig({ ...config, gitUserEmail: e.target.value })}
                className="vscode-input w-full"
                placeholder="your@email.com"
              />
            </div>
          </div>
        </div>

        {/* Git 仓库初始化 */}
        {projectPath && gitStatus && !gitStatus.isRepository && (
          <div className="border-t border-vscode-border pt-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <i className="codicon codicon-repo-create" />
              初始化 Git 仓库
            </h3>
            <p className="text-xs text-vscode-foreground-dim mb-3">
              当前项目尚未初始化为 Git 仓库，点击下面的按钮初始化
            </p>
            <button
              onClick={handleInitRepository}
              disabled={isInitializingRepo || !config.gitUserName || !config.gitUserEmail}
              className="vscode-button-secondary flex items-center gap-2"
            >
              <i
                className={`codicon codicon-${isInitializingRepo ? 'loading' : 'repo-create'} ${
                  isInitializingRepo ? 'animate-spin' : ''
                }`}
              />
              {isInitializingRepo ? '初始化中...' : '初始化 Git 仓库'}
            </button>
          </div>
        )}

        {/* 添加远程仓库 */}
        {projectPath && gitStatus && gitStatus.isRepository && !gitStatus.remote && (
          <div className="border-t border-vscode-border pt-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <i className="codicon codicon-remote" />
              添加远程仓库
            </h3>
            <p className="text-xs text-vscode-foreground-dim mb-3">
              当前项目未配置远程仓库，点击下面的按钮添加 origin
            </p>
            <button
              onClick={handleAddRemote}
              disabled={isAddingRemote || !config.repository}
              className="vscode-button-secondary flex items-center gap-2"
            >
              <i
                className={`codicon codicon-${isAddingRemote ? 'loading' : 'remote'} ${
                  isAddingRemote ? 'animate-spin' : ''
                }`}
              />
              {isAddingRemote ? '添加中...' : '添加远程仓库'}
            </button>
          </div>
        )}

        {/* 保存按钮 */}
        <div className="flex gap-2 pt-4 border-t border-vscode-border">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="vscode-button-primary flex items-center gap-2"
          >
            <i className={`codicon codicon-${isSaving ? 'loading' : 'save'} ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? '保存中...' : '保存配置'}
          </button>

          <button
            onClick={loadConfig}
            className="vscode-button-secondary flex items-center gap-2"
          >
            <i className="codicon codicon-refresh" />
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
