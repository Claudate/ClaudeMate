# 🚀 功能实现指南

本文档指导您完成 Claude Skills 核心功能的实现。

## 📋 实现优先级

### Phase 1: 基础运行 (已完成 ✅)
- [x] 项目结构搭建
- [x] Electron + React 框架
- [x] TypeScript 配置
- [x] 内存监控系统
- [x] IPC 通信层
- [x] 主题系统
- [x] 依赖安装

### Phase 2: Claude CLI 集成 (进行中 🔄)
- [ ] ClaudeService 实现
- [ ] IPC handlers 注册
- [ ] 流式响应处理
- [ ] 错误处理和重试

### Phase 3: Assistant 聊天界面
- [ ] 消息列表组件
- [ ] 输入框组件
- [ ] 流式显示
- [ ] 代码高亮
- [ ] 复制/重试功能

### Phase 4: 项目管理
- [ ] 项目列表
- [ ] 创建/打开/删除项目
- [ ] 项目设置
- [ ] 数据持久化

### Phase 5: 其他模块
- [ ] 文件浏览器
- [ ] 聊天历史
- [ ] 工作流编辑器

---

## 🔧 详细实现步骤

### 1. Claude CLI 集成完成

#### 1.1 在 IPCManager 中注册 Claude handlers

编辑 `src/main/managers/IPCManager.ts`，添加以下方法：

```typescript
import { ClaudeService } from '../services/ClaudeService';

// 在 registerHandlers() 方法中添加
public async registerHandlers(): Promise<void> {
  // ... 现有代码 ...

  // Claude handlers
  this.registerClaudeHandlers();

  // ... 其他 handlers ...
}

/**
 * Register Claude CLI handlers
 */
private registerClaudeHandlers(): void {
  const claudeService = ClaudeService.getInstance();

  // Check if Claude CLI is available
  this.register(IPCChannels.CLAUDE_EXECUTE, async (data: {
    message: string;
    sessionId?: string;
    model?: 'opus' | 'sonnet' | 'haiku';
    cwd?: string;
  }) => {
    const { message, sessionId, model, cwd } = data;

    // Execute Claude CLI
    const response = await claudeService.execute({
      message,
      sessionId: sessionId || 'default',
      model,
      cwd,
    });

    return { response };
  });

  // Cancel Claude execution
  this.register(IPCChannels.CLAUDE_CANCEL, async (data: {
    sessionId: string;
  }) => {
    const { sessionId } = data;
    const canceled = claudeService.cancel(sessionId);
    return { canceled };
  });

  // Setup streaming
  claudeService.on('stream', (sessionId: string, chunk: ClaudeStreamChunk) => {
    this.sendToRenderer('claude:stream', { sessionId, chunk });
  });
}
```

#### 1.2 在 main/index.ts 中添加清理

编辑 `src/main/index.ts`，在 `before-quit` 事件中：

```typescript
import { ClaudeService } from './services/ClaudeService';

app.on('before-quit', async () => {
  logger.info('App is quitting...');

  // Cleanup
  const memoryMonitor = MemoryMonitor.getInstance();
  memoryMonitor.stop();

  // Cleanup Claude processes
  const claudeService = ClaudeService.getInstance();
  claudeService.cleanup();
});
```

---

### 2. 实现 Assistant 聊天界面

#### 2.1 创建消息类型定义

创建 `src/renderer/modules/Assistant/types.ts`:

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

#### 2.2 创建 Chat Store

创建 `src/renderer/stores/chatStore.ts`:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { IPCChannels } from '@shared/types/ipc.types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentSessionId: string;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    messages: [],
    isLoading: false,
    currentSessionId: nanoid(),

    sendMessage: async (content: string) => {
      const userMessage: Message = {
        id: nanoid(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Add user message
      set((state) => {
        state.messages.push(userMessage);
        state.isLoading = true;
      });

      // Create assistant message placeholder
      const assistantMessageId = nanoid();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      set((state) => {
        state.messages.push(assistantMessage);
      });

      try {
        // Setup streaming listener
        const unsubscribe = window.electronAPI.on(
          'claude:stream',
          (data: { sessionId: string; chunk: { type: string; content: string } }) => {
            if (data.sessionId === get().currentSessionId) {
              const { type, content: chunkContent } = data.chunk;

              if (type === 'text') {
                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    msg.content += chunkContent;
                  }
                });
              } else if (type === 'done') {
                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    msg.isStreaming = false;
                  }
                  state.isLoading = false;
                });
                unsubscribe();
              } else if (type === 'error') {
                set((state) => {
                  const msg = state.messages.find((m) => m.id === assistantMessageId);
                  if (msg) {
                    msg.content = `Error: ${chunkContent}`;
                    msg.isStreaming = false;
                  }
                  state.isLoading = false;
                });
                unsubscribe();
              }
            }
          }
        );

        // Execute Claude CLI
        await window.electronAPI.invoke(IPCChannels.CLAUDE_EXECUTE, {
          message: content,
          sessionId: get().currentSessionId,
          model: 'sonnet',
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        set((state) => {
          const msg = state.messages.find((m) => m.id === assistantMessageId);
          if (msg) {
            msg.content = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            msg.isStreaming = false;
          }
          state.isLoading = false;
        });
      }
    },

    addMessage: (message) => {
      set((state) => {
        state.messages.push(message);
      });
    },

    updateStreamingMessage: (id, content) => {
      set((state) => {
        const message = state.messages.find((m) => m.id === id);
        if (message) {
          message.content = content;
        }
      });
    },

    clearMessages: () => {
      set((state) => {
        state.messages = [];
        state.isLoading = false;
        state.currentSessionId = nanoid();
      });
    },
  }))
);
```

#### 2.3 实现 Assistant 组件

编辑 `src/renderer/modules/Assistant/index.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@stores/chatStore';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export default function Assistant() {
  const { messages, isLoading, sendMessage, clearMessages } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (content.trim()) {
      await sendMessage(content);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-vscode-border">
        <h1 className="text-xl font-semibold">Claude Assistant</h1>
        <button
          onClick={clearMessages}
          className="px-3 py-1 text-sm bg-vscode-input-bg hover:bg-vscode-input-border rounded transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-vscode-accent opacity-50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-lg">Start a conversation with Claude</p>
              <p className="text-sm mt-2">Type your message below to begin</p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
```

#### 2.4 创建 MessageList 组件

创建 `src/renderer/modules/Assistant/components/MessageList.tsx`:

```typescript
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
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-vscode-accent text-white'
                : 'bg-vscode-input-bg text-vscode-foreground'
            }`}
          >
            {/* Role badge */}
            <div className="text-xs font-semibold mb-2 opacity-70">
              {message.role === 'user' ? 'You' : 'Claude'}
            </div>

            {/* Content */}
            <div className="whitespace-pre-wrap selectable">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
              )}
            </div>

            {/* Timestamp */}
            <div className="text-xs mt-2 opacity-50">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 2.5 创建 ChatInput 组件

创建 `src/renderer/modules/Assistant/components/ChatInput.tsx`:

```typescript
import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-vscode-border p-4">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="flex-1 vscode-input min-h-[60px] max-h-[200px] resize-y"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-6 vscode-button self-end"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

---

### 3. 启动和测试

#### 3.1 启动开发服务器

```bash
# 方法1: 使用批处理
dev.bat

# 方法2: 使用npm
npm run dev
```

#### 3.2 测试 Claude 集成

1. 打开应用
2. 导航到 Assistant 模块
3. 输入消息: "Hello, Claude!"
4. 观察流式响应

#### 3.3 调试

如果Claude CLI调用失败:

1. 检查 Claude CLI 是否已安装:
   ```bash
   claude --version
   ```

2. 检查控制台错误
3. 查看主进程日志
4. 验证IPC通信是否正常

---

### 4. 数据持久化

#### 4.1 创建 Storage Service

创建 `src/main/services/StorageService.ts`:

```typescript
import Store from 'electron-store';
import { Logger } from '../utils/Logger';

const logger = Logger.getInstance('StorageService');

interface SessionData {
  id: string;
  projectId: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
}

export class StorageService {
  private static instance: StorageService;
  private store: Store;

  private constructor() {
    this.store = new Store({
      name: 'claude-skills-data',
      encryptionKey: 'your-encryption-key', // Change this!
    });
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Sessions
  public async saveSession(session: SessionData): Promise<void> {
    const sessions = this.store.get('sessions', {}) as Record<string, SessionData>;
    sessions[session.id] = session;
    this.store.set('sessions', sessions);
    logger.info(`Session saved: ${session.id}`);
  }

  public async getSession(id: string): Promise<SessionData | null> {
    const sessions = this.store.get('sessions', {}) as Record<string, SessionData>;
    return sessions[id] || null;
  }

  public async getAllSessions(): Promise<SessionData[]> {
    const sessions = this.store.get('sessions', {}) as Record<string, SessionData>;
    return Object.values(sessions);
  }

  public async deleteSession(id: string): Promise<boolean> {
    const sessions = this.store.get('sessions', {}) as Record<string, SessionData>;
    if (sessions[id]) {
      delete sessions[id];
      this.store.set('sessions', sessions);
      logger.info(`Session deleted: ${id}`);
      return true;
    }
    return false;
  }

  // Settings
  public async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    return this.store.get(`settings.${key}`, defaultValue) as T;
  }

  public async setSetting(key: string, value: any): Promise<void> {
    this.store.set(`settings.${key}`, value);
  }

  // Clear all data
  public async clear(): Promise<void> {
    this.store.clear();
    logger.warn('All data cleared');
  }
}
```

---

### 5. 下一步

完成以上实现后，您的应用将具备:

✅ Claude CLI 集成
✅ 流式聊天界面
✅ 消息历史
✅ 数据持久化

继续实现:
- [ ] Projects 模块
- [ ] FileExplorer 模块
- [ ] ChatHistory 搜索
- [ ] Workflow 编辑器

---

## 🐛 常见问题

### Claude CLI 未找到

确保 Claude Code 已安装:
```bash
npm install -g @anthropic-ai/claude-code
```

### IPC 通信失败

检查 channel 名称是否正确定义在 `IPCChannels`

### 流式响应不显示

检查 EventEmitter 监听器是否正确设置

---

**需要帮助？查看完整文档或提交 Issue!**
