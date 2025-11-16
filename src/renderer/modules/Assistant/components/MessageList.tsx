/**
 * Message List Component
 * Displays chat messages with user/assistant differentiation
 * ⭐ 支持 Markdown 渲染
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css'; // 代码高亮样式

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-vscode-accent text-white'
                : 'bg-vscode-input-bg text-vscode-foreground border border-vscode-border'
            }`}
          >
            {/* Role badge */}
            <div className="text-xs font-semibold mb-2 opacity-70 flex items-center gap-1">
              {message.role === 'user' ? (
                <>
                  <i className="codicon codicon-account" />
                  You
                </>
              ) : (
                <>
                  <i className="codicon codicon-hubot" />
                  Claude
                </>
              )}
            </div>

            {/* Content - ⭐ 使用 Markdown 渲染 */}
            <div className="selectable text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
              {message.content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    // 自定义代码块样式
                    code: ({ node, inline, className, children, ...props }: any) => {
                      return inline ? (
                        <code className="bg-vscode-input-bg px-1 py-0.5 rounded text-xs" {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    // 自定义链接样式
                    a: ({ node, children, ...props }: any) => (
                      <a
                        className="text-vscode-accent hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                message.isStreaming && <span className="opacity-50">...</span>
              )}
              {message.isStreaming && message.content && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
              )}
            </div>

            {/* Timestamp */}
            <div className="text-xs mt-2 opacity-50">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>

            {/* Copy button */}
            {!message.isStreaming && message.content && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                }}
                className="mt-2 text-xs opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
                title="Copy to clipboard"
              >
                <i className="codicon codicon-clippy" />
                Copy
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
