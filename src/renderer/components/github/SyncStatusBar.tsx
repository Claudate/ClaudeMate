/**
 * Sync Status Bar Component
 * 显示当前项目的 GitHub 同步状态
 * 按照 react-component.skill.md 规范创建
 */

import { useState, useEffect } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { IPCChannels } from '@shared/types/ipc.types';
import type { GitStatus, GitHubCommitResult } from '@shared/types/domain.types';

interface SyncStatusBarProps {
  projectPath: string;
  sessionId?: string;
}

export function SyncStatusBar({ projectPath, sessionId }: SyncStatusBarProps) {
  const { invoke } = useIPC();

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // 加载 Git 状态
  useEffect(() => {
    loadGitStatus();

    // 监听同步事件
    const api = window.electronAPI;
    if (!api?.on) {
      return;
    }

    const unlistenStart = api.on(IPCChannels.GITHUB_SYNC_STARTED, () => {
      setIsSyncing(true);
      setSyncError(null);
    });

    const unlistenCompleted = api.on(
      IPCChannels.GITHUB_SYNC_COMPLETED,
      (data: any) => {
        setIsSyncing(false);
        setLastSyncTime(Date.now());
        setSyncError(null);
        loadGitStatus();
      }
    );

    const unlistenFailed = api.on(
      IPCChannels.GITHUB_SYNC_FAILED,
      (data: any) => {
        setIsSyncing(false);
        setSyncError(data.error || '同步失败');
      }
    );

    return () => {
      unlistenStart?.();
      unlistenCompleted?.();
      unlistenFailed?.();
    };
  }, [projectPath]);

  const loadGitStatus = async () => {
    try {
      const { status } = await invoke(IPCChannels.GITHUB_GET_GIT_STATUS, {
        projectPath,
      });
      setGitStatus(status);
    } catch (error) {
      console.error('获取 Git 状态失败:', error);
    }
  };

  // 手动同步
  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await invoke<{ projectPath: string }, GitHubCommitResult>(
        IPCChannels.GITHUB_SYNC_MANUAL,
        { projectPath }
      );

      if (result.commitSha) {
        setLastSyncTime(Date.now());
        loadGitStatus();
      }
    } catch (error: any) {
      setSyncError(error.message || '同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  // 计算待同步文件数
  const getPendingChangesCount = () => {
    if (!gitStatus) return 0;
    return (
      (gitStatus.modifiedFiles?.length || 0) + (gitStatus.untrackedFiles?.length || 0)
    );
  };

  // 格式化上次同步时间
  const getLastSyncText = () => {
    if (!lastSyncTime) return '从未同步';

    const now = Date.now();
    const diff = now - lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return '刚刚';
  };

  if (!gitStatus) {
    return null; // 不显示状态栏（项目未配置 Git）
  }

  const pendingCount = getPendingChangesCount();

  return (
    <div className="border-t border-vscode-border bg-vscode-sidebar-bg">
      {/* 主状态栏 */}
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-vscode-hover-bg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* 左侧：Git 状态 */}
        <div className="flex items-center gap-2 flex-1">
          <i
            className={`codicon codicon-${
              isSyncing ? 'sync spinning' : 'git-branch'
            } text-sm ${isSyncing ? 'animate-spin' : ''}`}
          />

          <span className="text-xs">
            {gitStatus.branch || 'unknown'}
          </span>

          {pendingCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-vscode-accent/20 text-vscode-accent rounded">
              {pendingCount} 个变更
            </span>
          )}

          {syncError && (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <i className="codicon codicon-error" />
              同步失败
            </span>
          )}
        </div>

        {/* 右侧：同步按钮 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-vscode-foreground-dim">
            {isSyncing ? '同步中...' : getLastSyncText()}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleManualSync();
            }}
            disabled={isSyncing}
            className="px-2 py-1 text-xs bg-vscode-button-bg hover:bg-vscode-button-hover-bg rounded transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <i
              className={`codicon codicon-${isSyncing ? 'loading' : 'cloud-upload'} ${
                isSyncing ? 'animate-spin' : ''
              }`}
            />
            {isSyncing ? '同步中' : '同步'}
          </button>

          <i
            className={`codicon codicon-chevron-${isExpanded ? 'down' : 'right'} text-xs`}
          />
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="p-3 border-t border-vscode-border bg-vscode-input-bg/30 text-xs space-y-2">
          {/* 仓库信息 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-vscode-foreground-dim">分支:</span>{' '}
              <span>{gitStatus.branch || 'N/A'}</span>
            </div>
            <div>
              <span className="text-vscode-foreground-dim">远程:</span>{' '}
              <span>{gitStatus.remote ? '✅' : '❌'}</span>
            </div>
          </div>

          {/* 文件变更 */}
          {pendingCount > 0 && (
            <div className="space-y-1">
              {gitStatus.modifiedFiles && gitStatus.modifiedFiles.length > 0 && (
                <div>
                  <div className="text-vscode-foreground-dim mb-1">
                    修改文件 ({gitStatus.modifiedFiles.length}):
                  </div>
                  <div className="pl-2 space-y-0.5 max-h-20 overflow-y-auto">
                    {gitStatus.modifiedFiles.slice(0, 5).map((file, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <i className="codicon codicon-diff-modified text-orange-500" />
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                    {gitStatus.modifiedFiles.length > 5 && (
                      <div className="text-vscode-foreground-dim">
                        ... 还有 {gitStatus.modifiedFiles.length - 5} 个文件
                      </div>
                    )}
                  </div>
                </div>
              )}

              {gitStatus.untrackedFiles && gitStatus.untrackedFiles.length > 0 && (
                <div>
                  <div className="text-vscode-foreground-dim mb-1">
                    未跟踪文件 ({gitStatus.untrackedFiles.length}):
                  </div>
                  <div className="pl-2 space-y-0.5 max-h-20 overflow-y-auto">
                    {gitStatus.untrackedFiles.slice(0, 5).map((file, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <i className="codicon codicon-diff-added text-green-500" />
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                    {gitStatus.untrackedFiles.length > 5 && (
                      <div className="text-vscode-foreground-dim">
                        ... 还有 {gitStatus.untrackedFiles.length - 5} 个文件
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {syncError && (
            <div className="p-2 bg-red-500/10 text-red-500 rounded flex items-start gap-2">
              <i className="codicon codicon-error mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">同步失败</div>
                <div className="text-xs opacity-80">{syncError}</div>
              </div>
            </div>
          )}

          {/* 无变更 */}
          {pendingCount === 0 && !syncError && (
            <div className="text-vscode-foreground-dim flex items-center gap-2">
              <i className="codicon codicon-check" />
              <span>工作目录干净，无待同步变更</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
