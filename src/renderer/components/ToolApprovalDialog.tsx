/**
 * Tool Approval Dialog
 * 工具使用授权对话框（参照 WPF 的 FilePermissionDialog）
 */

import { useState } from 'react';
import {
  ToolApprovalRequest,
  ToolApprovalStats,
  getToolApprovalMessage,
  getToolIcon,
  getToolDisplayName,
} from '../services/toolApprovalService';

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  stats: ToolApprovalStats;
  onApprove: (rememberChoice: boolean) => void;
  onDeny: (rememberChoice: boolean) => void;
  onClose: () => void;
}

export function ToolApprovalDialog({ request, stats, onApprove, onDeny, onClose }: ToolApprovalDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleApprove = () => {
    onApprove(rememberChoice);
  };

  const handleDeny = () => {
    onDeny(rememberChoice);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onDeny(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-vscode-sidebar-bg border border-vscode-border rounded-lg shadow-xl max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-vscode-border">
          <div className="flex items-center gap-3">
            <i className={`codicon ${getToolIcon(request.toolName)} text-yellow-400 text-xl`} />
            <div>
              <h2 className="text-base font-semibold">工具使用授权</h2>
              <p className="text-xs text-vscode-foreground-dim">{getToolDisplayName(request.toolName)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-vscode-selection-bg/20 rounded transition-colors"
            title="关闭 (ESC)"
          >
            <i className="codicon codicon-close text-sm" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 操作描述 */}
          <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 rounded">
            <p className="text-sm text-yellow-200 whitespace-pre-wrap">
              {getToolApprovalMessage(request)}
            </p>
          </div>

          {/* Claude 的消息 */}
          {request.message && (
            <div className="bg-vscode-input-bg p-3 rounded">
              <p className="text-xs text-vscode-foreground-dim mb-1">Claude 说：</p>
              <p className="text-sm text-vscode-foreground whitespace-pre-wrap">{request.message}</p>
            </div>
          )}

          {/* 详细信息 */}
          <div className="space-y-2">
            {/* 文件路径 */}
            {request.filePath && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-vscode-foreground-dim min-w-16">文件路径:</span>
                <span className="text-xs text-vscode-foreground font-mono flex-1 break-all">
                  {request.filePath}
                </span>
              </div>
            )}

            {/* 命令 */}
            {request.command && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-vscode-foreground-dim min-w-16">命令:</span>
                <span className="text-xs text-vscode-foreground font-mono flex-1 break-all bg-vscode-input-bg px-2 py-1 rounded">
                  {request.command}
                </span>
              </div>
            )}

            {/* 搜索模式 */}
            {request.pattern && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-vscode-foreground-dim min-w-16">搜索模式:</span>
                <span className="text-xs text-vscode-foreground font-mono flex-1 break-all">
                  {request.pattern}
                </span>
              </div>
            )}

            {/* URL */}
            {request.url && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-vscode-foreground-dim min-w-16">URL:</span>
                <span className="text-xs text-blue-400 font-mono flex-1 break-all">
                  {request.url}
                </span>
              </div>
            )}

            {/* 内容预览（如果是写入操作）*/}
            {request.content && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-vscode-foreground-dim">内容预览:</span>
                <div className="bg-vscode-input-bg p-2 rounded max-h-32 overflow-y-auto">
                  <pre className="text-xs text-vscode-foreground font-mono whitespace-pre-wrap break-words">
                    {request.content.length > 500
                      ? request.content.substring(0, 500) + '\n... (内容过长，已截断)'
                      : request.content}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* 统计信息（参照 WPF 的 StatsTextBlock）*/}
          <div className="flex items-center gap-2 text-xs text-vscode-foreground-dim bg-vscode-input-bg p-2 rounded">
            <i className="codicon codicon-info" />
            <span>
              本次会话: 已批准 <span className="text-green-400">{stats.approvedCount}</span> 个, 已拒绝{' '}
              <span className="text-red-400">{stats.deniedCount}</span> 个
            </span>
          </div>

          {/* 记住选择选项（参照 WPF 的 RememberChoiceCheckBox）*/}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberChoice"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="w-4 h-4 rounded border-vscode-input-border bg-vscode-input-bg"
            />
            <label htmlFor="rememberChoice" className="text-sm text-vscode-foreground cursor-pointer">
              记住我的选择（仅限本次会话）
            </label>
          </div>
        </div>

        {/* Footer - 操作按钮 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-vscode-border">
          <button
            onClick={handleDeny}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-sm font-medium transition-colors flex items-center gap-2"
          >
            <i className="codicon codicon-close" />
            <span>拒绝</span>
          </button>
          <button
            onClick={handleApprove}
            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-sm font-medium transition-colors flex items-center gap-2"
            autoFocus
          >
            <i className="codicon codicon-check" />
            <span>批准</span>
          </button>
        </div>
      </div>
    </div>
  );
}
