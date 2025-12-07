/**
 * Sensitive Files Warning Dialog
 * 警告用户即将提交敏感文件
 * 按照 react-component.skill.md 规范创建
 */

import { useState } from 'react';

interface SensitiveFilesWarningProps {
  isOpen: boolean;
  sensitiveFiles: string[];
  onConfirm: (ignoredFiles: string[]) => void;
  onCancel: () => void;
}

export function SensitiveFilesWarning({
  isOpen,
  sensitiveFiles,
  onConfirm,
  onCancel,
}: SensitiveFilesWarningProps) {
  const [ignoredFiles, setIgnoredFiles] = useState<Set<string>>(new Set());

  const toggleIgnore = (file: string) => {
    const newIgnored = new Set(ignoredFiles);
    if (newIgnored.has(file)) {
      newIgnored.delete(file);
    } else {
      newIgnored.add(file);
    }
    setIgnoredFiles(newIgnored);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(ignoredFiles));
    setIgnoredFiles(new Set());
  };

  const handleCancel = () => {
    onCancel();
    setIgnoredFiles(new Set());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={handleCancel}
    >
      <div
        className="bg-vscode-sidebar-bg border border-red-500/50 rounded shadow-2xl w-[600px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-vscode-border bg-red-500/10">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20">
            <i className="codicon codicon-warning text-red-500 text-2xl" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-500">
              检测到敏感文件
            </h3>
            <p className="text-xs text-vscode-foreground-dim mt-1">
              以下文件可能包含密钥、密码或其他敏感信息
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {/* 警告说明 */}
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded">
              <div className="flex items-start gap-2">
                <i className="codicon codicon-info text-red-500 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-red-500 mb-1">为什么这很重要？</p>
                  <ul className="text-xs text-vscode-foreground-dim space-y-1 list-disc list-inside">
                    <li>将敏感信息提交到公开仓库可能导致安全风险</li>
                    <li>API 密钥、密码、私钥等可能被恶意使用</li>
                    <li>一旦提交到 GitHub，即使删除也会留在 Git 历史中</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 敏感文件列表 */}
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <i className="codicon codicon-file-binary" />
                检测到的敏感文件 ({sensitiveFiles.length}):
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sensitiveFiles.map((file) => (
                  <div
                    key={file}
                    className="p-2 bg-vscode-input-bg rounded hover:bg-vscode-hover-bg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <i className="codicon codicon-file text-red-500" />
                      <code className="flex-1 text-sm font-mono">{file}</code>

                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={ignoredFiles.has(file)}
                          onChange={() => toggleIgnore(file)}
                          className="form-checkbox h-4 w-4 text-vscode-accent rounded border-vscode-border"
                        />
                        <span className="text-vscode-foreground-dim">
                          不再提示此文件
                        </span>
                      </label>
                    </div>

                    {/* 文件类型提示 */}
                    <div className="mt-1 ml-6 text-xs text-vscode-foreground-dim">
                      {getFileTypeHint(file)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 建议操作 */}
            <div className="p-3 bg-vscode-accent/10 border border-vscode-accent/20 rounded">
              <div className="flex items-start gap-2">
                <i className="codicon codicon-lightbulb text-vscode-accent mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-vscode-accent mb-1">建议操作:</p>
                  <ul className="text-xs text-vscode-foreground-dim space-y-1 list-disc list-inside">
                    <li>将敏感文件添加到 <code className="px-1 bg-vscode-input-bg rounded">.gitignore</code></li>
                    <li>使用环境变量或配置管理工具存储敏感信息</li>
                    <li>检查文件内容，确认没有硬编码的密钥</li>
                    <li>考虑使用 <code className="px-1 bg-vscode-input-bg rounded">.env.example</code> 模板文件</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-vscode-border bg-vscode-input-bg/30">
          <div className="text-xs text-vscode-foreground-dim">
            {ignoredFiles.size > 0 && (
              <span>
                已选择 {ignoredFiles.size} 个文件不再提示
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="vscode-button-secondary flex items-center gap-1"
            >
              <i className="codicon codicon-close" />
              取消同步
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded transition-colors flex items-center gap-1"
            >
              <i className="codicon codicon-warning" />
              仍然继续同步
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 获取文件类型提示
function getFileTypeHint(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.match(/\.env/i)) {
    return '环境变量文件 - 通常包含 API 密钥、数据库凭证等';
  }
  if (lower.includes('credential') || lower.includes('secret')) {
    return '凭证文件 - 包含敏感认证信息';
  }
  if (lower.match(/\.(pem|key|p12|pfx)$/i)) {
    return '私钥文件 - 用于加密和认证的密钥';
  }
  if (lower.includes('id_rsa') || lower.includes('id_ed25519')) {
    return 'SSH 私钥 - 用于远程服务器访问';
  }
  if (lower.includes('config') && lower.includes('.git')) {
    return 'Git 配置文件 - 可能包含敏感的仓库信息';
  }
  if (lower.match(/\.(cer|crt)$/i)) {
    return '证书文件 - SSL/TLS 证书';
  }

  return '可能包含敏感信息的文件';
}
