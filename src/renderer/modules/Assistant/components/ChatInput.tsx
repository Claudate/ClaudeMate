/**
 * Chat Input Component
 * Text input with send button and keyboard shortcuts
 */

import { useState, KeyboardEvent, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { IPCChannels } from '@shared/types/ipc.types';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  sessionId?: string;  // ⭐ 添加 sessionId 用于取消会话
}

export interface ChatInputRef {
  appendText: (text: string) => void;
  setText: (text: string) => void;
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ onSend, isLoading, sessionId }, ref) => {
  const [input, setInput] = useState('');
  const [isPaused, setIsPaused] = useState(false);  // ⭐ 暂停状态
  const [showSlashMenu, setShowSlashMenu] = useState(false);  // ⭐ 斜杠命令菜单
  const [slashCommands] = useState([
    { command: '/help', description: '显示所有可用的斜杠命令' },
    { command: '/clear', description: '清空当前上下文，重置对话' },
    { command: '/compact', description: '压缩对话历史，创建摘要并保留关键信息' },
    { command: '/init', description: '初始化项目，生成 Claude.md 文件' },
    { command: '/rewind', description: '回退到之前的对话状态' },
    { command: '/context', description: '查看当前 token 使用情况' },
    { command: '/permissions', description: '打开权限设置' },
    { command: '/hooks', description: '配置生命周期钩子' },
    { command: '/model', description: '切换 Claude 模型 (sonnet/opus/haiku)' },
    { command: '/config', description: '打开配置设置' },
    { command: '/install-github-app', description: '安装 GitHub PR 审查应用' },
  ]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ⭐ 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    appendText: (text: string) => {
      setInput((prev) => (prev ? `${prev}\n\n${text}` : text));
      // 调整textarea高度
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = '60px';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
      }, 0);
    },
    setText: (text: string) => {
      setInput(text);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = '60px';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
      }, 0);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  // Auto-focus on mount
  useEffect(() => {
    console.log('🔥🔥🔥 [ChatInput] 组件已挂载！准备监听斜杠命令...');
    textareaRef.current?.focus();
  }, []);

  // ⭐ 处理暂停功能
  const handlePause = async () => {
    if (!sessionId) return;

    // 立即设置暂停状态，提供即时视觉反馈
    setIsPaused(true);

    try {
      await window.electronAPI.invoke(IPCChannels.CLAUDE_CANCEL, { sessionId });
      console.log('[ChatInput] 会话已暂停');

      // 3秒后自动恢复暂停状态显示
      setTimeout(() => {
        setIsPaused(false);
      }, 3000);
    } catch (error) {
      console.error('[ChatInput] 暂停会话失败:', error);
      // 如果暂停失败，立即恢复状态
      setIsPaused(false);
    }
  };

  // ⭐ 处理斜杠命令执行
  const executeSlashCommand = (commandText: string): boolean => {
    const parts = commandText.trim().split(' ');
    const command = parts[0];

    // 检查是否是已知的斜杠命令
    const knownCommands = slashCommands.map(cmd => cmd.command);
    if (!knownCommands.includes(command)) {
      return false;
    }

    // 将斜杠命令直接传递给 Claude CLI
    // Claude CLI 会处理这些内置命令
    switch (command) {
      case '/help':
        onSend('请显示所有可用的斜杠命令和使用说明');
        return true;
      case '/clear':
        onSend('/clear');
        return true;
      case '/compact':
        onSend('请压缩当前对话历史，创建摘要并保留关键信息');
        return true;
      case '/init':
        onSend('请初始化当前项目，扫描项目结构并生成 Claude.md 文件');
        return true;
      case '/rewind':
        onSend('请显示对话历史，让我选择要回退到的时间点');
        return true;
      case '/context':
        onSend('请显示当前会话的 token 使用情况和上下文状态');
        return true;
      case '/permissions':
        onSend('请显示当前的权限设置和配置');
        return true;
      case '/hooks':
        onSend('请显示当前配置的钩子和生命周期事件');
        return true;
      case '/model':
        if (parts[1]) {
          onSend(`请切换到 ${parts[1]} 模型`);
        } else {
          onSend('请显示当前使用的模型和可用的模型列表 (sonnet/opus/haiku)');
        }
        return true;
      case '/config':
        onSend('请显示当前的配置设置');
        return true;
      case '/install-github-app':
        onSend('请帮助我安装 GitHub PR 审查应用');
        return true;
      default:
        return false;
    }
  };

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      // ⭐ 检查是否是斜杠命令
      if (input.startsWith('/')) {
        const executed = executeSlashCommand(input);
        if (executed) {
          setInput('');
          setShowSlashMenu(false);
          if (textareaRef.current) {
            textareaRef.current.style.height = '60px';
          }
          return;
        }
      }

      onSend(input.trim());
      setInput('');
      setIsPaused(false);  // ⭐ 重置暂停状态
      setShowSlashMenu(false);  // ⭐ 关闭斜杠菜单

      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // ⭐ ESC键关闭斜杠菜单
    if (e.key === 'Escape' && showSlashMenu) {
      e.preventDefault();
      setShowSlashMenu(false);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    console.log('🔥🔥🔥 [ChatInput] handleInput 被调用!!! 输入值:', value);
    setInput(value);

    // ⭐ 检测斜杠命令 - 更宽松的条件，允许输入过程中显示
    // 只要以/开头且长度小于20（避免长文本误触发）就显示菜单
    const shouldShowMenu = value.startsWith('/') && value.length < 20 && value.indexOf('\n') === -1;
    console.log('🔥🔥🔥 [ChatInput] 输入变化:', { value, shouldShowMenu, length: value.length });
    setShowSlashMenu(shouldShowMenu);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = '60px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // ⭐ 处理斜杠命令选择
  const handleSlashCommand = (command: string) => {
    setInput(command + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  // ⭐ 调试：打印状态
  console.log('[ChatInput] render - showSlashMenu:', showSlashMenu, 'input:', input);

  return (
    <div className="border-t border-vscode-border p-4 bg-vscode-sidebar-bg relative">
      {/* ⭐ 调试信息 */}
      {showSlashMenu && (
        <div className="absolute top-0 left-0 bg-red-500 text-white px-2 py-1 text-xs z-[200]">
          菜单应该显示: {input}
        </div>
      )}

      {/* ⭐ 斜杠命令菜单 */}
      {showSlashMenu && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-vscode-menu-bg border-2 border-vscode-accent rounded-lg shadow-2xl py-2 max-h-[400px] overflow-y-auto z-[100]">
          <div className="px-3 py-2 text-xs text-vscode-accent font-semibold border-b border-vscode-border mb-1 flex items-center gap-2">
            <i className="codicon codicon-symbol-keyword" />
            斜杠命令 (Slash Commands)
          </div>
          {slashCommands
            .filter(cmd => {
              // 如果只输入了 "/"，显示所有命令
              if (input === '/') return true;
              // 否则过滤匹配的命令
              return cmd.command.toLowerCase().includes(input.toLowerCase());
            })
            .map((cmd, index) => (
              <button
                key={index}
                onClick={() => handleSlashCommand(cmd.command)}
                className="w-full px-3 py-2 text-left hover:bg-vscode-accent/20 active:bg-vscode-accent/30 flex flex-col gap-1 transition-colors"
              >
                <code className="text-vscode-accent font-mono text-sm font-bold">{cmd.command}</code>
                <span className="text-xs text-vscode-foreground-dim leading-relaxed">{cmd.description}</span>
              </button>
            ))}
          {slashCommands.filter(cmd => {
            if (input === '/') return true;
            return cmd.command.toLowerCase().includes(input.toLowerCase());
          }).length === 0 && (
            <div className="px-3 py-4 text-center text-vscode-foreground-dim text-xs">
              没有匹配的命令
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line, / for commands)"
            className="w-full vscode-input min-h-[60px] max-h-[200px] resize-none"
            disabled={isLoading || isPaused}
            rows={2}
          />
          <div className="text-xs text-vscode-foreground-dim mt-1 flex items-center gap-1">
            {isPaused ? (
              <>
                <i className="codicon codicon-debug-stop text-yellow-400" />
                <span className="text-yellow-400">已暂停</span>
              </>
            ) : isLoading ? (
              <>
                <i className="codicon codicon-loading codicon-modifier-spin" />
                Waiting for response...
              </>
            ) : (
              <>
                <i className="codicon codicon-lightbulb" />
                Tip: Use Shift+Enter for multi-line
              </>
            )}
          </div>
        </div>
        <button
          onClick={isLoading ? handlePause : handleSend}
          disabled={(!isLoading && !input.trim()) || isPaused}
          className={`px-6 py-3 self-start ${
            isLoading
              ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 rounded font-medium transition-colors'
              : 'vscode-button'
          }`}
        >
          {isPaused ? (
            <span className="flex items-center gap-2">
              <i className="codicon codicon-debug-stop" />
              已暂停
            </span>
          ) : isLoading ? (
            <span className="flex items-center gap-2">
              <i className="codicon codicon-debug-pause" />
              暂停
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <i className="codicon codicon-send" />
              Send
            </span>
          )}
        </button>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
