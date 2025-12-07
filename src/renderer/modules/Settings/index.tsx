/**
 * Settings Module
 * VSCode-style settings with left sidebar navigation
 */

import { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';
import { useFileExplorerStore } from '../../stores/fileExplorerStore';
import { GitHubSyncSettings } from './GitHubSyncSettings';

type SettingCategory = 'appearance' | 'claude-api' | 'application' | 'github-sync' | 'data-management' | 'keyboard' | 'about';

export default function Settings() {
  const { theme, setTheme } = useThemeStore();
  const { permissionMode, setPermissionMode } = useChatStore();
  const { currentProject } = useProjectStore();
  const { showHiddenFiles, setShowHiddenFiles } = useFileExplorerStore();
  const [selectedCategory, setSelectedCategory] = useState<SettingCategory>('appearance');
  const [apiKey, setApiKey] = useState('sk-ant-api03-••••••••••••••••');
  const [model, setModel] = useState('claude-3-sonnet');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [telemetry, setTelemetry] = useState(false);

  const categories = [
    { id: 'appearance' as const, label: '外观', icon: 'symbol-color' },
    { id: 'claude-api' as const, label: 'Claude API', icon: 'key' },
    { id: 'application' as const, label: '应用程序', icon: 'gear' },
    { id: 'github-sync' as const, label: 'GitHub 同步', icon: 'github' },
    { id: 'data-management' as const, label: '数据管理', icon: 'database' },
    { id: 'keyboard' as const, label: '键盘快捷键', icon: 'keyboard' },
    { id: 'about' as const, label: '关于', icon: 'info' },
  ];

  return (
    <div className="h-full flex bg-vscode-editor-bg">
      {/* Left Sidebar - Category Navigation */}
      <div className="w-64 bg-vscode-sidebar-bg border-r border-vscode-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-vscode-border">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <i className="codicon codicon-settings-gear text-vscode-accent" />
            设置
          </h1>
          <p className="text-xs text-vscode-foreground-dim mt-1">
            配置您的应用程序
          </p>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                selectedCategory === category.id
                  ? 'bg-vscode-selection-bg text-vscode-foreground'
                  : 'text-vscode-foreground-dim hover:bg-vscode-selection-bg/20 hover:text-vscode-foreground'
              }`}
            >
              <i className={`codicon codicon-${category.icon} text-sm`} />
              <span className="text-sm">{category.label}</span>
            </button>
          ))}
        </div>

        {/* Reset Button */}
        <div className="p-4 border-t border-vscode-border">
          <button className="w-full px-3 py-2 text-sm bg-vscode-input-bg hover:bg-vscode-input-border rounded transition-colors border border-vscode-border flex items-center justify-center gap-2">
            <i className="codicon codicon-sync" />
            重置为默认值
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Appearance Settings */}
          {selectedCategory === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">外观</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  自定义应用程序的外观和主题
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">主题</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                    className="vscode-input w-full max-w-md"
                  >
                    <option value="light">浅色主题</option>
                    <option value="dark">深色主题</option>
                    <option value="auto">自动 (跟随系统)</option>
                  </select>
                  <p className="text-xs text-vscode-foreground-dim mt-2">
                    选择您偏好的颜色主题
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Claude API Settings */}
          {selectedCategory === 'claude-api' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Claude API 配置</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  配置您的 Anthropic API 密钥和模型设置
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">API 密钥</label>
                  <div className="flex gap-2 max-w-md">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="vscode-input flex-1"
                      placeholder="sk-ant-api03-..."
                    />
                    <button className="vscode-button-secondary flex items-center gap-1">
                      <i className="codicon codicon-eye" />
                      显示
                    </button>
                  </div>
                  <p className="text-xs text-vscode-foreground-dim mt-2">
                    您的 Anthropic API 密钥
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">模型</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="vscode-input w-full max-w-md"
                  >
                    <option value="claude-3-opus">Claude 3 Opus (最强大)</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet (平衡)</option>
                    <option value="claude-3-haiku">Claude 3 Haiku (快速)</option>
                    <option value="claude-2">Claude 2</option>
                  </select>
                  <p className="text-xs text-vscode-foreground-dim mt-2">
                    选择要使用的 Claude 模型
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    最大 Token 数: {maxTokens.toLocaleString()}
                  </label>
                  <input
                    type="range"
                    min="1024"
                    max="8192"
                    step="512"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full max-w-md"
                  />
                  <p className="text-xs text-vscode-foreground-dim mt-2">
                    生成响应的最大 token 数量
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    温度: {temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full max-w-md"
                  />
                  <p className="text-xs text-vscode-foreground-dim mt-2">
                    控制随机性。数值越高 = 越有创意
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Application Settings */}
          {selectedCategory === 'application' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">应用程序设置</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  配置应用程序行为和权限
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <i className="codicon codicon-shield" />
                    授权模式
                  </label>
                  <select
                    value={permissionMode}
                    onChange={(e) => setPermissionMode(e.target.value as 'manual' | 'auto')}
                    className="vscode-input w-full max-w-md"
                  >
                    <option value="manual">手动授权 - 需要用户手动批准每个工具使用</option>
                    <option value="auto">自动授权 - 自动批准所有工具使用</option>
                  </select>
                  <p className="text-xs text-vscode-foreground-dim mt-2">
                    {permissionMode === 'manual'
                      ? '⚠️ 手动模式：Claude CLI 使用工具时会弹出授权对话框'
                      : '✅ 自动模式：Claude CLI 使用工具时自动批准，无需用户干预'}
                  </p>
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <div className="flex-1">
                    <div className="text-sm font-medium">自动保存对话</div>
                    <p className="text-xs text-vscode-foreground-dim mt-1">
                      自动保存聊天历史记录
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoSave(!autoSave)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      autoSave ? 'bg-vscode-accent' : 'bg-vscode-input-border'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        autoSave ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <div className="flex-1">
                    <div className="text-sm font-medium">桌面通知</div>
                    <p className="text-xs text-vscode-foreground-dim mt-1">
                      显示桌面通知消息
                    </p>
                  </div>
                  <button
                    onClick={() => setNotifications(!notifications)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notifications ? 'bg-vscode-accent' : 'bg-vscode-input-border'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        notifications ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <div className="flex-1">
                    <div className="text-sm font-medium">使用遥测</div>
                    <p className="text-xs text-vscode-foreground-dim mt-1">
                      发送使用数据帮助改进应用
                    </p>
                  </div>
                  <button
                    onClick={() => setTelemetry(!telemetry)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      telemetry ? 'bg-vscode-accent' : 'bg-vscode-input-border'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        telemetry ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <i className="codicon codicon-eye" />
                      显示所有隐藏文件
                    </div>
                    <p className="text-xs text-vscode-foreground-dim mt-1">
                      在文件浏览器中显示所有隐藏文件（如 .cache、.tmp 等）。关闭时仅显示重要的隐藏文件（如 .claude、.speckit、.env 等）
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      showHiddenFiles ? 'bg-vscode-accent' : 'bg-vscode-input-border'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        showHiddenFiles ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GitHub Sync Settings */}
          {selectedCategory === 'github-sync' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">GitHub 同步</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  配置 GitHub 仓库同步设置
                </p>
              </div>
              <GitHubSyncSettings projectPath={currentProject?.path || ''} />
            </div>
          )}

          {/* Data Management */}
          {selectedCategory === 'data-management' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">数据管理</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  管理应用程序数据和缓存
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4 text-sm">
                <div className="font-medium text-blue-400 mb-2 flex items-center gap-2">
                  <i className="codicon codicon-info" />
                  操作说明
                </div>
                <p className="text-vscode-foreground-dim">
                  以下操作仅清理 SQLite 搜索索引，不会删除原始聊天记录（JSONL 文件）。
                </p>
              </div>

              <div className="space-y-4">
                <div className="border border-vscode-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium mb-2">清空 SQLite 搜索索引</div>
                      <p className="text-xs text-vscode-foreground-dim mb-3">
                        清理 SQLite FTS5 全文搜索索引数据库，释放磁盘空间。
                      </p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <i className="codicon codicon-trash text-red-400" />
                          <span className="text-vscode-foreground-dim">将清理: SQLite 搜索索引</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <i className="codicon codicon-check text-green-400" />
                          <span className="text-vscode-foreground-dim">将保留: JSONL 原始聊天记录</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const confirmed = confirm(
                          '确认清空 SQLite 搜索索引？\n\n' +
                          '此操作将：\n' +
                          '✓ 清空 SQLite FTS5 搜索索引数据库\n' +
                          '✓ 清空内存缓存\n\n' +
                          '不会影响：\n' +
                          '✓ JSONL 原始聊天记录文件\n' +
                          '✓ 会话索引文件\n\n' +
                          '点击确定后，系统会自动从 JSONL 文件重建索引。'
                        );

                        if (!confirmed) return;

                        try {
                          console.log('[Settings] 开始清空 SQLite 搜索索引...');
                          const result = await window.electronAPI.invoke('history:clear-all-projects') as {
                            success: boolean;
                            deletedProjects: number;
                            deletedSessions: number;
                            errors: string[];
                          };

                          if (result.success) {
                            alert(
                              `✅ 清理完成！\n\n` +
                              `已清空 SQLite 数据库\n` +
                              `清理前数据统计：\n` +
                              `  • ${result.deletedProjects} 个项目\n` +
                              `  • ${result.deletedSessions} 个会话\n\n` +
                              `📁 JSONL 原始文件已保留\n` +
                              `💡 下次导入时将从 JSONL 重建数据库`
                            );

                            if (confirm('清理完成！是否刷新页面查看变化？')) {
                              window.location.reload();
                            }
                          } else {
                            alert(
                              `❌ 清理失败！\n\n` +
                              `错误信息：\n${result.errors.join('\n')}`
                            );
                          }
                        } catch (error) {
                          console.error('[Settings] 清理 SQLite 索引失败:', error);
                          alert(`清理失败: ${error instanceof Error ? error.message : '未知错误'}`);
                        }
                      }}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <i className="codicon codicon-clear-all" />
                      清空索引
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          {selectedCategory === 'keyboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">键盘快捷键</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  查看和管理键盘快捷键
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between py-3 border-b border-vscode-border">
                  <span className="text-sm">发送消息</span>
                  <code className="px-3 py-1.5 bg-vscode-input-bg rounded text-xs font-mono">Enter</code>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-vscode-border">
                  <span className="text-sm">换行</span>
                  <code className="px-3 py-1.5 bg-vscode-input-bg rounded text-xs font-mono">
                    Shift + Enter
                  </code>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-vscode-border">
                  <span className="text-sm">清空对话</span>
                  <code className="px-3 py-1.5 bg-vscode-input-bg rounded text-xs font-mono">Ctrl + K</code>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">打开设置</span>
                  <code className="px-3 py-1.5 bg-vscode-input-bg rounded text-xs font-mono">Ctrl + ,</code>
                </div>
              </div>
            </div>
          )}

          {/* About */}
          {selectedCategory === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">关于</h2>
                <p className="text-sm text-vscode-foreground-dim mb-6">
                  应用程序信息和版本详情
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-vscode-foreground-dim">版本</span>
                  <span className="text-sm">1.0.0</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-vscode-foreground-dim">Electron</span>
                  <span className="text-sm">{(window as any).versions?.electron || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-vscode-foreground-dim">Chrome</span>
                  <span className="text-sm">{(window as any).versions?.chrome || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-vscode-foreground-dim">Node</span>
                  <span className="text-sm">{(window as any).versions?.node || 'N/A'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-vscode-border flex gap-3">
                <button className="vscode-button-secondary flex items-center gap-2 text-sm">
                  <i className="codicon codicon-github" />
                  GitHub
                </button>
                <button className="vscode-button-secondary flex items-center gap-2 text-sm">
                  <i className="codicon codicon-book" />
                  文档
                </button>
                <button className="vscode-button-secondary flex items-center gap-2 text-sm">
                  <i className="codicon codicon-bug" />
                  报告问题
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
