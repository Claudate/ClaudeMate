/**
 * Error Boundary Component
 * 捕获React组件树中的错误，防止整个应用崩溃
 * 确保窗口控制按钮始终可用
 */

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallbackUI?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback UI，使用它
      if (this.props.fallbackUI) {
        return this.props.fallbackUI;
      }

      // 默认错误UI
      return (
        <div className="h-full flex items-center justify-center bg-vscode-editor-bg p-8">
          <div className="max-w-2xl w-full vscode-panel p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                <i className="codicon codicon-error text-red-500 text-2xl" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-vscode-foreground mb-2">
                  应用出现错误
                </h2>
                <p className="text-vscode-foreground-dim text-sm mb-4">
                  应用遇到了一个意外错误。您可以尝试重新加载或继续使用其他功能。
                </p>
              </div>
            </div>

            {/* 错误详情（可折叠） */}
            <details className="mb-6">
              <summary className="cursor-pointer text-sm font-medium text-vscode-foreground hover:text-vscode-accent mb-2">
                <i className="codicon codicon-chevron-right mr-2" />
                查看错误详情
              </summary>
              <div className="mt-3 bg-vscode-input-bg p-4 rounded text-xs font-mono overflow-auto max-h-64">
                <div className="text-red-400 mb-2">
                  {this.state.error?.toString()}
                </div>
                {this.state.errorInfo && (
                  <div className="text-vscode-foreground-dim whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            </details>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="vscode-button-primary px-4 py-2 flex items-center gap-2"
              >
                <i className="codicon codicon-debug-restart" />
                重试
              </button>
              <button
                onClick={this.handleReload}
                className="vscode-button px-4 py-2 flex items-center gap-2"
              >
                <i className="codicon codicon-refresh" />
                重新加载应用
              </button>
            </div>

            {/* 提示信息 */}
            <div className="mt-6 text-xs text-vscode-foreground-dim">
              <i className="codicon codicon-info mr-2" />
              窗口控制按钮（最小化、最大化、关闭）仍然可用。如果问题持续，请尝试重启应用。
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
