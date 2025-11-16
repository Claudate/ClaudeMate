/**
 * Chat Input Component
 * Text input with send button and keyboard shortcuts
 */

import { useState, KeyboardEvent, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export interface ChatInputRef {
  appendText: (text: string) => void;
  setText: (text: string) => void;
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ onSend, isLoading }, ref) => {
  const [input, setInput] = useState('');
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
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');

      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = '60px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="border-t border-vscode-border p-4 bg-vscode-sidebar-bg">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="w-full vscode-input min-h-[60px] max-h-[200px] resize-none"
            disabled={isLoading}
            rows={2}
          />
          <div className="text-xs text-vscode-foreground-dim mt-1 flex items-center gap-1">
            {isLoading ? (
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
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-6 py-3 vscode-button self-start"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <i className="codicon codicon-loading codicon-modifier-spin" />
              Sending...
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
