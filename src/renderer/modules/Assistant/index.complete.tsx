/**
 * Assistant Module - Complete Implementation
 * AI chat interface with Claude CLI integration
 */

import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export default function Assistant() {
  const { messages, isLoading, error, sendMessage, clearMessages, currentSessionId } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (content.trim()) {
      await sendMessage(content);
    }
  };

  return (
    <div className="h-full flex flex-col bg-vscode-editor-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-vscode-border bg-vscode-sidebar-bg">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <svg className="w-6 h-6 text-vscode-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Claude Assistant
          </h1>
          <p className="text-xs text-vscode-foreground-dim mt-1">
            Chat with Claude AI • {messages.length} messages
          </p>
        </div>
        <button
          onClick={clearMessages}
          className="px-3 py-1.5 text-sm bg-vscode-input-bg hover:bg-vscode-input-border rounded transition-colors border border-vscode-border"
          title="Clear all messages"
        >
          🗑️ Clear Chat
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-500 p-3 m-4">
          <p className="text-sm text-red-400">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
            <div className="text-center max-w-md">
              <svg
                className="w-20 h-20 mx-auto mb-6 text-vscode-accent opacity-30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" />
              </svg>
              <h2 className="text-2xl font-semibold mb-3 text-vscode-foreground">
                Start a conversation with Claude
              </h2>
              <p className="text-sm mb-4">
                Type your message below and get instant AI assistance with:
              </p>
              <div className="grid grid-cols-2 gap-3 text-left text-xs">
                <div className="p-3 bg-vscode-input-bg rounded border border-vscode-border">
                  <div className="font-semibold mb-1">💻 Coding Help</div>
                  <div className="opacity-70">Write, debug, and explain code</div>
                </div>
                <div className="p-3 bg-vscode-input-bg rounded border border-vscode-border">
                  <div className="font-semibold mb-1">📝 Writing</div>
                  <div className="opacity-70">Content, docs, and emails</div>
                </div>
                <div className="p-3 bg-vscode-input-bg rounded border border-vscode-border">
                  <div className="font-semibold mb-1">🔍 Research</div>
                  <div className="opacity-70">Analysis and insights</div>
                </div>
                <div className="p-3 bg-vscode-input-bg rounded border border-vscode-border">
                  <div className="font-semibold mb-1">💡 Ideas</div>
                  <div className="opacity-70">Brainstorm and plan</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={messages} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} sessionId={currentSessionId} />
    </div>
  );
}
