# 🔧 项目脚本说明

本目录包含所有项目相关的批处理脚本和工具脚本。

## 📦 开发脚本

### `install.bat` - 安装依赖
一键安装项目所有 npm 依赖包。

**使用方法**:
```bash
# 双击运行或命令行执行
scripts\install.bat
```

**功能**:
- 检查 Node.js 环境
- 运行 `npm install`
- 显示安装进度

---

### `dev.bat` - 启动开发服务器
启动 Vite + Electron 开发环境。

**使用方法**:
```bash
scripts\dev.bat
```

**功能**:
- 启动 Vite 开发服务器
- 启动 Electron 应用
- 启用热模块替换（HMR）
- 自动打开 DevTools

---

### `start-dev.bat` - 智能启动（推荐）
自动处理端口占用问题的启动脚本。

**使用方法**:
```bash
scripts\start-dev.bat
```

**功能**:
- 检测端口 5173 是否被占用
- 自动关闭占用进程
- 启动开发服务器
- 错误恢复机制

**推荐场景**:
- 端口经常被占用
- 需要快速重启
- 自动化开发流程

---

## 🏗️ 构建脚本

### `build.bat` - 构建项目
构建生产版本。

**使用方法**:
```bash
scripts\build.bat
```

**功能**:
- TypeScript 编译
- Vite 生产构建
- 代码压缩和优化
- 生成 source maps

**输出目录**: `dist/`

### 🔒 构建加密（混淆）
生产构建完成后会自动执行主进程代码混淆：

**机制**:
- 渲染进程：通过 Vite 插件进行强混淆（生产模式）
- 主进程：执行 `scripts/obfuscate-main.js` 对 `dist/main/**/*.js` 混淆
- 生产环境关闭 sourcemap，防止源码泄露

**手动触发**:
```bash
npm run postbuild:main
```

**注意**:
- 加密仅在生产构建中启用，开发模式保持可读性与调试体验
- 打包时启用 `asar`，进一步提升不可读性（非真正加密）

---

### `package-app.bat` - 打包应用
将应用打包为可分发的安装包。

**使用方法**:
```bash
scripts\package-app.bat
```

**功能**:
- 先执行 build
- 使用 electron-builder 打包
- 生成 Windows/Mac/Linux 安装包

**输出目录**: `release/`

**支持的格式**:
- Windows: `.exe` (NSIS 安装程序), `win-unpacked/` (便携版)
- macOS: `.dmg`, `.app`
- Linux: `.AppImage`, `.deb`

---

## 🧹 维护脚本

### `cleanup-docs.bat` - 清理重复文档
删除项目中的重复文档文件。

**使用方法**:
```bash
scripts\cleanup-docs.bat
```

**功能**:
- 删除已整合的旧文档
- 显示删除进度
- 保留核心文档

**删除文件**:
- `START_HERE.md`
- `HOW_TO_START.md`
- `PROJECT_SUMMARY.md`
- `FINAL_SUMMARY.md`
- `DEVELOPMENT_STARTED.md`

**保留文档**: 参见 [docs/README.md](../docs/README.md)

---

## 📋 快速命令对照表

| 任务 | 脚本 | npm 命令 |
|------|------|----------|
| 安装依赖 | `install.bat` | `npm install` |
| 启动开发 | `dev.bat` | `npm run dev` |
| 智能启动 | `start-dev.bat` | - |
| 类型检查 | - | `npm run type-check` |
| 代码检查 | - | `npm run lint` |
| 构建项目 | `build.bat` | `npm run build` |
| 打包应用 | `package-app.bat` | `npm run package` |
| 清理文档 | `cleanup-docs.bat` | - |

---

## 💡 使用技巧

### Windows 双击运行
所有 `.bat` 脚本都可以直接双击运行，无需打开命令行。

### 命令行运行
```bash
# 在项目根目录
scripts\dev.bat

# 或使用相对路径
.\scripts\dev.bat
```

### PowerShell 运行
```powershell
& ".\scripts\dev.bat"
```

### 添加到系统 PATH（可选）
将 `scripts` 目录添加到系统 PATH，可以在任何位置运行脚本：
```bash
# 设置临时 PATH
set PATH=%PATH%;H:\Electron\claude-skills-app\scripts

# 然后可以直接运行
dev.bat
```

---

## 🔍 故障排除

### 问题 1: 脚本无法运行
**可能原因**: 权限不足

**解决方案**:
1. 右键脚本 → "以管理员身份运行"
2. 或在命令提示符（管理员）中运行

### 问题 2: 找不到命令
**可能原因**: Node.js 未安装或未添加到 PATH

**解决方案**:
1. 安装 Node.js: https://nodejs.org/
2. 重启命令提示符
3. 验证: `node --version`

### 问题 3: 端口占用
**解决方案**:
使用 `start-dev.bat` 自动处理端口占用问题。

---

## 🛠️ 自定义脚本

### 创建新脚本
在 `scripts/` 目录下创建新的 `.bat` 文件：

```batch
@echo off
echo 你的脚本名称
echo.

REM 你的命令
npm run custom-command

echo.
echo 完成！
pause
```

### 脚本模板
```batch
@echo off
setlocal

REM 脚本说明
echo ====================================
echo 脚本功能说明
echo ====================================
echo.

REM 检查环境
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 错误: 未找到 Node.js
    pause
    exit /b 1
)

REM 主要逻辑
cd /d "%~dp0.."
npm run your-command

REM 结束
echo.
echo 完成！
pause
endlocal
```

---

## 📚 相关文档

- [快速开始](../docs/QUICKSTART.md) - 了解如何使用这些脚本
- [环境设置](../docs/SETUP.md) - 开发环境配置
- [项目主页](../README.md) - 项目概览

---

**维护**: Claude Skills Team
**最后更新**: 2025-11-11
