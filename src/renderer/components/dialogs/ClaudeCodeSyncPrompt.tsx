/**
 * Claude Code Sync Prompt Dialog
 * 首次运行时询问用户是否导入 Claude Code 的聊天历史
 */

import { useState } from 'react';

interface ClaudeCodeSyncPromptProps {
  onSync: () => void;
  onSkip: () => void;
  claudeCodeData: {
    totalProjects: number;
    totalSessions: number;
  };
}

export function ClaudeCodeSyncPrompt({ onSync, onSkip, claudeCodeData }: ClaudeCodeSyncPromptProps) {
  const [isImporting, setIsImporting] = useState(false);

  // 检测操作系统平台（渲染进程安全方式）
  const isWindows = window.navigator.userAgent.includes('Windows');

  const handleSync = async () => {
    setIsImporting(true);
    try {
      await onSync();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-vscode-editor-bg flex items-center justify-center z-50">
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-vscode-accent/10 rounded-full mb-4">
            <i className="codicon codicon-cloud-download text-vscode-accent text-5xl" />
          </div>
          <h1 className="text-3xl font-bold mb-2">发现 Claude Code 聊天历史</h1>
          <p className="text-vscode-foreground-dim text-lg">
            检测到您使用过 Claude Code CLI，是否导入历史记录？
          </p>
        </div>

        {/* 数据统计 */}
        <div className="vscode-panel p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="codicon codicon-database text-vscode-accent" />
            检测到的数据
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-vscode-input-bg/30 border border-vscode-border rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400">{claudeCodeData.totalProjects}</div>
              <div className="text-sm text-vscode-foreground-dim mt-1">个项目</div>
            </div>
            <div className="bg-vscode-input-bg/30 border border-vscode-border rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{claudeCodeData.totalSessions}</div>
              <div className="text-sm text-vscode-foreground-dim mt-1">个会话</div>
            </div>
          </div>
        </div>

        {/* 同步说明 */}
        <div className="vscode-panel p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="codicon codicon-info text-vscode-accent" />
            导入说明
          </h2>
          <ul className="space-y-3 text-sm text-vscode-foreground-dim">
            <li className="flex items-start gap-3">
              <i className="codicon codicon-check text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-vscode-foreground">智能合并:</strong>
                相同项目路径的会话将自动合并
              </span>
            </li>
            <li className="flex items-start gap-3">
              <i className="codicon codicon-check text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-vscode-foreground">去重处理:</strong>
                已存在的会话将被跳过，不会重复导入
              </span>
            </li>
            <li className="flex items-start gap-3">
              <i className="codicon codicon-check text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-vscode-foreground">保留原始数据:</strong>
                不会删除或修改 Claude Code 的原始数据
              </span>
            </li>
            <li className="flex items-start gap-3">
              <i className="codicon codicon-check text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-vscode-foreground">即时可用:</strong>
                导入后可在 ChatHistory 模块中查看和搜索
              </span>
            </li>
          </ul>
        </div>

        {/* 导入位置说明 */}
        <div className="bg-blue-500/10 border-l-4 border-blue-500 rounded p-4 mb-6">
          <div className="flex items-start gap-3">
            <i className="codicon codicon-folder text-blue-400 mt-0.5 text-lg" />
            <div className="text-sm">
              <div className="font-medium text-blue-200 mb-1">数据位置</div>
              <div className="text-blue-100/80">
                <code className="bg-blue-500/20 px-2 py-0.5 rounded text-xs">
                  {isWindows ? 'C:\\Users\\{用户名}\\.claude\\projects\\' : '~/.claude/projects/'}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleSync}
            disabled={isImporting}
            className="flex-1 vscode-button-primary flex items-center justify-center gap-2 py-3 text-base font-medium disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <i className="codicon codicon-loading animate-spin" />
                导入中... ({claudeCodeData.totalSessions} 个会话)
              </>
            ) : (
              <>
                <i className="codicon codicon-cloud-download" />
                立即导入
              </>
            )}
          </button>

          <button
            onClick={onSkip}
            disabled={isImporting}
            className="vscode-button-secondary px-6 py-3 disabled:opacity-50"
          >
            稍后再说
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-vscode-foreground-dim">
          <p className="mb-2">您可以随时在设置中手动导入历史记录</p>
          <p className="text-xs text-vscode-foreground-dim/60">
            提示：如果项目路径完全相同，会话将自动合并到现有项目中
          </p>
        </div>
      </div>
    </div>
  );
}
