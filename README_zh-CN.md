# ClaudeMate - 企业级 Electron 应用

[English](README.md) | **中文**

基于 Electron + React + TypeScript 构建的企业级应用，专注于可扩展性、内存安全和高性能。

## 🏗️ 架构概览

### 核心原则

1. **类型安全**：全覆盖的 TypeScript 严格模式
2. **内存安全**：内置内存监控和泄漏预防机制
3. **可扩展性**：关注点分离的模块化架构
4. **高性能**：代码分割、懒加载和构建优化
5. **安全性**：沙箱化渲染进程、contextBridge、CSP 头

### 项目结构

```
claude-skills-app/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts            # 入口点
│   │   ├── managers/           # 系统管理器
│   │   │   ├── WindowManager.ts    # 窗口生命周期
│   │   │   └── IPCManager.ts       # IPC 通信
│   │   ├── monitors/           # 系统监控
│   │   │   ├── MemoryMonitor.ts    # 内存使用跟踪
│   │   │   └── PerformanceMonitor.ts
│   │   ├── preload/            # 预加载脚本
│   │   │   └── index.ts        # Context bridge
│   │   └── utils/              # 工具类
│   │       └── Logger.ts       # 日志系统
│   │
│   ├── renderer/               # React 渲染进程
│   │   ├── main.tsx           # React 入口点
│   │   ├── App.tsx            # 主应用组件
│   │   ├── components/        # 可复用组件
│   │   │   ├── layout/        # 布局组件
│   │   │   └── common/        # 通用组件
│   │   ├── modules/           # 功能模块
│   │   │   ├── Assistant/     # AI 助手模块
│   │   │   ├── Projects/      # 项目管理
│   │   │   ├── FileExplorer/  # 文件浏览器
│   │   │   ├── ChatHistory/   # 历史记录搜索
│   │   │   ├── Settings/      # 应用设置
│   │   │   └── Workflow/      # 节点编辑器
│   │   ├── stores/            # 状态管理 (Zustand)
│   │   │   ├── themeStore.ts
│   │   │   └── appStore.ts
│   │   ├── hooks/             # 自定义 React hooks
│   │   │   ├── useIPC.ts
│   │   │   └── useMemoryMonitor.ts
│   │   └── styles/            # 全局样式
│   │
│   └── shared/                 # 共享代码
│       ├── types/              # TypeScript 类型
│       │   ├── ipc.types.ts   # IPC 类型定义
│       │   └── domain.types.ts # 领域模型
│       └── utils/              # 共享工具
│
├── dist/                       # 构建输出
├── release/                    # 打包应用
└── scripts/                    # 构建和维护脚本
```

## 🚀 主要特性

### 1. 类型安全的 IPC 通信

所有 IPC 通信都经过完全类型化和验证：

```typescript
// 渲染进程
const result = await window.electronAPI.invoke<ProjectData>(
  IPCChannels.PROJECT_CREATE,
  { name: 'My Project', path: '/path' }
);
```

- 使用 Zod 进行运行时验证
- 编译时类型检查
- 自动错误处理
- 速率限制（每个通道 100 req/s）

### 2. 内存管理

自动内存监控和泄漏预防：

- 实时内存使用跟踪
- 三级预警（警告/严重/紧急）
- 自动缓存清理
- 必要时强制垃圾回收
- 可配置阈值

```typescript
// 默认阈值
{
  warning: 512 MB,
  critical: 1024 MB,
  emergency: 1536 MB
}
```

### 3. 模块化架构

清晰的分离与懒加载：

```typescript
// 模块懒加载以提高性能
const Assistant = lazy(() => import('./modules/Assistant'));
const Workflow = lazy(() => import('./modules/Workflow'));
```

优势：
- 更小的初始包体积
- 更快的启动时间
- 更好的代码组织
- 易于添加新模块

### 4. 状态管理

使用 Zustand 和 Immer 进行不可变更新：

```typescript
export const useAppStore = create<AppState>()(
  immer((set) => ({
    currentProject: null,
    setCurrentProject: (project) => {
      set((state) => {
        state.currentProject = project;
      });
    },
  }))
);
```

优势：
- 类型安全
- 极简样板代码
- DevTools 支持
- 默认不可变

### 5. 类 VSCode 界面

完整的 VSCode 主题支持：

- 自定义标题栏（无边框窗口）
- 深色/浅色主题切换
- VSCode 配色方案
- 平滑过渡
- 自定义滚动条

## 📦 安装与设置

### 前置要求

- Node.js 18+ LTS
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发

```bash
# 启动开发服务器 (Vite + Electron)
npm run dev

# 类型检查
npm run type-check

# Lint 检查
npm run lint
npm run lint:fix
```

### 构建

```bash
# 生产环境构建
npm run build

# 打包应用
npm run package
```

### 发布

上传发布版本到 GitHub（需要 GitHub Token）：

```bash
# 1. 设置 GitHub Token
set GITHUB_TOKEN=your_token

# 2. 运行上传脚本（上传到 GitHub Releases）
node scripts/upload-release.js <owner/repo> [tag]

# 示例
node scripts/upload-release.js jackySun521/claudate v1.0.0
```

## 🔒 安全特性

### 1. 上下文隔离

渲染进程完全沙箱化：

```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
}
```

### 2. 内容安全策略 (CSP)

HTML 中严格的 CSP 头：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
" />
```

### 3. IPC 安全

- 来源验证
- 速率限制
- 输入验证 (Zod)
- 权限检查

## 🎯 性能优化

### 1. 代码分割

```typescript
// Vite 配置
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'state-vendor': ['zustand', 'immer'],
      },
    },
  },
}
```

### 2. 懒加载

所有功能模块均为懒加载：
- 初始包体积：~200KB (gzip 压缩后)
- 按需加载模块
- 加载状态的 Suspense 边界

### 3. 内存优化

- 定期缓存清理（每 30 分钟）
- 组件卸载时清理
- 事件监听器清理
- 适用处使用弱引用

## 🧩 应用扩展

### 添加新模块

1. 创建模块目录：
```bash
src/renderer/modules/MyModule/
├── index.tsx
├── components/
├── hooks/
└── types.ts
```

2. 在 App.tsx 中添加路由：
```typescript
const MyModule = lazy(() => import('./modules/MyModule'));

<Route path="/my-module" element={<MyModule />} />
```

3. 在 Sidebar.tsx 中添加导航项

### 添加 IPC 处理程序

1. 在 `shared/types/ipc.types.ts` 中定义通道：
```typescript
export const IPCChannels = {
  MY_CHANNEL: 'my:channel',
  // ...
} as const;
```

2. 添加 Schema（可选）：
```typescript
export const MyDataSchema = z.object({
  id: z.string(),
  name: z.string(),
});
```

3. 在 `main/managers/IPCManager.ts` 中注册处理程序：
```typescript
this.register(
  IPCChannels.MY_CHANNEL,
  async (data) => {
    // 处理逻辑
    return result;
  },
  MyDataSchema // 可选验证器
);
```

4. 从渲染进程调用：
```typescript
const result = await window.electronAPI.invoke(
  IPCChannels.MY_CHANNEL,
  { id: '123', name: 'Test' }
);
```

## 📊 监控与调试

### 内存监控

查看内存使用情况：
- 状态栏（右下角）
- DevTools 控制台
- 主进程日志

### 日志

日志保存位置：
- 开发环境：仅控制台
- 生产环境：`{userData}/logs/main.log`

### 性能

使用内置性能监视器：

```typescript
const stats = await window.electronAPI.invoke(IPCChannels.PERF_STATS);
console.log('CPU:', stats.cpu, '%');
console.log('Memory:', stats.memory.rss / 1024 / 1024, 'MB');
```

## 🔧 配置

### 内存阈值

在 `main/monitors/MemoryMonitor.ts` 中编辑：

```typescript
private thresholds: MemoryThresholds = {
  warning: 512,   // MB
  critical: 1024, // MB
  emergency: 1536 // MB
};
```

### 主题

在 `tailwind.config.js` 中编辑 VSCode 颜色：

```javascript
colors: {
  vscode: {
    'editor-bg': '#1e1e1e',
    'accent': '#007acc',
    // ...
  }
}
```

## 🐛 故障排除

### 内存问题

如果内存使用率过高：
1. 检查 DevTools 内存分析器
2. 查找分离的 DOM 节点
3. 检查未清理的事件监听器
4. 审查大数据结构

### IPC 错误

如果 IPC 调用失败：
1. 检查通道名称是否匹配
2. 验证数据 Schema
3. 检查速率限制
4. 查看主进程日志

### 构建错误

如果构建失败：
1. 清理 dist：`rm -rf dist`
2. 清理 node_modules：`rm -rf node_modules && npm install`
3. 检查 TypeScript 错误：`npm run type-check`

## 📚 后续步骤

### 推荐添加

1. **测试**
   - 单元测试 (Vitest)
   - E2E 测试 (Playwright)

2. **CI/CD**
   - GitHub Actions 工作流
   - 自动发布

3. **附加功能**
   - 数据库集成 (SQLite)
   - 全文搜索 (Meilisearch)
   - Claude CLI 集成
   - 工作流引擎 (Reactflow)

4. **性能**
   - 大列表虚拟滚动
   - 重型计算使用 Web Workers
   - 离线存储使用 IndexedDB

## 🤝 加入社区

欢迎大家参与开发，共同完善 ClaudeMate！

- **工作流 (Workflow)** 功能正在积极开发中，尚未完成，欢迎贡献代码或提出建议。
- 扫码加入微信交流群，获取最新动态：

<img src="public/wechat_1206.png" width="200" />

## 📝 许可证

GPL-3.0

## 👥 贡献者

ClaudeMate 团队

---

**Built with ❤️ using Electron + React + TypeScript**
