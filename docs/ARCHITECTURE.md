# Architecture Design Document

## 📐 Architecture Overview

### Design Philosophy

This application follows **enterprise-grade architecture principles**:

1. **Separation of Concerns**: Clear boundaries between layers
2. **Type Safety First**: Compile-time error prevention
3. **Memory Safety**: Proactive leak prevention and monitoring
4. **Extensibility**: Easy to add features without modifying core
5. **Testability**: Dependency injection and interface-based design
6. **Performance**: Lazy loading, code splitting, caching strategies

---

## 🏛️ Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (React Components, UI, User Interactions)                  │
│  - modules/Assistant, Projects, Workflow, etc.              │
│  - components/layout, common                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   Application Layer                          │
│  (State Management, Hooks, Business Logic)                  │
│  - stores/themeStore, appStore                             │
│  - hooks/useIPC, useMemoryMonitor                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  (IPC, Services, External Integrations)                     │
│  - IPC communication (type-safe)                           │
│  - Main process managers                                    │
│  - System monitors                                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                      Core Layer                              │
│  (Domain Models, Types, Constants)                          │
│  - shared/types/domain.types                               │
│  - shared/types/ipc.types                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Process Communication

### Main Process ↔ Renderer Process

```
┌───────────────────────┐         ┌───────────────────────┐
│   Renderer Process    │         │    Main Process       │
│   (React/Browser)     │         │    (Node.js)          │
│                       │         │                       │
│  ┌─────────────────┐  │         │  ┌─────────────────┐  │
│  │ React Component │  │         │  │  IPC Manager    │  │
│  └────────┬────────┘  │         │  └────────▲────────┘  │
│           │           │         │           │           │
│           ▼           │         │           │           │
│  ┌─────────────────┐  │         │  ┌────────┴────────┐  │
│  │  useIPC Hook    │  │         │  │  Handler Logic  │  │
│  └────────┬────────┘  │         │  └────────▲────────┘  │
│           │           │         │           │           │
│           ▼           │         │           │           │
│  ┌─────────────────┐  │   IPC   │  ┌────────┴────────┐  │
│  │ electronAPI     │◄─┼────────►│  │  Managers       │  │
│  │ (contextBridge) │  │         │  │  Monitors       │  │
│  └─────────────────┘  │         │  │  Services       │  │
│                       │         │  └─────────────────┘  │
└───────────────────────┘         └───────────────────────┘
```

### IPC Flow

1. **Renderer** calls `window.electronAPI.invoke(channel, data)`
2. **Preload** script forwards via `ipcRenderer.invoke`
3. **Main** process receives via `ipcMain.handle`
4. **IPCManager** validates and routes to handler
5. **Handler** processes and returns result
6. **Response** flows back through same path

---

## 🔐 Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Content Security Policy (CSP)                 │
│   - Restricts script execution                          │
│   - Prevents XSS attacks                                │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 2: Context Isolation + Sandboxing                │
│   - No direct Node.js access from renderer             │
│   - contextBridge for controlled exposure              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 3: IPC Security                                   │
│   - Origin validation                                   │
│   - Rate limiting                                       │
│   - Input validation (Zod)                             │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 4: Permission System (Future)                    │
│   - Role-based access control                          │
│   - Per-channel permissions                            │
└─────────────────────────────────────────────────────────┘
```

### Security Checklist

- ✅ Context isolation enabled
- ✅ Node integration disabled
- ✅ Sandbox enabled
- ✅ CSP headers configured
- ✅ IPC origin validation
- ✅ Rate limiting on IPC calls
- ✅ Input validation with Zod
- ✅ No eval() or Function() constructors
- ✅ External URL validation

---

## 💾 Memory Management

### Memory Monitoring System

```
┌──────────────────────────────────────────────────────────┐
│                   Memory Monitor                         │
│  (Checks every 10 seconds)                              │
└────────────┬─────────────────────────────────────────────┘
             │
             ├─► Warning (512 MB)
             │   └─► Send notification
             │
             ├─► Critical (1024 MB)
             │   └─► Clear caches
             │       └─► Force GC
             │
             └─► Emergency (1536 MB)
                 └─► Aggressive cleanup
                     └─► Notify user
                     └─► Consider restart
```

### Memory Leak Prevention

1. **Component Cleanup**
   ```typescript
   useEffect(() => {
     const subscription = someObservable.subscribe();
     return () => subscription.unsubscribe(); // Cleanup
   }, []);
   ```

2. **Event Listener Cleanup**
   ```typescript
   const unsubscribe = window.electronAPI.on('event', handler);
   return () => unsubscribe(); // Always cleanup
   ```

3. **Weak References**
   - Use WeakMap/WeakSet for caches
   - Avoid circular references

4. **Periodic Cache Clearing**
   - Window cache: Every 30 minutes
   - localStorage: On memory warning
   - State history: Max 100 items

---

## 📊 State Management

### Zustand Store Architecture

```typescript
// Immutable updates with Immer
export const useAppStore = create<AppState>()(
  immer((set) => ({
    data: initialData,
    updateData: (newData) => {
      set((state) => {
        state.data = newData; // Immer makes this immutable
      });
    },
  }))
);
```

### State Organization

```
stores/
├── themeStore.ts          # Theme preferences
├── appStore.ts            # Global app state
├── projectStore.ts        # Project management (future)
├── sessionStore.ts        # Chat sessions (future)
└── workflowStore.ts       # Workflow state (future)
```

### State Flow

```
User Action
    ↓
Component Event Handler
    ↓
Store Action (set)
    ↓
Immer Produces New State
    ↓
React Re-renders
    ↓
UI Updates
```

---

## 🎨 UI Component Architecture

### Component Hierarchy

```
App
├── ErrorBoundary
│   └── BrowserRouter
│       ├── TitleBar (Custom window controls)
│       ├── Main Content
│       │   ├── Sidebar (Navigation)
│       │   └── Routes
│       │       ├── /assistant → Assistant Module
│       │       ├── /projects → Projects Module
│       │       ├── /explorer → FileExplorer Module
│       │       ├── /history → ChatHistory Module
│       │       ├── /workflow → Workflow Module
│       │       └── /settings → Settings Module
│       └── StatusBar (System info)
```

### Module Structure (Standard)

```
Module/
├── index.tsx              # Module entry point
├── components/            # Module-specific components
│   ├── Header.tsx
│   ├── Content.tsx
│   └── Actions.tsx
├── hooks/                 # Module-specific hooks
│   └── useModuleData.ts
├── types.ts               # Module types
└── utils.ts               # Module utilities
```

---

## 🔌 Plugin/Extension System (Future)

### Proposed Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Plugin Manager                         │
│  - Discovery                                             │
│  - Loading                                               │
│  - Lifecycle management                                  │
│  - Security validation                                   │
└────────────┬─────────────────────────────────────────────┘
             │
             ├─► Plugin 1 (Claude Provider)
             │   └─► API: IChatProvider
             │
             ├─► Plugin 2 (Custom Theme)
             │   └─► API: IThemeProvider
             │
             └─► Plugin 3 (Workflow Node)
                 └─► API: INodeProvider
```

### Plugin API (Proposed)

```typescript
interface IPlugin {
  id: string;
  name: string;
  version: string;

  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

interface PluginContext {
  subscriptions: Disposable[];
  registerCommand(id: string, handler: Function): void;
  registerView(location: string, provider: ViewProvider): void;
}
```

---

## 🚀 Performance Optimizations

### 1. Code Splitting Strategy

```
Initial Bundle (200 KB)
├── React core
├── Router
├── State management
└── Base components

Lazy Chunks
├── Assistant.chunk.js (150 KB)
├── Projects.chunk.js (80 KB)
├── Workflow.chunk.js (200 KB)
└── Settings.chunk.js (50 KB)
```

### 2. Lazy Loading Pattern

```typescript
// Route-based code splitting
const Module = lazy(() => import('./Module'));

<Suspense fallback={<LoadingSpinner />}>
  <Module />
</Suspense>
```

### 3. Memoization

```typescript
// Prevent unnecessary re-renders
const MemoizedComponent = memo(Component, (prev, next) => {
  return prev.data.id === next.data.id;
});

// Expensive computations
const result = useMemo(() => expensiveCalc(data), [data]);

// Callback stability
const handler = useCallback(() => {}, [dependencies]);
```

### 4. Virtual Scrolling (Future)

For large lists (chat history, file explorer):
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={10000}
  itemSize={50}
>
  {Row}
</FixedSizeList>
```

---

## 🧪 Testing Strategy

### Test Pyramid

```
        ┌───────────────┐
        │  E2E Tests    │  10%
        │  (Playwright) │
        └───────────────┘
      ┌─────────────────────┐
      │ Integration Tests   │  20%
      │    (Vitest)         │
      └─────────────────────┘
    ┌───────────────────────────┐
    │     Unit Tests            │  70%
    │  (Vitest + Testing Lib)   │
    └───────────────────────────┘
```

### Test Organization

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── utils/
│   ├── integration/
│   │   ├── ipc/
│   │   └── modules/
│   └── e2e/
│       └── workflows/
```

---

## 📈 Scalability Considerations

### Horizontal Scaling

- **Multi-window support**: Each window = separate renderer process
- **Worker threads**: For CPU-intensive tasks (indexing, search)
- **Child processes**: For isolated services (Claude CLI)

### Vertical Scaling

- **Memory limits**: Configurable thresholds
- **Cache strategies**: LRU caches with size limits
- **Database**: SQLite with connection pooling
- **Index optimization**: Lucene.Net with incremental indexing

---

## 🔄 Future Enhancements

### Phase 2 (Next 2 months)

1. **Database Integration**
   - SQLite for persistent storage
   - Migration system
   - Query builder

2. **Full-Text Search**
   - Meilisearch integration
   - Instant search results
   - Filters and facets

3. **Claude CLI Integration**
   - Process management
   - Stream handling
   - Error recovery

4. **Workflow Engine**
   - Reactflow integration
   - Node execution engine
   - Variables and context

### Phase 3 (Months 3-6)

1. **Plugin System**
   - Plugin discovery
   - Sandboxed execution
   - Marketplace

2. **Collaborative Features**
   - Real-time sync
   - Conflict resolution
   - User presence

3. **Advanced Analytics**
   - Usage tracking
   - Performance metrics
   - Error reporting

---

## 📚 References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)

---

**Last Updated**: 2025-01-10
**Version**: 1.0.0
**Maintained By**: Claude Skills Team
