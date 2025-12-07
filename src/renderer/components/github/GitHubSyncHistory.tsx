/**
 * GitHub Sync History Component
 * 显示 GitHub 同步历史时间线
 * 按照 react-component.skill.md 规范创建
 */

import { useState, useEffect } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { IPCChannels } from '@shared/types/ipc.types';
import type { GitHubSyncHistory } from '@shared/types/domain.types';

interface GitHubSyncHistoryProps {
  projectPath?: string; // 如果提供，只显示该项目的历史
}

export function GitHubSyncHistory({ projectPath }: GitHubSyncHistoryProps) {
  const { invoke } = useIPC();

  const [history, setHistory] = useState<GitHubSyncHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<GitHubSyncHistory | null>(null);

  useEffect(() => {
    loadHistory();

    // 监听同步完成事件，刷新历史
    const unlisten = window.electron.on(IPCChannels.GITHUB_SYNC_COMPLETED, () => {
      loadHistory();
    });

    return () => unlisten();
  }, [projectPath]);

  const loadHistory = async () => {
    setIsLoading(true);

    try {
      let result;

      if (projectPath) {
        result = await invoke(IPCChannels.GITHUB_GET_SYNC_HISTORY_BY_PROJECT, {
          projectPath,
        });
      } else {
        result = await invoke(IPCChannels.GITHUB_GET_SYNC_HISTORY, {});
      }

      setHistory(result.history || []);
    } catch (error) {
      console.error('加载同步历史失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 打开 GitHub commit 页面
  const openCommitUrl = (url: string) => {
    window.electron.invoke(IPCChannels.SHELL_OPEN_URL, { url });
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} 天前`;
    } else if (hours > 0) {
      return `${hours} 小时前`;
    } else if (minutes > 0) {
      return `${minutes} 分钟前`;
    } else {
      return '刚刚';
    }
  };

  // 格式化完整时间
  const formatFullTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取后端类型图标
  const getBackendIcon = (backend: 'api' | 'mcp') => {
    return backend === 'api' ? 'codicon-cloud' : 'codicon-extensions';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-vscode-foreground-dim">
          <i className="codicon codicon-loading animate-spin" />
          <span>加载同步历史...</span>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-vscode-foreground-dim">
        <i className="codicon codicon-history text-4xl mb-3 opacity-50" />
        <p>暂无同步历史</p>
        <p className="text-xs mt-1">开始使用 GitHub 同步功能后，历史记录将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-vscode-border">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <i className="codicon codicon-history" />
            GitHub 同步历史
          </h2>
          <p className="text-xs text-vscode-foreground-dim mt-1">
            {projectPath ? '当前项目的同步记录' : '所有项目的同步记录'} - 共 {history.length} 条
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="vscode-button-secondary flex items-center gap-1"
        >
          <i className="codicon codicon-refresh" />
          刷新
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {history.map((item, index) => (
            <div
              key={item.commitSha}
              className={`relative pl-8 pb-6 ${
                index !== history.length - 1 ? 'border-l-2 border-vscode-border' : ''
              }`}
            >
              {/* 时间线圆点 */}
              <div className="absolute left-0 top-0 -ml-[9px] w-4 h-4 rounded-full bg-vscode-accent border-2 border-vscode-sidebar-bg" />

              {/* Card */}
              <div
                className={`vscode-panel p-4 cursor-pointer transition-all ${
                  selectedCommit?.commitSha === item.commitSha
                    ? 'ring-2 ring-vscode-accent'
                    : ''
                }`}
                onClick={() =>
                  setSelectedCommit(
                    selectedCommit?.commitSha === item.commitSha ? null : item
                  )
                }
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <i className={`codicon ${getBackendIcon(item.backend)} text-sm`} />
                      <span className="font-mono text-xs text-vscode-foreground-dim">
                        {item.commitSha.substring(0, 7)}
                      </span>
                      <span className="text-xs text-vscode-foreground-dim">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>

                    <div className="font-medium">{item.message}</div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-vscode-foreground-dim">
                      <span className="flex items-center gap-1">
                        <i className="codicon codicon-file" />
                        {item.filesChanged} 个文件
                      </span>

                      {item.sessionIds && item.sessionIds.length > 0 && (
                        <span className="flex items-center gap-1">
                          <i className="codicon codicon-comment-discussion" />
                          {item.sessionIds.length} 个会话
                        </span>
                      )}

                      <span>{formatFullTime(item.timestamp)}</span>
                    </div>
                  </div>

                  {item.commitUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCommitUrl(item.commitUrl!);
                      }}
                      className="vscode-button-secondary flex items-center gap-1 text-xs"
                    >
                      <i className="codicon codicon-github" />
                      查看 Commit
                    </button>
                  )}
                </div>

                {/* 展开详情 */}
                {selectedCommit?.commitSha === item.commitSha && (
                  <div className="mt-4 pt-4 border-t border-vscode-border space-y-3">
                    {/* 项目路径 */}
                    <div>
                      <div className="text-xs text-vscode-foreground-dim mb-1">
                        项目路径:
                      </div>
                      <code className="text-xs px-2 py-1 bg-vscode-input-bg rounded">
                        {item.projectPath}
                      </code>
                    </div>

                    {/* Commit SHA */}
                    <div>
                      <div className="text-xs text-vscode-foreground-dim mb-1">
                        Commit SHA:
                      </div>
                      <code className="text-xs px-2 py-1 bg-vscode-input-bg rounded font-mono">
                        {item.commitSha}
                      </code>
                    </div>

                    {/* 关联会话 */}
                    {item.sessionIds && item.sessionIds.length > 0 && (
                      <div>
                        <div className="text-xs text-vscode-foreground-dim mb-1">
                          关联会话 ({item.sessionIds.length}):
                        </div>
                        <div className="space-y-1">
                          {item.sessionIds.map((sessionId) => (
                            <div
                              key={sessionId}
                              className="text-xs px-2 py-1 bg-vscode-input-bg rounded font-mono flex items-center gap-2"
                            >
                              <i className="codicon codicon-comment-discussion" />
                              {sessionId}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 后端类型 */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-vscode-foreground-dim">同步方式:</span>
                      <span className="px-2 py-0.5 bg-vscode-accent/20 text-vscode-accent rounded">
                        {item.backend === 'api' ? 'GitHub API' : 'MCP'}
                      </span>
                    </div>

                    {/* Commit URL */}
                    {item.commitUrl && (
                      <div>
                        <div className="text-xs text-vscode-foreground-dim mb-1">
                          Commit URL:
                        </div>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openCommitUrl(item.commitUrl!);
                          }}
                          className="text-xs text-vscode-accent hover:underline break-all"
                        >
                          {item.commitUrl}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
