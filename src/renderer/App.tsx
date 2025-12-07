/**
 * Main App Component
 * Handles routing, layout, and global state
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TitleBar } from './components/layout/TitleBar';
import { ActivityBar } from './components/layout/ActivityBar';
import { StatusBar } from './components/layout/StatusBar';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthWelcome } from './components/auth/AuthWelcome';
import { useThemeStore } from './stores/themeStore';
import { useMemoryMonitor } from './hooks/useMemoryMonitor';
import { IPCChannels } from '../shared/types/ipc.types';

// Lazy load modules for better performance
const Assistant = lazy(() => import('./modules/Assistant'));
const Projects = lazy(() => import('./modules/Projects'));
const FileExplorer = lazy(() => import('./modules/FileExplorer'));
const ChatHistory = lazy(() => import('./modules/ChatHistory'));
const Settings = lazy(() => import('./modules/Settings'));
const Workflow = lazy(() => import('./modules/Workflow'));

function App() {
  const { theme, initializeTheme } = useThemeStore();
  const [claudeCliAvailable, setClaudeCliAvailable] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingCli, setIsCheckingCli] = useState(true);

  // Initialize theme on mount
  // ⭐ 不依赖 initializeTheme 函数引用,因为 Zustand store 的函数每次渲染都会变化
  // 只在组件挂载时运行一次即可
  useEffect(() => {
    initializeTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check Claude CLI availability and authentication on mount
  // 关键优化: 先快速检查 CLI 可用性,再检查认证状态(后台进行)
  useEffect(() => {
    checkClaudeCliAndAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor memory usage
  useMemoryMonitor();

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? 'dark' : '';
  }, [theme]);

  /**
   * 检查 Claude CLI 可用性
   * Claude Code CLI 使用 API Key 认证，不需要额外的认证检查
   */
  const checkClaudeCliAndAuth = async () => {
    try {
      // Check if electronAPI is available
      if (!window.electronAPI?.invoke) {
        console.warn('[App] electronAPI not available, skipping Claude CLI check');
        setClaudeCliAvailable(false);
        setIsAuthenticated(false);
        setIsCheckingCli(false);
        return;
      }

      // 检查 CLI 是否可用 (约 1-2 秒)
      const availableResponse = await window.electronAPI.invoke<{ isAvailable: boolean }>(
        IPCChannels.CLAUDE_CHECK_AVAILABLE
      );

      // window.electronAPI.invoke 返回的是 data 字段的内容，不是完整的 IPC 响应
      const isAvailable = availableResponse.isAvailable ?? false;

      setClaudeCliAvailable(isAvailable);
      setIsCheckingCli(false);

      // Claude Code CLI 使用 API Key，如果 CLI 可用就直接认为已认证
      setIsAuthenticated(isAvailable);

    } catch (error) {
      console.error('[App] Failed to check Claude CLI:', error);
      setClaudeCliAvailable(false);
      setIsAuthenticated(false);
      setIsCheckingCli(false);
    }
  };

  // Claude Code CLI 认证相关函数已移除
  // CLI 可用即表示已通过订阅认证

  // Show loading while checking CLI (快速,只需 1-2 秒)
  if (isCheckingCli) {
    return (
      <div className="h-screen flex items-center justify-center bg-vscode-editor-bg">
        <LoadingSpinner showTip={true} />
      </div>
    );
  }

  // Show installation guide if Claude CLI is not available
  if (claudeCliAvailable === false) {
    return (
      <div className="h-screen flex items-center justify-center bg-vscode-editor-bg overflow-auto">
        <div className="max-w-3xl mx-auto p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-vscode-accent/10 rounded-full mb-4">
              <i className="codicon codicon-warning text-vscode-accent text-5xl" />
            </div>
            <h1 className="text-3xl font-bold mb-2">未检测到 Claude CLI</h1>
            <p className="text-vscode-foreground-dim text-lg">
              ClaudeMate 需要 Claude CLI 才能正常工作
            </p>
          </div>

          {/* 安装步骤 */}
          <div className="vscode-panel p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="codicon codicon-package" />
              安装 Claude CLI
            </h2>
            <div className="space-y-4 text-sm">
              <div className="vscode-panel-light p-4">
                <div className="font-medium mb-2 flex items-center gap-2">
                  <i className="codicon codicon-terminal" />
                  方法 1: 使用 npm 安装（推荐）
                </div>
                <ol className="list-decimal list-inside space-y-2 ml-2 text-vscode-foreground-dim">
                  <li>确保已安装 Node.js（<a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="text-vscode-accent hover:underline">下载</a>）</li>
                  <li>打开命令提示符或 PowerShell</li>
                  <li>运行以下命令：
                    <code className="block bg-vscode-input-bg px-3 py-2 rounded mt-2 font-mono">
                      npm install -g @anthropic-ai/claude-code
                    </code>
                  </li>
                  <li>等待安装完成</li>
                </ol>
              </div>

              <div className="vscode-panel-light p-4">
                <div className="font-medium mb-2 flex items-center gap-2">
                  <i className="codicon codicon-link-external" />
                  方法 2: 使用官方安装包
                </div>
                <p className="text-vscode-foreground-dim mb-2">
                  访问 <a
                    href="https://docs.anthropic.com/claude/docs/claude-cli"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-vscode-accent hover:underline"
                  >
                    Claude CLI 官方文档
                  </a> 下载适合你系统的安装包
                </p>
              </div>
            </div>
          </div>

          {/* 认证步骤 */}
          <div className="vscode-panel p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="codicon codicon-key" />
              设置认证（安装后必需）
            </h2>
            <div className="space-y-3 text-sm">
              <p className="text-vscode-foreground-dim">
                安装完成后，需要通过浏览器登录你的 Anthropic 账号：
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2 text-vscode-foreground-dim">
                <li>在命令行运行任意 claude 命令（会自动触发登录）</li>
                <li>浏览器会自动打开 Anthropic 登录页面</li>
                <li>使用你的 Anthropic 账号登录</li>
                <li>授权 Claude CLI 访问权限</li>
                <li>完成后返回应用，点击"重新检测"</li>
              </ol>
              <div className="bg-vscode-accent/10 border-l-4 border-vscode-accent p-3 mt-3">
                <p className="text-sm">
                  <i className="codicon codicon-info mr-2" />
                  <strong>注意：</strong>需要有效的 Claude 订阅（Pro 或 Team）才能使用 Claude Code CLI
                </p>
              </div>
            </div>
          </div>

          {/* 故障排除 */}
          <div className="vscode-panel p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="codicon codicon-tools" />
              故障排除
            </h2>
            <div className="space-y-3 text-sm">
              <details className="vscode-panel-light p-3">
                <summary className="font-medium cursor-pointer flex items-center gap-2">
                  <i className="codicon codicon-chevron-right" />
                  命令未找到：'claude' 不是内部或外部命令
                </summary>
                <div className="mt-3 ml-6 space-y-2 text-vscode-foreground-dim">
                  <p><strong>解决方案：</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>重启命令行窗口</li>
                    <li>检查 npm 全局路径是否在 PATH 中：
                      <code className="block bg-vscode-input-bg px-2 py-1 rounded mt-1">npm config get prefix</code>
                    </li>
                    <li>手动将 npm 全局路径添加到系统 PATH</li>
                  </ul>
                </div>
              </details>

              <details className="vscode-panel-light p-3">
                <summary className="font-medium cursor-pointer flex items-center gap-2">
                  <i className="codicon codicon-chevron-right" />
                  已安装但仍显示未检测到
                </summary>
                <div className="mt-3 ml-6 space-y-2 text-vscode-foreground-dim">
                  <p><strong>解决方案：</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>确认安装成功：在命令行运行 <code className="bg-vscode-input-bg px-2 py-1 rounded">claude --version</code></li>
                    <li>重启本应用</li>
                    <li>如果使用自定义 npm 路径，确保路径在系统 PATH 中</li>
                  </ul>
                </div>
              </details>

              <details className="vscode-panel-light p-3">
                <summary className="font-medium cursor-pointer flex items-center gap-2">
                  <i className="codicon codicon-chevron-right" />
                  权限错误或安装失败
                </summary>
                <div className="mt-3 ml-6 space-y-2 text-vscode-foreground-dim">
                  <p><strong>解决方案：</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Windows: 以管理员身份运行命令提示符</li>
                    <li>清除 npm 缓存：<code className="bg-vscode-input-bg px-2 py-1 rounded">npm cache clean --force</code></li>
                    <li>重新安装 Claude CLI</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="vscode-button-primary px-6 py-3 flex items-center gap-2"
            >
              <i className="codicon codicon-refresh" />
              重新检测
            </button>
            <a
              href="https://docs.anthropic.com/claude/docs/claude-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="vscode-button px-6 py-3 flex items-center gap-2 no-underline"
            >
              <i className="codicon codicon-book" />
              查看官方文档
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ⭐ 显示权限授权UI (首次启动或CLI不可用时)
  if (!claudeCliAvailable || !isAuthenticated) {
    const handleLogin = async () => {
      setIsLoggingIn(true);
      try {
        // 调用Claude CLI认证
        const result = await window.electronAPI.invoke(IPCChannels.CLAUDE_AUTH);
        if (result.success) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Authentication failed:', error);
      } finally {
        setIsLoggingIn(false);
      }
    };

    const handleSkip = () => {
      // 跳过认证，允许用户继续使用（但某些功能不可用）
      setIsAuthenticated(true);
    };

    return <AuthWelcome onLoginClick={handleLogin} onSkip={handleSkip} isLoading={isLoggingIn} />;
  }

  // Claude Code CLI: CLI 可用且已认证，进入主界面
  return (
    <div className="h-screen flex flex-col bg-vscode-editor-bg dark:bg-vscode-editor-bg text-vscode-foreground overflow-hidden">
      {/* ⭐⭐⭐ Custom Title Bar - 不包裹在ErrorBoundary中，确保始终可用 */}
      <TitleBar />

      {/* ⭐⭐⭐ Main Layout: 使用ErrorBoundary包裹，防止内容错误影响窗口控制 */}
      <ErrorBoundary>
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Activity Bar (VSCode-style vertical navigation) */}
          <ActivityBar />

          {/* Right: Main Content Area */}
          <main className="flex-1 overflow-hidden">
            <Suspense fallback={<LoadingSpinner showTip={true} />}>
              <Routes>
                <Route path="/" element={<Assistant />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/explorer" element={<FileExplorer />} />
                <Route path="/history" element={<ChatHistory />} />
                <Route path="/workflow" element={<Workflow />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </main>
        </div>

        {/* Status Bar */}
        <StatusBar />
      </ErrorBoundary>
    </div>
  );
}

export default App;
