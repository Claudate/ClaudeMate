/**
 * Authentication Welcome Component
 * Guides first-time users through Claude subscription authentication
 */

import { useState } from 'react';

interface AuthWelcomeProps {
  onLoginClick: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export function AuthWelcome({ onLoginClick, onSkip, isLoading = false }: AuthWelcomeProps) {
  const [isChecking, setIsChecking] = useState(false);

  const handleLogin = async () => {
    setIsChecking(true);
    try {
      await onLoginClick();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-vscode-editor-bg flex items-center justify-center z-50">
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-vscode-accent/10 rounded-full mb-4">
            <i className="codicon codicon-key text-vscode-accent text-5xl" />
          </div>
          <h1 className="text-3xl font-bold mb-2">欢迎使用 ClaudeMate</h1>
          <p className="text-vscode-foreground-dim text-lg">
            开始之前,请先完成 Claude 订阅认证
          </p>
        </div>

        {/* 付费方式说明 */}
        <div className="vscode-panel p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="codicon codicon-credit-card text-vscode-accent" />
            Claude 付费方式
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* 订阅付费 */}
            <div className="border border-vscode-border rounded-lg p-4 bg-vscode-input-bg/30">
              <div className="flex items-center gap-2 mb-3">
                <i className="codicon codicon-package text-lg text-blue-400" />
                <h3 className="font-semibold text-blue-400">订阅付费</h3>
              </div>
              <ul className="space-y-2 text-sm text-vscode-foreground-dim">
                <li className="flex items-start gap-2">
                  <i className="codicon codicon-check text-green-400 mt-0.5" />
                  <span>Claude Pro 或 Team 订阅</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="codicon codicon-check text-green-400 mt-0.5" />
                  <span>固定月费，使用量无限</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="codicon codicon-check text-green-400 mt-0.5" />
                  <span>适合日常高频使用</span>
                </li>
              </ul>
            </div>

            {/* API付费 */}
            <div className="border border-vscode-border rounded-lg p-4 bg-vscode-input-bg/30">
              <div className="flex items-center gap-2 mb-3">
                <i className="codicon codicon-symbol-method text-lg text-purple-400" />
                <h3 className="font-semibold text-purple-400">API 付费</h3>
              </div>
              <ul className="space-y-2 text-sm text-vscode-foreground-dim">
                <li className="flex items-start gap-2">
                  <i className="codicon codicon-check text-green-400 mt-0.5" />
                  <span>Anthropic API Key</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="codicon codicon-check text-green-400 mt-0.5" />
                  <span>按使用量计费(Token)</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="codicon codicon-check text-green-400 mt-0.5" />
                  <span>适合间歇性使用</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 系统权限说明 */}
        <div className="vscode-panel p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="codicon codicon-shield text-vscode-accent" />
            系统操作权限
          </h2>
          <div className="space-y-3 text-sm text-vscode-foreground-dim">
            <div className="flex items-start gap-3">
              <i className="codicon codicon-file-code text-blue-400 mt-0.5" />
              <span><strong className="text-vscode-foreground">读取权限:</strong> 查看项目文件内容</span>
            </div>
            <div className="flex items-start gap-3">
              <i className="codicon codicon-edit text-yellow-400 mt-0.5" />
              <span><strong className="text-vscode-foreground">写入权限:</strong> 创建和修改文件</span>
            </div>
            <div className="flex items-start gap-3">
              <i className="codicon codicon-trash text-red-400 mt-0.5" />
              <span><strong className="text-vscode-foreground">删除权限:</strong> 删除文件和文件夹</span>
            </div>
            <div className="mt-3 p-3 bg-yellow-500/10 border-l-4 border-yellow-500 rounded">
              <p className="text-yellow-200 text-xs">
                <i className="codicon codicon-warning mr-1" />
                所有操作都需要您的明确授权，软件会在执行前弹窗确认
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="vscode-panel p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="codicon codicon-list-ordered text-vscode-accent" />
            认证步骤
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-vscode-accent/20 rounded-full flex items-center justify-center text-vscode-accent font-semibold">
                1
              </div>
              <div>
                <div className="font-medium">点击"开始认证"按钮</div>
                <div className="text-sm text-vscode-foreground-dim">启动 Claude CLI 认证流程</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-vscode-accent/20 rounded-full flex items-center justify-center text-vscode-accent font-semibold">
                2
              </div>
              <div>
                <div className="font-medium">在浏览器中登录</div>
                <div className="text-sm text-vscode-foreground-dim">使用您的 Claude 账户完成 OAuth 授权</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-vscode-accent/20 rounded-full flex items-center justify-center text-vscode-accent font-semibold">
                3
              </div>
              <div>
                <div className="font-medium">返回应用</div>
                <div className="text-sm text-vscode-foreground-dim">认证完成后自动返回,开始使用</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleLogin}
            disabled={isChecking || isLoading}
            className="flex-1 vscode-button-primary flex items-center justify-center gap-2 py-3 text-base font-medium disabled:opacity-50"
          >
            {isChecking || isLoading ? (
              <>
                <i className="codicon codicon-loading animate-spin" />
                认证中...
              </>
            ) : (
              <>
                <i className="codicon codicon-key" />
                开始认证
              </>
            )}
          </button>

          {onSkip && (
            <button
              onClick={onSkip}
              disabled={isChecking || isLoading}
              className="vscode-button-secondary px-6 py-3 disabled:opacity-50"
            >
              稍后再说
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-vscode-foreground-dim">
          <p className="mb-2">还没有 Claude 订阅?</p>
          <a
            href="https://claude.ai/upgrade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-vscode-accent hover:underline inline-flex items-center gap-1"
          >
            <i className="codicon codicon-link-external" />
            前往 claude.ai 订阅
          </a>
        </div>
      </div>
    </div>
  );
}
