# ClaudeMate - Enterprise Electron Application

A production-ready Electron + React + TypeScript application with focus on extensibility, memory safety, and performance.

## 🏗️ Architecture Overview

### Core Principles

1. **Type Safety**: Full TypeScript coverage with strict mode
2. **Memory Safety**: Built-in memory monitoring and leak prevention
3. **Extensibility**: Modular architecture with clear separation of concerns
4. **Performance**: Code splitting, lazy loading, and optimized builds
5. **Security**: Sandboxed renderer, contextBridge, CSP headers

### Project Structure

```
claude-skills-app/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── index.ts            # Entry point
│   │   ├── managers/           # System managers
│   │   │   ├── WindowManager.ts    # Window lifecycle
│   │   │   └── IPCManager.ts       # IPC communication
│   │   ├── monitors/           # System monitoring
│   │   │   ├── MemoryMonitor.ts    # Memory usage tracking
│   │   │   └── PerformanceMonitor.ts
│   │   ├── preload/            # Preload scripts
│   │   │   └── index.ts        # Context bridge
│   │   └── utils/              # Utilities
│   │       └── Logger.ts       # Logging system
│   │
│   ├── renderer/               # React Renderer Process
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Main app component
│   │   ├── components/        # Reusable components
│   │   │   ├── layout/        # Layout components
│   │   │   └── common/        # Common components
│   │   ├── modules/           # Feature modules
│   │   │   ├── Assistant/     # AI chat module
│   │   │   ├── Projects/      # Project management
│   │   │   ├── FileExplorer/  # File browser
│   │   │   ├── ChatHistory/   # History search
│   │   │   ├── Settings/      # App settings
│   │   │   └── Workflow/      # Node editor
│   │   ├── stores/            # State management (Zustand)
│   │   │   ├── themeStore.ts
│   │   │   └── appStore.ts
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useIPC.ts
│   │   │   └── useMemoryMonitor.ts
│   │   └── styles/            # Global styles
│   │
│   └── shared/                 # Shared code
│       ├── types/              # TypeScript types
│       │   ├── ipc.types.ts   # IPC type definitions
│       │   └── domain.types.ts # Domain models
│       └── utils/              # Shared utilities
│
├── dist/                       # Build output
├── release/                    # Packaged apps
└── scripts/                    # Build and maintenance scripts
```

## 🚀 Key Features

### 1. Type-Safe IPC Communication

All IPC communication is fully typed and validated:

```typescript
// Renderer Process
const result = await window.electronAPI.invoke<ProjectData>(
  IPCChannels.PROJECT_CREATE,
  { name: 'My Project', path: '/path' }
);
```

- Runtime validation with Zod
- Compile-time type checking
- Automatic error handling
- Rate limiting (100 req/s per channel)

### 2. Memory Management

Automatic memory monitoring and leak prevention:

- Real-time memory usage tracking
- Three-level warnings (warning/critical/emergency)
- Automatic cache cleanup
- Forced garbage collection when needed
- Configurable thresholds

```typescript
// Default thresholds
{
  warning: 512 MB,
  critical: 1024 MB,
  emergency: 1536 MB
}
```

### 3. Modular Architecture

Clean separation with lazy loading:

```typescript
// Modules are lazy-loaded for better performance
const Assistant = lazy(() => import('./modules/Assistant'));
const Workflow = lazy(() => import('./modules/Workflow'));
```

Benefits:
- Smaller initial bundle size
- Faster startup time
- Better code organization
- Easy to add new modules

### 4. State Management

Using Zustand with Immer for immutable updates:

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

Benefits:
- Type-safe
- Minimal boilerplate
- DevTools support
- Immutable by default

### 5. VSCode-like UI

Full VSCode theme support:

- Custom title bar (frameless window)
- Dark/Light theme switching
- VSCode color palette
- Smooth transitions
- Custom scrollbars

## 📦 Installation & Setup

### Prerequisites

- Node.js 18+ LTS
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Development

```bash
# Start dev server (Vite + Electron)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Build

```bash
# Build for production
npm run build

# Package app
npm run package
```

### Release

To upload a release to GitHub (requires GitHub Token):

```bash
# 1. Set GitHub Token
set GITHUB_TOKEN=your_token

# 2. Run upload script (uploads to GitHub Releases)
node scripts/upload-release.js <owner/repo> [tag]

# Example
node scripts/upload-release.js jackySun521/claudate v1.0.0
```

## 🔒 Security Features

### 1. Context Isolation

Renderer process is fully sandboxed:

```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
}
```

### 2. Content Security Policy

Strict CSP headers in HTML:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
" />
```

### 3. IPC Security

- Origin validation
- Rate limiting
- Input validation (Zod)
- Permission checks

## 🎯 Performance Optimizations

### 1. Code Splitting

```typescript
// Vite config
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

### 2. Lazy Loading

All feature modules are lazy-loaded:
- Initial bundle: ~200KB (gzipped)
- Modules loaded on demand
- Suspense boundaries for loading states

### 3. Memory Optimization

- Periodic cache clearing (every 30 minutes)
- Component cleanup on unmount
- Event listener cleanup
- Weak references where applicable

## 🧩 Extending the Application

### Adding a New Module

1. Create module directory:
```bash
src/renderer/modules/MyModule/
├── index.tsx
├── components/
├── hooks/
└── types.ts
```

2. Add route in App.tsx:
```typescript
const MyModule = lazy(() => import('./modules/MyModule'));

<Route path="/my-module" element={<MyModule />} />
```

3. Add navigation item in Sidebar.tsx

### Adding IPC Handlers

1. Define channel in `shared/types/ipc.types.ts`:
```typescript
export const IPCChannels = {
  MY_CHANNEL: 'my:channel',
  // ...
} as const;
```

2. Add schema (optional):
```typescript
export const MyDataSchema = z.object({
  id: z.string(),
  name: z.string(),
});
```

3. Register handler in `main/managers/IPCManager.ts`:
```typescript
this.register(
  IPCChannels.MY_CHANNEL,
  async (data) => {
    // Handler logic
    return result;
  },
  MyDataSchema // Optional validator
);
```

4. Call from renderer:
```typescript
const result = await window.electronAPI.invoke(
  IPCChannels.MY_CHANNEL,
  { id: '123', name: 'Test' }
);
```

## 📊 Monitoring & Debugging

### Memory Monitoring

View memory usage in:
- Status bar (bottom right)
- DevTools console
- Main process logs

### Logging

Logs are saved to:
- Development: Console only
- Production: `{userData}/logs/main.log`

### Performance

Use built-in performance monitor:

```typescript
const stats = await window.electronAPI.invoke(IPCChannels.PERF_STATS);
console.log('CPU:', stats.cpu, '%');
console.log('Memory:', stats.memory.rss / 1024 / 1024, 'MB');
```

## 🔧 Configuration

### Memory Thresholds

Edit in `main/monitors/MemoryMonitor.ts`:

```typescript
private thresholds: MemoryThresholds = {
  warning: 512,   // MB
  critical: 1024, // MB
  emergency: 1536 // MB
};
```

### Theme

Edit VSCode colors in `tailwind.config.js`:

```javascript
colors: {
  vscode: {
    'editor-bg': '#1e1e1e',
    'accent': '#007acc',
    // ...
  }
}
```

## 🐛 Troubleshooting

### Memory Issues

If memory usage is high:
1. Check DevTools Memory profiler
2. Look for detached DOM nodes
3. Check for uncleaned event listeners
4. Review large data structures

### IPC Errors

If IPC calls fail:
1. Check channel name matches
2. Verify data schema
3. Check rate limits
4. Review main process logs

### Build Errors

If build fails:
1. Clear dist: `rm -rf dist`
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Check TypeScript errors: `npm run type-check`

## 📚 Next Steps

### Recommended Additions

1. **Testing**
   - Vitest for unit tests
   - Playwright for E2E tests

2. **CI/CD**
   - GitHub Actions workflow
   - Automated releases

3. **Additional Features**
   - Database integration (SQLite)
   - Full-text search (Meilisearch)
   - Claude CLI integration
   - Workflow engine (Reactflow)

4. **Performance**
   - Virtual scrolling for large lists
   - Web Workers for heavy computation
   - IndexedDB for offline storage

## 📝 License

MIT

## 👥 Contributors

ClaudeMate Team

---

**Built with ❤️ using Electron + React + TypeScript**
