# 存储架构说明

## 三层存储架构

本项目采用三层存储架构，各司其职，互相配合：

```
┌─────────────────────────────────────────────────────────────┐
│                    用户操作                                   │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ JSON 文件存储 │  │ SQLite FTS5  │  │  IndexedDB   │
│  (主数据源)   │  │  (会话搜索)   │  │ (消息搜索)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

## 1. JSON 文件存储 (SessionStorageService)

### 📁 存储位置
```
ChatHistory/
├── [SHA256Hash]/
│   ├── sessions/
│   │   ├── uuid-1.json  ← 完整会话数据
│   │   ├── uuid-2.json
│   │   └── ...
│   └── sessionIndex.json  ← 快速元数据索引
```

### ✅ 职责
- **主数据源**：所有会话的完整数据（消息、元数据、Token 统计等）
- **数据持久化**：可靠的磁盘存储，应用关闭后数据不丢失
- **备份恢复**：可直接复制 JSON 文件进行备份
- **人类可读**：JSON 格式便于调试和手动查看

### 🎯 使用场景
- 创建、更新、删除会话
- 加载完整会话数据
- 会话元数据管理
- 数据备份与恢复

---

## 2. SQLite FTS5 (SearchIndexService)

### 📁 存储位置
```
ChatHistory/
└── search_index.db  ← SQLite 数据库文件
    ├── sessions_fts (FTS5 表)      ← 分词后的全文索引
    └── sessions_metadata (表)       ← 会话元数据副本
```

### ✅ 职责
- **全文搜索引擎**：高性能的会话级别全文搜索
- **多语言分词**：支持中文（字符级 + N-gram）、日文（字符级）、英文（空格分割）
- **相关度排序**：根据匹配度对搜索结果排序
- **跨会话搜索**：在所有会话中搜索关键词

### 🎯 使用场景
- **History 页面**：搜索历史会话（"找出包含'图片粘贴'的会话"）
- **离线搜索**：无需加载所有会话到内存
- **智能排序**：按相关度或时间排序搜索结果

### 🔍 搜索流程
```
用户输入 "如何实现搜索"
    ↓
MultiLangTokenizer 分词
    ["如何", "实现", "搜索"]
    ↓
SQLite FTS5 查询
    MATCH '"如何" OR "实现" OR "搜索"'
    ↓
返回匹配的会话列表（按相关度排序）
```

---

## 3. IndexedDB (ConversationDatabase)

### 📁 存储位置
```
浏览器 IndexedDB
└── conversation-db
    └── messages 表
        ├── id (主键)
        ├── sessionId (索引)
        ├── role
        ├── content (全文索引)
        ├── timestamp
        └── projectPath (索引)
```

### ✅ 职责
- **消息级搜索**：在消息内容中搜索具体关键词
- **实时访问**：渲染进程直接访问，无需 IPC
- **消息缓存**：加速消息加载，减少磁盘 I/O
- **细粒度查询**：支持按角色、时间范围等条件筛选消息

### 🎯 使用场景
- **Assistant 页面**：聊天时快速搜索历史消息
- **消息详情**：查看包含特定关键词的消息上下文
- **实时过滤**：按用户/助手角色过滤消息
- **消息恢复**：从 JSONL 备份自动恢复到 IndexedDB

### 🔍 搜索流程
```
用户输入 "如何实现"
    ↓
ConversationDatabase.search()
    使用 Lunr.js 分词 + 全文索引
    ↓
返回匹配的消息列表（带上下文）
```

---

## 数据同步策略

### 写入流程
```
用户发送消息
    ↓
1. 保存到 JSON 文件 (SessionStorageService)  ← 主数据源
    ↓
2. 更新 SQLite FTS5 索引 (SearchIndexService)  ← 自动同步
    ↓
3. 保存到 IndexedDB (ConversationDatabase)    ← 自动同步
```

### 读取流程

#### History 页面（会话级）
```
用户搜索 "图片功能"
    ↓
SQLite FTS5 搜索
    ↓
返回匹配的会话列表
    ↓
点击会话 → 从 JSON 文件加载完整数据
```

#### Assistant 页面（消息级）
```
用户搜索历史消息
    ↓
IndexedDB 搜索
    ↓
返回匹配的消息列表（带会话ID）
    ↓
点击消息 → 定位到对应会话位置
```

---

## 为什么需要三层存储？

### 1. 性能优化
- **JSON 文件**：可靠但搜索慢（需要读取所有文件）
- **SQLite FTS5**：会话搜索快（分词 + 索引）
- **IndexedDB**：消息搜索快（前端直接访问）

### 2. 职责分离
- **JSON**：负责数据存储
- **SQLite**：负责会话级搜索
- **IndexedDB**：负责消息级搜索

### 3. 容错性
- JSON 文件损坏 → 可从 JSONL 备份恢复
- SQLite 索引损坏 → 可从 JSON 文件重建
- IndexedDB 丢失 → 可从 JSON/JSONL 恢复

---

## 最佳实践

### ✅ 推荐做法

1. **History 页面**：使用 SQLite FTS5 搜索
   ```typescript
   await searchWithFTS5("如何实现", {
     projectPath: selectedProject,
     sortBy: 'relevance'
   });
   ```

2. **Assistant 页面**：使用 IndexedDB 搜索
   ```typescript
   await searchIndexedDB("错误信息", {
     sessionId: currentSession,
     role: 'assistant'
   });
   ```

3. **数据备份**：定期备份 `ChatHistory` 文件夹

### ❌ 避免的做法

1. 不要在 Assistant 页面使用 SQLite FTS5（会增加 IPC 开销）
2. 不要在 History 页面使用 IndexedDB（会话级搜索不如 SQLite 快）
3. 不要直接修改 SQLite 或 IndexedDB（应通过 API 修改）

---

## 未来优化方向

1. **增量索引**：只更新变化的会话，避免全量重建
2. **索引压缩**：使用 VACUUM 压缩 SQLite 数据库
3. **分布式索引**：大型项目可考虑 Elasticsearch
4. **智能缓存**：基于访问频率的 LRU 缓存策略

---

## 总结

| 存储方案 | 用途 | 优势 | 使用场景 |
|---------|------|------|---------|
| **JSON 文件** | 主数据源 | 可靠、可读、可备份 | 所有数据操作 |
| **SQLite FTS5** | 会话搜索 | 快速、多语言分词 | History 页面搜索 |
| **IndexedDB** | 消息搜索 | 实时、细粒度 | Assistant 页面搜索 |

**结论：三层存储各司其职，保留所有三种方案是最佳选择！**
