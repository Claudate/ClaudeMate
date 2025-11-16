# Claudate - AI-Powered Desktop Assistant

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Electron](https://img.shields.io/badge/Electron-28-47848F)
![React](https://img.shields.io/badge/React-18-61DAFB)

A production-ready desktop application built with Electron, React, and TypeScript, featuring Claude AI integration for intelligent assistance.

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🤖 AI Assistant Integration
- **Claude AI Integration**: Seamless integration with Anthropic's Claude Code CLI
- **Intelligent Chat**: Natural language conversation with AI
- **Code Understanding**: AI-powered code analysis and suggestions
- **Multi-language Support**: Chinese, English, and Japanese tokenization

### 🎨 Modern UI/UX
- **VSCode-inspired Interface**: Familiar and intuitive design
- **Dark/Light Themes**: Automatic theme switching
- **Responsive Layout**: Adaptive UI for different screen sizes
- **Custom Title Bar**: Native-like frameless window

### 📁 Project Management
- **Project Browser**: Easy project navigation and management
- **File Explorer**: Built-in file browser with search
- **Chat History**: Full conversation history with powerful search

### 🔒 Security & Performance
- **Sandboxed Renderer**: Secure context isolation
- **Memory Management**: Automatic monitoring and leak prevention
- **Type Safety**: Full TypeScript coverage with strict mode
- **Optimized Builds**: Code splitting and lazy loading

---

## 🚀 Installation

### Prerequisites

- **Node.js** 18+ LTS ([Download](https://nodejs.org/))
- **Claude CLI** (optional, for AI features) - Install via:
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/claudate.git
   cd claudate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   npm run package
   ```

---

## 📖 Usage

### Basic Operations

**Starting a Chat**
1. Click on "Assistant" in the navigation bar
2. Type your question or request
3. Press Enter or click Send
4. View AI responses in real-time

**Managing Projects**
1. Navigate to "Projects" tab
2. Click "Add Project" to browse for a project folder
3. Select and open projects from the list

**Searching History**
1. Go to "History" tab
2. Use the search bar to find past conversations
3. Filter by project, date, or keywords

### Configuration

**Claude CLI Setup** (for AI features)

If Claude CLI is not detected:
1. Install Claude CLI globally:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
2. Authenticate (will open browser):
   ```bash
   claude auth login
   ```
3. Restart the application

**Theme Switching**
- The app automatically matches your system theme
- Manual switching available in the title bar

---

## 🏗 Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript
- **Desktop Framework**: Electron 28
- **Build Tool**: Vite 5
- **State Management**: Zustand + Immer
- **Styling**: Tailwind CSS + VSCode Theme
- **Database**: Better-SQLite3 + IndexedDB
- **AI Integration**: Claude Code CLI

### Project Structure

```
claudate/
├── src/
│   ├── main/              # Electron main process
│   │   ├── managers/      # Window & IPC managers
│   │   ├── monitors/      # Performance monitoring
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   ├── renderer/          # React frontend
│   │   ├── modules/       # Feature modules
│   │   │   ├── Assistant/ # AI chat interface
│   │   │   ├── Projects/  # Project management
│   │   │   ├── FileExplorer/
│   │   │   └── ChatHistory/
│   │   ├── components/    # Reusable UI components
│   │   ├── stores/        # State management
│   │   └── hooks/         # Custom React hooks
│   └── shared/            # Shared types & utils
├── dist/                  # Build output
├── release/               # Packaged applications
└── docs/                  # Additional documentation
```

### Core Principles

1. **Type Safety**: Full TypeScript coverage with strict mode
2. **Security**: Sandboxed renderer with context isolation
3. **Performance**: Code splitting, lazy loading, memory monitoring
4. **Modularity**: Clean separation of concerns
5. **Extensibility**: Easy to add new features and modules

---

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run dev:vite         # Start Vite dev server only
npm run dev:electron     # Start Electron only

# Building
npm run build            # Build for production
npm run build:vite       # Build renderer process
npm run build:electron   # Build main process
npm run package          # Package into executable

# Quality Assurance
npm run type-check       # TypeScript type checking
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm test                 # Run tests
```

### Adding New Features

#### 1. Create a New Module

```typescript
// src/renderer/modules/MyModule/index.tsx
import React from 'react';

export default function MyModule() {
  return (
    <div className="h-full flex flex-col">
      <h1>My New Module</h1>
      {/* Your UI here */}
    </div>
  );
}
```

#### 2. Add Route

```typescript
// src/renderer/App.tsx
const MyModule = lazy(() => import('./modules/MyModule'));

<Route path="/my-module" element={<MyModule />} />
```

#### 3. Add Navigation

```typescript
// src/renderer/components/layout/TitleBar.tsx
const navItems: NavItem[] = [
  // ... existing items
  {
    path: '/my-module',
    label: 'My Module',
    icon: 'codicon-symbol-module',
  },
];
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Contribution Guidelines

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code structure
- Add appropriate comments for complex logic
- Ensure all tests pass before submitting PR

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Anthropic** - Claude AI integration
- **Electron** - Desktop framework
- **React** - UI framework
- **VSCode** - UI/UX inspiration

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/claudate/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/claudate/discussions)

---

<div align="center">

**Built with ❤️ using Electron + React + TypeScript**

[⬆ Back to Top](#claudate---ai-powered-desktop-assistant)

</div>
