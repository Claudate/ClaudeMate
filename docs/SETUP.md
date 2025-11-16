# 🔧 开发环境设置指南

本文档指导您完成 Claude Skills 的开发环境配置。

## 📋 系统要求

### 必需软件

1. **Node.js 18+ LTS**
   - 下载地址: https://nodejs.org/
   - 推荐版本: Node.js 20 LTS
   - 验证安装: `node --version`

2. **npm 或 yarn**
   - npm 自带 Node.js
   - yarn 安装: `npm install -g yarn`

3. **Git** (可选，用于版本控制)
   - 下载地址: https://git-scm.com/

### 推荐软件

1. **Visual Studio Code**
   - 下载地址: https://code.visualstudio.com/
   - 推荐扩展:
     - ESLint
     - Prettier
     - TypeScript and JavaScript Language Features
     - Tailwind CSS IntelliSense

2. **Python 3** (用于 node-gyp 编译原生模块)
   - 下载地址: https://www.python.org/
   - Windows: 勾选 "Add Python to PATH"

3. **Visual Studio Build Tools** (Windows)
   - 下载地址: https://visualstudio.microsoft.com/downloads/
   - 选择 "Desktop development with C++"

---

## 🚀 快速安装

### 方法 1: 使用批处理脚本 (推荐，Windows)

```batch
# 1. 双击运行安装脚本
install.bat

# 2. 启动开发环境
dev.bat
```

### 方法 2: 手动安装

```bash
# 1. 进入项目目录
cd H:\Electron\claude-skills-app

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

---

## 📦 依赖安装详情

### 安装过程

运行 `npm install` 时会安装以下包:

```
核心框架:
├── electron@28.2.0           # 桌面应用框架
├── react@18.2.0              # UI 框架
├── react-dom@18.2.0          # React DOM 渲染器
└── react-router-dom@6.21.3   # 路由管理

开发工具:
├── typescript@5.3.3          # 类型系统
├── vite@5.0.12               # 构建工具
├── @vitejs/plugin-react-swc  # React 插件 (使用 SWC)
├── tsx@4.7.0                 # TypeScript 执行器
└── concurrently@8.2.2        # 并发运行脚本

样式:
├── tailwindcss@3.4.1         # CSS 框架
├── autoprefixer@10.4.17      # CSS 后处理器
└── postcss@8.4.33            # CSS 转换工具

状态管理:
├── zustand@4.5.0             # 状态管理
└── immer@10.0.3              # 不可变更新

工具库:
├── zod@3.22.4                # Schema 验证
├── nanoid@5.0.4              # ID 生成
├── electron-store@10.0.0     # 数据持久化
└── electron-log@5.1.0        # 日志系统

代码质量:
├── eslint@8.56.0             # 代码检查
├── @typescript-eslint/*      # TypeScript ESLint 插件
└── vitest@1.2.1              # 测试框架

打包:
└── electron-builder@24.9.1   # 应用打包工具
```

**总大小: ~300-400 MB**
**安装时间: 3-5 分钟** (取决于网络速度)

### 国内加速 (可选)

如果下载速度慢，可以使用淘宝镜像:

```bash
# 临时使用
npm install --registry=https://registry.npmmirror.com

# 永久配置
npm config set registry https://registry.npmmirror.com

# Electron 镜像
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
```

---

## 🛠️ 开发工具配置

### VS Code 设置

创建 `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### 推荐的 VS Code 扩展

创建 `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

---

## ⚙️ 开发命令

### 核心命令

```bash
# 开发模式 (热重载)
npm run dev
# 或
dev.bat

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 自动修复
npm run lint:fix

# 测试
npm test
```

### 构建命令

```bash
# 构建项目
npm run build
# 或
build.bat

# 打包应用
npm run package
# 或
package-app.bat

# 预览构建结果
npm run preview
```

---

## 🐛 常见问题

### 问题 1: npm install 失败

**症状**: 安装过程中出现错误

**解决方法**:

```bash
# 1. 清理缓存
npm cache clean --force

# 2. 删除 node_modules
rmdir /s /q node_modules
del package-lock.json

# 3. 重新安装
npm install
```

### 问题 2: Python 相关错误

**症状**: `node-gyp` 找不到 Python

**解决方法**:

```bash
# Windows: 安装 windows-build-tools
npm install --global windows-build-tools

# 或手动指定 Python 路径
npm config set python "C:\Python39\python.exe"
```

### 问题 3: Electron 下载失败

**症状**: Electron 二进制文件下载超时

**解决方法**:

```bash
# 使用国内镜像
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install electron

# 或手动下载并设置缓存
# 1. 从镜像下载: https://npmmirror.com/mirrors/electron/28.2.0/
# 2. 放到: %LOCALAPPDATA%\electron\Cache\
```

### 问题 4: TypeScript 错误

**症状**: 大量 TypeScript 类型错误

**解决方法**:

```bash
# 1. 确保使用正确的 TypeScript 版本
npm list typescript

# 2. 清理并重建
npm run type-check

# 3. 重启 VS Code TypeScript 服务器
# Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

### 问题 5: 端口被占用

**症状**: `Port 5173 is already in use`

**解决方法**:

```bash
# Windows: 查找并结束进程
netstat -ano | findstr :5173
taskkill /PID <进程ID> /F

# 或修改端口 (vite.config.ts)
server: {
  port: 5174,
}
```

---

## 📊 开发环境检查

### 验证安装

运行以下命令确认环境正确:

```bash
# 1. Node.js 版本
node --version
# 期望输出: v18.x.x 或更高

# 2. npm 版本
npm --version
# 期望输出: 9.x.x 或更高

# 3. TypeScript 版本
npx tsc --version
# 期望输出: Version 5.3.3

# 4. 项目依赖检查
npm list --depth=0
# 应该看到所有依赖正常安装
```

### 健康检查脚本

创建 `check-env.bat`:

```batch
@echo off
echo Checking development environment...
echo.

echo Node.js version:
node --version
if %ERRORLEVEL% NEQ 0 echo ERROR: Node.js not found!
echo.

echo npm version:
npm --version
if %ERRORLEVEL% NEQ 0 echo ERROR: npm not found!
echo.

echo TypeScript version:
call npx tsc --version
if %ERRORLEVEL% NEQ 0 echo ERROR: TypeScript not found!
echo.

echo Checking node_modules...
if exist "node_modules\" (
    echo OK: Dependencies installed
) else (
    echo WARNING: Dependencies not installed. Run install.bat
)
echo.

pause
```

---

## 🔍 IDE 调试配置

### VS Code 调试 (Main Process)

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std",
      "sourceMaps": true
    }
  ]
}
```

### Chrome DevTools (Renderer Process)

开发模式下自动打开，或按 `F12` 打开。

---

## 🎓 学习资源

### 官方文档

- [Electron 文档](https://www.electronjs.org/docs/latest/)
- [React 文档](https://react.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Vite 指南](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### 视频教程

- [Electron 入门](https://www.youtube.com/results?search_query=electron+tutorial)
- [React 18 新特性](https://www.youtube.com/results?search_query=react+18+tutorial)
- [TypeScript 深入浅出](https://www.youtube.com/results?search_query=typescript+tutorial)

---

## ✅ 设置完成检查清单

安装完成后，确认以下项目:

- [ ] Node.js 18+ 已安装
- [ ] `npm install` 成功完成
- [ ] `npm run dev` 可以启动应用
- [ ] 应用窗口正常显示
- [ ] 热重载 (HMR) 工作正常
- [ ] `npm run type-check` 无错误
- [ ] `npm run lint` 无错误
- [ ] VS Code 扩展已安装
- [ ] DevTools 可以打开 (F12)
- [ ] 可以在模块间导航

如果所有项都 ✅，恭喜！开发环境配置完成！

---

## 🆘 获取帮助

如果遇到问题:

1. 查看本文档的 **常见问题** 部分
2. 查看项目 [README.md](README.md)
3. 搜索 [GitHub Issues](https://github.com/electron/electron/issues)
4. 访问 [Electron Discord](https://discord.gg/electronjs)

---

**祝开发顺利! 🚀**
