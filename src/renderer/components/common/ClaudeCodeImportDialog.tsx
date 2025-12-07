/**
 * Claude Code Import Dialog Component
 * 在用户首次访问History页面时提示导入Claude CLI的聊天记录
 */

import { useState, useEffect } from 'react';
import { IPCChannels } from '@shared/types/ipc.types';

interface ImportPreviewProject {
  name: string;
  path: string;
  sessionCount: number;
  totalMessages: number;
  sessions: Array<{
    title: string;
    messageCount: number;
    createdAt: number;
  }>;
}

interface ClaudeCodeImportDialogProps {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ClaudeCodeImportDialog({
  isOpen,
  onConfirm,
  onCancel,
}: ClaudeCodeImportDialogProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [previewData, setPreviewData] = useState<ImportPreviewProject[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      detectClaudeCodeData();
    }
  }, [isOpen]);

  /**
   * 检测Claude Code数据
   */
  const detectClaudeCodeData = async () => {
    setIsDetecting(true);
    try {
      const result = await window.electronAPI.invoke(IPCChannels.CLAUDE_CODE_DETECT);

      if (result.exists && result.totalSessions > 0) {
        setHasData(true);
        setTotalSessions(result.totalSessions);
        setTotalProjects(result.projects.length);

        // 获取预览数据
        const preview = await window.electronAPI.invoke(IPCChannels.CLAUDE_CODE_PREVIEW);
        setPreviewData(preview.projects || []);
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('检测Claude Code数据失败:', error);
      setHasData(false);
    } finally {
      setIsDetecting(false);
    }
  };

  /**
   * 开始导入
   */
  const handleImport = async () => {
    setIsImporting(true);

    try {
      // 监听导入进度
      const progressHandler = (progress: any) => {
        setImportProgress(progress);
      };

      window.electronAPI.on(IPCChannels.CLAUDE_CODE_IMPORT_PROGRESS, progressHandler);

      // 执行导入
      await onConfirm();

      // 取消监听
      window.electronAPI.off(IPCChannels.CLAUDE_CODE_IMPORT_PROGRESS, progressHandler);

    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleSkip = () => {
    // 标记为已提示,下次不再显示
    localStorage.setItem('claudeCodeImportPrompted', 'true');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isImporting && handleSkip()}
    >
      <div
        className="bg-vscode-sidebar-bg border border-vscode-border rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-vscode-border">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📥</div>
            <div>
              <h3 className="text-lg font-semibold text-vscode-foreground">
                发现 Claude CLI 聊天记录
              </h3>
              <p className="text-sm text-vscode-descriptionForeground mt-1">
                检测到您的系统中有Claude Code的历史对话,是否导入到ClaudeMate?
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isDetecting ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vscode-button-background"></div>
              <span className="ml-3 text-vscode-descriptionForeground">正在检测数据...</span>
            </div>
          ) : !hasData ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">ℹ️</div>
              <p className="text-vscode-descriptionForeground">
                未检测到Claude Code数据
              </p>
              <p className="text-sm text-vscode-descriptionForeground mt-2">
                Claude Code数据位置: <code className="text-xs bg-vscode-input-bg px-2 py-1 rounded">~/.claude/projects/</code>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 统计信息 */}
              <div className="bg-vscode-input-bg border border-vscode-border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-vscode-button-background">{totalProjects}</div>
                    <div className="text-sm text-vscode-descriptionForeground">个项目</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-vscode-button-background">{totalSessions}</div>
                    <div className="text-sm text-vscode-descriptionForeground">个会话</div>
                  </div>
                </div>
              </div>

              {/* 项目列表预览 */}
              {previewData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-vscode-foreground mb-2">
                    项目预览 (前{Math.min(5, previewData.length)}个):
                  </h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {previewData.slice(0, 5).map((project, index) => (
                      <div
                        key={index}
                        className="bg-vscode-input-bg border border-vscode-border rounded p-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">📁</span>
                          <span className="font-medium text-vscode-foreground">{project.name}</span>
                        </div>
                        <div className="ml-6 mt-1 text-xs text-vscode-descriptionForeground">
                          <div>{project.sessionCount} 个会话 · {project.totalMessages} 条消息</div>
                          <div className="text-xs opacity-60 mt-0.5">{project.path}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {previewData.length > 5 && (
                    <div className="text-xs text-vscode-descriptionForeground text-center mt-2">
                      还有 {previewData.length - 5} 个项目...
                    </div>
                  )}
                </div>
              )}

              {/* 导入进度 */}
              {isImporting && importProgress && (
                <div className="bg-vscode-input-bg border border-vscode-border rounded-lg p-4">
                  <div className="text-sm text-vscode-foreground mb-2">
                    正在导入: {importProgress.currentProject}
                  </div>
                  <div className="w-full bg-vscode-editor-bg rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-vscode-button-background h-full transition-all duration-300"
                      style={{
                        width: `${(importProgress.currentSession / importProgress.totalSessions) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-vscode-descriptionForeground mt-2">
                    {importProgress.currentSession} / {importProgress.totalSessions} 个会话
                    {' · '}
                    成功 {importProgress.importedSessions}
                    {' · '}
                    跳过 {importProgress.skippedSessions}
                    {importProgress.failedSessions > 0 && (
                      <span className="text-red-400"> · 失败 {importProgress.failedSessions}</span>
                    )}
                  </div>
                </div>
              )}

              {/* 说明 */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-xs text-vscode-descriptionForeground">
                <div className="font-medium mb-1">💡 导入说明:</div>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>系统会自动检测并跳过已存在的会话</li>
                  <li>导入过程不会影响您现有的数据</li>
                  <li>支持中文项目名和路径</li>
                  <li>会保留原始的时间戳、模型信息和CLI版本</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-vscode-border flex justify-end gap-3">
          <button
            onClick={handleSkip}
            className="vscode-button-secondary px-4 py-2"
            disabled={isImporting}
          >
            {hasData ? '暂不导入' : '关闭'}
          </button>
          {hasData && (
            <button
              onClick={handleImport}
              className="vscode-button-primary px-4 py-2 flex items-center gap-2"
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>导入中...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>开始导入</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
