/**
 * Permission Dialog Component
 * 授权请求对话框 - 用于手动授权模式
 */

import { useEffect, useState } from 'react';
import { ToolPermissionRequest } from '@shared/types/domain.types';
import { IPCChannels } from '@shared/types/ipc.types';

interface PermissionDialogProps {
  request: ToolPermissionRequest | null;
  onResponse: (approved: boolean) => void;
}

export function PermissionDialog({ request, onResponse }: PermissionDialogProps) {
  const [remember, setRemember] = useState(false);

  if (!request) return null;

  const handleApprove = () => {
    onResponse(true);
  };

  const handleDeny = () => {
    onResponse(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-vscode-editor-bg border border-vscode-border rounded-lg shadow-2xl w-[500px] max-w-[90vw]">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-vscode-border bg-vscode-titlebar-bg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <i className="codicon codicon-shield text-2xl text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">授权请求</h2>
              <p className="text-xs text-vscode-foreground-dim">Claude 需要执行操作的权限</p>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6 space-y-4">
          {/* 工具名称 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-vscode-foreground-dim">工具:</span>
            <span className="px-2 py-1 bg-vscode-input-bg rounded text-sm font-mono">
              {request.toolName}
            </span>
          </div>

          {/* 操作描述 */}
          <div className="space-y-2">
            <div className="text-sm text-vscode-foreground-dim">操作描述:</div>
            <div className="p-4 bg-vscode-input-bg rounded-lg">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                {request.action}
              </pre>
            </div>
          </div>

          {/* 参数 (如果有) */}
          {request.parameters && Object.keys(request.parameters).length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-vscode-foreground-dim">参数:</div>
              <div className="p-4 bg-vscode-input-bg rounded-lg">
                <pre className="text-xs whitespace-pre-wrap break-words font-mono text-vscode-foreground-dim">
                  {JSON.stringify(request.parameters, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* 记住选择 */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-vscode-border bg-vscode-input-bg"
            />
            <label htmlFor="remember" className="text-sm text-vscode-foreground-dim cursor-pointer">
              记住此选择（本次会话）
            </label>
          </div>
        </div>

        {/* 按钮区域 */}
        <div className="px-6 py-4 border-t border-vscode-border bg-vscode-sidebar-bg flex items-center justify-end gap-3">
          <button
            onClick={handleDeny}
            className="px-4 py-2 text-sm rounded bg-vscode-input-bg hover:bg-vscode-input-bg/80 transition-colors"
          >
            <i className="codicon codicon-close mr-2" />
            拒绝
          </button>
          <button
            onClick={handleApprove}
            className="px-4 py-2 text-sm rounded bg-vscode-accent hover:bg-vscode-accent/90 text-white transition-colors"
          >
            <i className="codicon codicon-check mr-2" />
            允许
          </button>
        </div>
      </div>
    </div>
  );
}
