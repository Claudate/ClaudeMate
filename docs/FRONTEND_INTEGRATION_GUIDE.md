# 前端集成指南 - IndexedDB 历史搜索功能

> 本文档说明如何在前端使用新的 IndexedDB + 多语言分词搜索功能

## 📋 目录

- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)

---

## 快速开始

### 1. 加载历史消息

优先从 IndexedDB 加载（快速），如果为空则自动从 JSONL 备份恢复。

```typescript
// src/renderer/components/ChatHistory.tsx

const loadHistory = async (sessionId: string) => {
  try {
    const result = await window.api.invoke('history:load-messages', {
      sessionId: sessionId
    });

    const { messages, fromBackup } = result;

    // 如果是从备份恢复的，提示用户
    if (fromBackup) {
      showNotification({
        type: 'info',
        message: '历史记录已从备份恢复',
        duration: 3000
      });
    }

    // 渲染消息列表
    setMessages(messages);

    console.log(`✅ 加载了 ${messages.length} 条消息`);
  } catch (error) {
    console.error('加载历史失败:', error);
    showNotification({
      type: 'error',
      message: '加载历史记录失败'
    });
  }
};
```

### 2. 全文搜索（支持中英日分词）

```typescript
const searchMessages = async (keyword: string) => {
  try {
    const results = await window.api.invoke('history:search', {
      keyword: keyword,
      limit: 20,          // 最多返回 20 条结果
      useTokenizer: true  // 启用分词（推荐）
    });

    // 显示搜索结果
    results.forEach((result: any) => {
      console.log('匹配类型:', result.matchType);     // 'title' 或 'content'
      console.log('匹配分数:', result.matchScore);    // 0-1，越高越相关
      console.log('消息内容:', result.message.content);
      console.log('时间戳:', new Date(result.message.timestamp));
    });

    setSearchResults(results);
  } catch (error) {
    console.error('搜索失败:', error);
  }
};
```

### 3. 高级搜索（带过滤条件）

```typescript
const advancedSearch = async () => {
  const results = await window.api.invoke('history:search', {
    keyword: '如何使用 AI',
    sessionId: currentSessionId,    // 限定当前会话
    projectPath: currentProject,    // 限定当前项目
    role: 'assistant',              // 只搜索 AI 的回复
    limit: 50,
    useTokenizer: true
  });

  return results;
};
```

---

## API 参考

### 1. `history:load-messages` - 智能加载消息

**参数:**
```typescript
{
  sessionId: string;  // 会话 ID
}
```

**返回:**
```typescript
{
  messages: ConversationMessage[];  // 消息列表
  fromBackup: boolean;              // 是否从 JSONL 备份恢复
}
```

**消息对象结构:**
```typescript
interface ConversationMessage {
  id?: number;
  sessionId: string;
  timestamp: number;              // Unix 时间戳（毫秒）
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectPath?: string;
  metadata?: {
    title?: string;
    model?: string;
    tokenCount?: number;
  };
}
```

---

### 2. `history:search` - 全文搜索

**参数:**
```typescript
{
  keyword: string;                              // 搜索关键词
  sessionId?: string;                           // 可选：限定会话
  projectPath?: string;                         // 可选：限定项目
  role?: 'user' | 'assistant' | 'system';      // 可选：限定角色
  limit?: number;                               // 可选：结果数量限制（默认无限制）
  useTokenizer?: boolean;                       // 可选：是否使用分词（默认 true）
}
```

**返回:**
```typescript
SearchResult[] // 搜索结果数组
```

**搜索结果结构:**
```typescript
interface SearchResult {
  message: ConversationMessage;     // 消息对象
  matchType: 'content' | 'title';  // 匹配位置
  matchScore: number;               // 匹配分数 (0-1)
}
```

---

### 3. `history:get-project-messages` - 获取项目所有消息

**参数:**
```typescript
{
  projectPath: string;  // 项目路径
}
```

**返回:**
```typescript
ConversationMessage[]  // 该项目的所有消息
```

---

### 4. `history:get-stats` - 获取统计信息

**参数:** 无

**返回:**
```typescript
{
  totalMessages: number;      // 总消息数
  sessionCount: number;       // 会话数量
  projectCount: number;       // 项目数量
  oldestMessage?: Date;       // 最早消息时间
  newestMessage?: Date;       // 最新消息时间
}
```

---

### 5. `history:delete-session-messages` - 删除会话历史

**参数:**
```typescript
{
  sessionId: string;  // 要删除的会话 ID
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 6. `history:delete-project-messages` - 删除项目历史

**参数:**
```typescript
{
  projectPath: string;  // 要删除的项目路径
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 7. `history:clear-all` - 清空所有历史

**参数:** 无

**返回:**
```typescript
{
  success: boolean;
}
```

⚠️ **警告**: 此操作不可恢复！建议在调用前添加二次确认。

---

## 使用示例

### 示例 1: 搜索组件

```typescript
// src/renderer/components/SearchBar.tsx

import { useState, useCallback } from 'react';

export const SearchBar = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    try {
      const searchResults = await window.api.invoke('history:search', {
        keyword: keyword,
        limit: 20,
        useTokenizer: true
      });

      setResults(searchResults);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  return (
    <div className="search-bar">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="搜索对话历史（支持中英日）..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? '搜索中...' : '搜索'}
      </button>

      {/* 搜索结果 */}
      <div className="search-results">
        {results.map((result, index) => (
          <SearchResultItem key={index} result={result} />
        ))}
      </div>
    </div>
  );
};
```

---

### 示例 2: 搜索结果高亮

```typescript
// src/renderer/components/SearchResultItem.tsx

interface SearchResultItemProps {
  result: {
    message: ConversationMessage;
    matchType: 'content' | 'title';
    matchScore: number;
  };
}

export const SearchResultItem = ({ result }: SearchResultItemProps) => {
  const { message, matchType, matchScore } = result;

  // 根据匹配分数显示相关度
  const getRelevanceLabel = (score: number) => {
    if (score > 0.8) return '高度相关';
    if (score > 0.5) return '相关';
    return '可能相关';
  };

  return (
    <div className="search-result-item">
      {/* 相关度标签 */}
      <div className="relevance-badge">
        {getRelevanceLabel(matchScore)}
        <span className="score">({(matchScore * 100).toFixed(0)}%)</span>
      </div>

      {/* 匹配位置 */}
      <div className="match-type">
        {matchType === 'title' ? '📌 标题匹配' : '📄 内容匹配'}
      </div>

      {/* 消息内容 */}
      <div className="message-content">
        <div className="role">{message.role === 'user' ? '👤 用户' : '🤖 AI'}</div>
        <div className="content">{message.content.substring(0, 200)}...</div>
        <div className="timestamp">
          {new Date(message.timestamp).toLocaleString('zh-CN')}
        </div>
      </div>

      {/* 元数据 */}
      {message.metadata && (
        <div className="metadata">
          {message.metadata.model && <span>模型: {message.metadata.model}</span>}
          {message.metadata.tokenCount && (
            <span>Token: {message.metadata.tokenCount}</span>
          )}
        </div>
      )}
    </div>
  );
};
```

---

### 示例 3: 历史加载与恢复提示

```typescript
// src/renderer/stores/chatStore.ts

import { create } from 'zustand';

interface ChatState {
  messages: ConversationMessage[];
  loadHistory: (sessionId: string) => Promise<void>;
  showBackupNotice: (fromBackup: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],

  loadHistory: async (sessionId: string) => {
    try {
      const result = await window.api.invoke('history:load-messages', {
        sessionId
      });

      set({ messages: result.messages });

      // 如果是从备份恢复，显示提示
      if (result.fromBackup) {
        // 使用你的通知系统
        showNotification({
          type: 'info',
          title: '历史记录已恢复',
          message: `从备份中恢复了 ${result.messages.length} 条消息`,
          action: {
            label: '了解更多',
            onClick: () => {
              // 显示帮助文档或说明
              window.open('docs/history-backup.md');
            }
          }
        });
      }
    } catch (error) {
      console.error('加载历史失败:', error);
      throw error;
    }
  },

  showBackupNotice: (fromBackup: boolean) => {
    // 实现你的通知逻辑
  }
}));
```

---

### 示例 4: 统计信息面板

```typescript
// src/renderer/components/StatisticsPanel.tsx

export const StatisticsPanel = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await window.api.invoke('history:get-stats');
        setStats(data);
      } catch (error) {
        console.error('获取统计信息失败:', error);
      }
    };

    loadStats();
  }, []);

  if (!stats) return <div>加载中...</div>;

  return (
    <div className="statistics-panel">
      <h3>📊 对话统计</h3>

      <div className="stat-item">
        <span className="label">总消息数:</span>
        <span className="value">{stats.totalMessages.toLocaleString()}</span>
      </div>

      <div className="stat-item">
        <span className="label">会话数:</span>
        <span className="value">{stats.sessionCount}</span>
      </div>

      <div className="stat-item">
        <span className="label">项目数:</span>
        <span className="value">{stats.projectCount}</span>
      </div>

      {stats.oldestMessage && (
        <div className="stat-item">
          <span className="label">最早消息:</span>
          <span className="value">
            {new Date(stats.oldestMessage).toLocaleDateString('zh-CN')}
          </span>
        </div>
      )}

      {stats.newestMessage && (
        <div className="stat-item">
          <span className="label">最新消息:</span>
          <span className="value">
            {new Date(stats.newestMessage).toLocaleDateString('zh-CN')}
          </span>
        </div>
      )}
    </div>
  );
};
```

---

### 示例 5: 删除确认对话框

```typescript
// src/renderer/components/DeleteConfirmDialog.tsx

export const DeleteConfirmDialog = ({
  sessionId,
  onClose
}: {
  sessionId: string;
  onClose: () => void;
}) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await window.api.invoke('history:delete-session-messages', {
        sessionId
      });

      showNotification({
        type: 'success',
        message: '会话历史已删除'
      });

      onClose();
    } catch (error) {
      console.error('删除失败:', error);
      showNotification({
        type: 'error',
        message: '删除失败，请重试'
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <dialog className="delete-confirm-dialog">
      <h3>⚠️ 确认删除</h3>
      <p>
        此操作将删除该会话的所有历史记录。
        <br />
        <strong>此操作不可恢复！</strong>
      </p>

      <div className="actions">
        <button onClick={onClose} disabled={deleting}>
          取消
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="danger"
        >
          {deleting ? '删除中...' : '确认删除'}
        </button>
      </div>
    </dialog>
  );
};
```

---

## 最佳实践

### 1. 性能优化

#### 使用防抖搜索
```typescript
import { debounce } from 'lodash';

const debouncedSearch = useCallback(
  debounce(async (keyword: string) => {
    const results = await window.api.invoke('history:search', {
      keyword,
      limit: 20
    });
    setResults(results);
  }, 300),
  []
);
```

#### 分页加载
```typescript
const loadMoreResults = async (offset: number) => {
  // 注意: 目前 API 不直接支持 offset，可以在前端实现
  const allResults = await window.api.invoke('history:search', {
    keyword: keyword,
    limit: offset + 20  // 获取更多结果
  });

  // 只取新的部分
  const newResults = allResults.slice(offset);
  setResults(prev => [...prev, ...newResults]);
};
```

---

### 2. 错误处理

```typescript
const safeSearchCall = async (keyword: string) => {
  try {
    const results = await window.api.invoke('history:search', {
      keyword,
      useTokenizer: true
    });
    return results;
  } catch (error) {
    // 记录错误
    console.error('搜索失败:', error);

    // 显示友好的错误提示
    showNotification({
      type: 'error',
      message: '搜索失败，请检查网络连接或重试'
    });

    // 返回空结果
    return [];
  }
};
```

---

### 3. 用户体验提升

#### 加载状态
```typescript
const [isLoading, setIsLoading] = useState(false);

const loadHistory = async (sessionId: string) => {
  setIsLoading(true);
  try {
    const result = await window.api.invoke('history:load-messages', {
      sessionId
    });

    // 显示骨架屏或进度条
    setMessages(result.messages);
  } finally {
    setIsLoading(false);
  }
};
```

#### 空状态提示
```typescript
{messages.length === 0 && (
  <div className="empty-state">
    <p>📭 暂无历史记录</p>
    <p className="hint">开始对话后，消息会自动保存到历史记录</p>
  </div>
)}
```

#### 搜索关键词高亮
```typescript
const highlightKeyword = (text: string, keyword: string) => {
  const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={index}>{part}</mark>
      : part
  );
};
```

---

### 4. 数据同步

```typescript
// 监听消息保存事件（如果有实时同步需求）
useEffect(() => {
  const handleNewMessage = (message: ConversationMessage) => {
    // 更新本地状态
    setMessages(prev => [...prev, message]);
  };

  // 监听 Claude 流式输出完成事件
  window.api.on('claude:message-saved', handleNewMessage);

  return () => {
    window.api.off('claude:message-saved', handleNewMessage);
  };
}, []);
```

---

### 5. TypeScript 类型定义

```typescript
// src/renderer/types/history.types.ts

export interface ConversationMessage {
  id?: number;
  sessionId: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectPath?: string;
  metadata?: {
    title?: string;
    model?: string;
    tokenCount?: number;
  };
}

export interface SearchResult {
  message: ConversationMessage;
  matchType: 'content' | 'title';
  matchScore: number;
}

export interface SearchOptions {
  keyword: string;
  sessionId?: string;
  projectPath?: string;
  role?: 'user' | 'assistant' | 'system';
  limit?: number;
  useTokenizer?: boolean;
}

export interface HistoryStats {
  totalMessages: number;
  sessionCount: number;
  projectCount: number;
  oldestMessage?: Date;
  newestMessage?: Date;
}
```

---

## 🎨 UI 组件样式建议

### 搜索结果样式
```css
.search-result-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.search-result-item:hover {
  border-color: #1976d2;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.relevance-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: #e3f2fd;
  color: #1976d2;
}

.match-type {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

mark {
  background: #ffeb3b;
  padding: 0 2px;
  border-radius: 2px;
}
```

---

## ⚡ 性能指标

基于 IndexedDB 的实现，预期性能指标：

- **加载历史**: < 50ms (IndexedDB) / < 200ms (JSONL fallback)
- **搜索响应**: < 100ms (1000条消息以内)
- **消息保存**: < 10ms (异步，不阻塞主流程)

---

## 🔧 调试技巧

### 1. 查看 IndexedDB 数据

Chrome DevTools → Application → IndexedDB → ClaudeConversations

### 2. 查看 JSONL 备份文件

```bash
# 开发环境
H:\Electron\claude-skills-app\.claude-history-backup\{sessionId}.jsonl
```

### 3. 启用详细日志

```typescript
// 在主进程中
process.env.DEBUG = 'SessionHistoryService,ConversationDatabase,TokenizerService';
```

---

## 📚 相关文档

- [Claude CLI 参考文档](./CLAUDE_CLI_REFERENCE.md)
- [IndexedDB API 文档](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Dexie.js 文档](https://dexie.org/)

---

## 🤝 需要帮助？

如有问题，请查看：
- [GitHub Issues](https://github.com/your-repo/issues)
- [讨论区](https://github.com/your-repo/discussions)

---

**最后更新**: 2025-11-11
