# Claude CLI 命令参数完整参考文档

> 最后更新：2025年
> 官方文档：https://code.claude.com/docs/en/cli-reference

## 目录
- [核心命令](#核心命令)
- [输入输出标志](#输入输出标志)
- [系统提示词定制](#系统提示词定制)
- [工具与权限控制](#工具与权限控制)
- [会话与模型管理](#会话与模型管理)
- [高级配置](#高级配置)
- [使用示例](#使用示例)

---

## 核心命令

### 基础使用

```bash
# 启动交互式 REPL
claude

# 带初始提示启动
claude "explain this project"

# SDK 模式（非交互，执行后退出）
claude -p "explain this function"

# 通过管道输入
cat logs.txt | claude -p "explain these errors"

# 继续最近的对话
claude -c

# 在 SDK 模式下继续对话
claude -c -p "Check for type errors"

# 恢复特定会话
claude -r "<session-id>" "Finish this PR"

# 更新到最新版本
claude update

# 配置 MCP 服务器
claude mcp
```

---

## 输入输出标志

### `-p, --print`
**功能：** 非交互模式，打印响应后退出

**使用场景：**
- 脚本自动化
- CI/CD 集成
- 管道处理

**示例：**
```bash
claude -p "summarize this code" < main.py
```

### `--output-format <format>`
**功能：** 指定输出格式

**选项：**
- `text` - 纯文本输出（默认）
- `json` - 单次 JSON 结果
- `stream-json` - 实时流式 JSON 事件

**示例：**
```bash
# 流式 JSON 输出（用于实时 UI 更新）
claude -p --output-format stream-json "write a script"

# JSON 输出（用于脚本解析）
claude -p --output-format json "analyze code"
```

### `--input-format <format>`
**功能：** 设置输入格式

**选项：**
- `text` - 纯文本输入（默认）
- `stream-json` - 流式 JSON 输入

### `--include-partial-messages`
**功能：** 包含部分消息块（流式输出时）

**要求：** 必须与 `--print` 和 `--output-format stream-json` 一起使用

**示例：**
```bash
claude -p --output-format stream-json --include-partial-messages "write code"
```

---

## 系统提示词定制

> ⚠️ 以下三个选项互斥，只能使用一个

### `--system-prompt <prompt>`
**功能：** 完全替换默认系统提示词

**适用模式：** 交互模式 + Print 模式

**警告：** 会覆盖 Claude Code 的内置能力，谨慎使用

**示例：**
```bash
claude -p --system-prompt "You are a Python expert. Only write Python code." "create a timer"
```

### `--system-prompt-file <file>`
**功能：** 从文件加载系统提示词

**适用模式：** 仅 Print 模式

**示例：**
```bash
claude -p --system-prompt-file ./prompts/python-expert.txt "write code"
```

### `--append-system-prompt <prompt>` ⭐ 推荐
**功能：** 在默认系统提示词末尾追加自定义内容

**适用模式：** 交互模式 + Print 模式

**优势：** 保留 Claude Code 的内置能力，同时添加自定义需求

**示例：**
```bash
claude -p --append-system-prompt "Always add detailed comments to code" "write a function"
```

---

## 工具与权限控制

### `--allowedTools, --allowed-tools <tools...>`
**功能：** 指定允许使用的工具列表（无需用户权限）

**格式：** 逗号或空格分隔

**支持工具：**
- `Task` - 启动子任务
- `Bash` - 执行命令
- `Glob` - 文件匹配
- `Grep` - 内容搜索
- `Read` - 读取文件
- `Edit` - 编辑文件
- `Write` - 写入文件
- `WebFetch` - 网络请求
- `TodoWrite` - 任务管理
- `NotebookEdit` - Jupyter 笔记本编辑

**工具通配符支持：**
```bash
# 允许所有 git 相关的 Bash 命令
--allowed-tools "Bash(git:*)"

# 允许读取特定目录
--allowed-tools "Read(/path/to/dir/**)"
```

**示例：**
```bash
# 只允许读写文件
claude -p --allowed-tools "Read,Write,Edit" "refactor this file"

# 允许所有工具
claude -p --allowed-tools "Task,Bash,Glob,Grep,Read,Edit,Write,WebFetch,TodoWrite,NotebookEdit"
```

### `--disallowedTools, --disallowed-tools <tools...>`
**功能：** 禁止使用的工具列表

**示例：**
```bash
# 禁止执行命令和网络请求
claude -p --disallowed-tools "Bash,WebFetch" "analyze code"
```

### `--permission-mode <mode>`
**功能：** 设置权限模式

**选项：**
- `default` - 默认模式，需要用户确认
- `acceptEdits` - 自动批准编辑操作
- `bypassPermissions` - 跳过所有权限检查（危险！）
- `plan` - 计划模式

**示例：**
```bash
# 自动批准所有编辑
claude -p --permission-mode acceptEdits "fix all bugs"
```

### `--dangerously-skip-permissions`
**功能：** 跳过所有权限检查

**警告：** 仅在沙盒环境中使用！

---

## 会话与模型管理

### `--session-id <uuid>`
**功能：** 使用指定的会话 ID

**用途：** 会话持久化、跨重启恢复对话

**示例：**
```bash
claude -p --session-id "b26446ff-df10-46bd-8537-4986cfa7c22d" "continue our work"
```

### `-r, --resume [sessionId]`
**功能：** 恢复特定会话

**示例：**
```bash
# 交互式选择会话
claude -r

# 恢复指定会话
claude -r "abc123-def456"
```

### `-c, --continue`
**功能：** 继续最近的对话

**示例：**
```bash
claude -c
```

### `--fork-session`
**功能：** 恢复会话时创建新的会话 ID（而非重用原 ID）

**用途：** 创建会话分支

**示例：**
```bash
claude -r "abc123" --fork-session "try a different approach"
```

### `--model <model>`
**功能：** 指定使用的模型

**选项：**
- 别名：`sonnet`, `opus`, `haiku`
- 完整名称：`claude-sonnet-4-5-20250929`, `claude-opus-4-1-20250805`

**示例：**
```bash
# 使用 Sonnet 4.5
claude -p --model sonnet "write code"

# 使用完整模型名
claude -p --model claude-opus-4-1-20250805 "complex analysis"
```

### `--max-turns <number>`
**功能：** 限制 Agent 回合数（防止无限循环）

**示例：**
```bash
claude -p --max-turns 5 "solve this problem"
```

---

## 高级配置

### `--add-dir <path>`
**功能：** 添加额外的工作目录（多项目访问）

**示例：**
```bash
# 访问多个项目
claude --add-dir ../frontend --add-dir ../backend "sync these projects"
```

### `--agents <json>`
**功能：** 动态定义自定义子 Agent

**JSON 结构：**
```json
{
  "agent-name": {
    "description": "何时调用此 Agent",
    "prompt": "Agent 的系统提示词",
    "tools": ["Read", "Write"],  // 可选
    "model": "sonnet"            // 可选
  }
}
```

**示例：**
```bash
claude --agents '{
  "python-expert": {
    "description": "Python code analysis and optimization",
    "prompt": "You are a Python expert. Always write type hints.",
    "tools": ["Read", "Write", "Edit"],
    "model": "sonnet"
  }
}' "optimize my Python code"
```

### `--verbose`
**功能：** 启用详细日志（调试用）

**示例：**
```bash
claude -p --verbose "debug this issue"
```

### `-d, --debug [filter]`
**功能：** 启用调试模式，可选类别过滤

**示例：**
```bash
# 启用所有调试信息
claude -d

# 只调试 API 和 hooks
claude -d "api,hooks"

# 排除 statsig 和 file 调试
claude -d "!statsig,!file"
```

### `--setting-sources <sources>`
**功能：** 指定配置来源

**选项：**
- `user` - 仅用户级配置
- `project` - 项目级配置
- `local` - 本地配置

**示例：**
```bash
# 只使用用户级配置（忽略项目和本地配置）
claude -p --setting-sources user "run task"
```

---

## 使用示例

### 1. 自动化脚本执行
```bash
# 分析日志文件
cat error.log | claude -p --output-format json "summarize these errors"

# 批量处理文件
for file in *.py; do
  claude -p "add type hints to this file" < "$file" > "typed_$file"
done
```

### 2. CI/CD 集成
```bash
# 在 CI 中检查代码
git diff main | claude -p \
  --output-format json \
  --permission-mode acceptEdits \
  "review this diff and suggest improvements"
```

### 3. 会话持久化（Electron 应用）
```javascript
// 启动会话
const sessionId = crypto.randomUUID();
spawn('claude', [
  '--print',
  '--session-id', sessionId,
  '--output-format', 'stream-json',
  '--include-partial-messages',
  '--permission-mode', 'acceptEdits'
]);

// 恢复会话（应用重启后）
spawn('claude', [
  '--print',
  '--session-id', sessionId,  // 使用相同的 ID
  '--output-format', 'stream-json'
]);
```

### 4. 实时流式输出
```bash
# 实时显示 AI 输出
echo "write a long story" | claude -p \
  --output-format stream-json \
  --include-partial-messages \
  --verbose
```

### 5. 自定义系统提示词
```bash
# 创建专门的代码审查 Agent
claude -p \
  --append-system-prompt "Focus on: 1) Security vulnerabilities 2) Performance issues 3) Code style" \
  --allowed-tools "Read,Grep" \
  "review this codebase"
```

---

## 常见问题

### Q: `--output-format` 不生效？
**A:** 确保使用了 `--print` 标志。`--output-format` 只在非交互模式下工作。

### Q: 如何避免 "Session ID is already in use" 错误？
**A:**
1. 确保没有其他进程使用相同的 session ID
2. 清理锁文件：`~/.claude/projects/<project>/<session-id>.lock`
3. 在启动前终止旧进程

### Q: 如何在 Windows 上处理中文路径？
**A:**
1. 设置 UTF-8 编码：`process.stdout.setEncoding('utf8')`
2. 规范化路径：`H:\编剧-脚本\项目` → `h--编剧-脚本--项目`

### Q: 如何调试 Claude CLI 问题？
**A:** 使用 `--verbose` 和 `--debug` 标志：
```bash
claude -p --verbose --debug "api,hooks" "test command"
```

---

## 最佳实践

### 1. 生产环境配置
```bash
claude -p \
  --session-id <uuid> \
  --output-format stream-json \
  --include-partial-messages \
  --permission-mode acceptEdits \
  --allowed-tools "Task,Bash,Glob,Grep,Read,Edit,Write" \
  --setting-sources user \
  --model sonnet
```

### 2. 开发调试配置
```bash
claude -p \
  --verbose \
  --debug "api,hooks" \
  --output-format stream-json \
  "test query"
```

### 3. 安全配置（受限环境）
```bash
claude -p \
  --allowed-tools "Read,Grep" \
  --disallowed-tools "Bash,WebFetch" \
  --permission-mode default \
  "analyze code"
```

---

## 参考资源

- **官方文档：** https://code.claude.com/docs/en/cli-reference
- **GitHub：** https://github.com/anthropics/claude-code
- **更新日志：** `claude --version`
- **帮助信息：** `claude --help`

---

## 版本信息

当前 Claude CLI 版本：`2.0.31 (Claude Code)`

查看版本：
```bash
claude --version
```

更新到最新版本：
```bash
claude update
```
