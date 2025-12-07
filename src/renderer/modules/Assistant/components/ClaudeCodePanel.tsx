/**
 * Claude Code Panel
 * VSCode-style Claude AI chat interface with enhanced features:
 * - Color-coded message types (user, assistant, system, error)
 * - Quick copy functionality
 * - Auto-detect and open URLs
 */

import { useRef, useEffect, useState } from 'react';
import { useChatStore, Message } from '../../../stores/chatStore';
import { useProjectStore } from '../../../stores/projectStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import {
  checkClaudeAuthStatus,
  startClaudeAuth,
  getAuthGuidanceMessage,
  getAuthSuccessMessage,
  detectAuthError,
} from '../../../services/claudeAuthService';
import {
  ToolApprovalRequest,
  toolApprovalManager,
} from '../../../services/toolApprovalService';
import { ToolApprovalDialog } from '../../../components/ToolApprovalDialog';
import { SyncStatusBar } from '../../../components/github/SyncStatusBar';
import { IPCChannels } from '@shared/types/ipc.types';
import claudeLogo from '../../../assets/claude_logo.png';

interface ClaudeCodePanelProps {
  // 可以传入其他配置
}

// URL 检测正则
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// 格式化消息持续时间（毫秒 -> 秒，保留2位小数）
function formatMessageDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// 格式化文件大小（字节 -> 可读格式）
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// 格式化 Token 使用量（参照 WPF 的 TokenUsage.DisplayText）
function formatTokenUsage(tokenUsage: any, duration?: number): string {
  if (!tokenUsage) return '';

  const parts: string[] = [];

  // ⭐ 会话时间（如果提供）
  if (duration !== undefined && duration > 0) {
    parts.push(`⏱ ${formatMessageDuration(duration)}`);
  }

  // 基础信息：总量 (输入 + 输出)
  parts.push(`Total: ${tokenUsage.totalTokens.toLocaleString()}`);
  parts.push(`In: ${tokenUsage.inputTokens.toLocaleString()}`);
  parts.push(`Out: ${tokenUsage.outputTokens.toLocaleString()}`);

  // 缓存信息（如果有）
  if (tokenUsage.cacheCreationTokens && tokenUsage.cacheCreationTokens > 0) {
    parts.push(`Cache Created: ${tokenUsage.cacheCreationTokens.toLocaleString()}`);
  }
  if (tokenUsage.cacheReadTokens && tokenUsage.cacheReadTokens > 0) {
    parts.push(`Cache Read: ${tokenUsage.cacheReadTokens.toLocaleString()}`);
  }

  return parts.join(' | ');
}

// 渲染带URL高亮的文本
function renderTextWithLinks(text: string): JSX.Element[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, index) => {
    if (part.match(URL_REGEX)) {
      return (
        <a
          key={index}
          href={part}
          className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            // 在默认浏览器中打开链接
            window.electron?.openExternal(part);
          }}
          title={`点击打开: ${part}`}
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

// ⭐⭐⭐ 文件附件接口（支持图片和其他文件）
interface FileAttachment {
  id: string;
  dataUrl: string;  // base64 data URL
  name: string;
  mimeType: string;
  size: number;
  isImage: boolean;  // 是否是图片
}

export function ClaudeCodePanel({}: ClaudeCodePanelProps) {
  const { messages, isLoading, error, sendMessage, clearMessages, getSessionStats, currentSessionId, pendingInput, clearPendingInput, cancelSession } = useChatStore();
  const { currentProject } = useProjectStore();
  const terminalStore = useTerminalStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageIndex: number; content: string } | null>(null);

  // ⭐⭐⭐ 文件附件状态（支持图片和其他文件）
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);

  // ⭐ 输入框状态
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ⭐⭐⭐ 斜杠命令状态
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCommands] = useState([
    { command: '/help', description: '显示所有可用的斜杠命令' },
    { command: '/clear', description: '清空当前上下文，重置对话' },
    { command: '/compact', description: '压缩对话历史，创建摘要并保留关键信息' },
    { command: '/init', description: '初始化项目，生成 Claude.md 文件' },
    { command: '/rewind', description: '回退到之前的对话状态' },
    { command: '/context', description: '查看当前 token 使用情况' },
    { command: '/permissions', description: '打开权限设置' },
    { command: '/hooks', description: '配置生命周期钩子' },
    { command: '/model', description: '切换 Claude 模型 (sonnet/opus/haiku)' },
    { command: '/config', description: '打开配置设置' },
    { command: '/install-github-app', description: '安装 GitHub PR 审查应用' },
  ]);

  // ⭐⭐⭐ 监听 pendingInput 变化，自动更新输入框
  useEffect(() => {
    if (pendingInput) {
      setInputValue((prev) => (prev ? `${prev}\n\n${pendingInput}` : pendingInput));
      clearPendingInput();
      // 调整textarea高度
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = '60px';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput]);

  // 浮动复制按钮状态
  const [floatingButton, setFloatingButton] = useState<{
    x: number;
    y: number;
    text: string;
    isUrl?: boolean;
    url?: string;
  } | null>(null);
  const [showCopiedTip, setShowCopiedTip] = useState(false);

  // 授权相关状态（参照 WPF 的 _isAuthenticated）
  const [isAuthenticated, setIsAuthenticated] = useState(true); // 默认假设已授权
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // 工具授权相关状态（参照 WPF 的 FilePermissionDialog）
  const [toolApprovalRequest, setToolApprovalRequest] = useState<ToolApprovalRequest | null>(null);
  const [showToolApprovalDialog, setShowToolApprovalDialog] = useState(false);
  const [approvalMode, setApprovalMode] = useState<'manual' | 'auto'>('manual'); // 授权模式（参照 WPF 的 _approvalMode）

  // 会话取消状态
  const [showCancelTip, setShowCancelTip] = useState(false);
  const [isPaused, setIsPaused] = useState(false);  // ⭐ 暂停状态

  // 获取当前会话的元数据
  const currentSessionMetadata = currentProject && terminalStore?.getAllSessions
    ? terminalStore.getAllSessions(currentProject.path).find((s) => s.id === currentSessionId)
    : null;

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 监听文本选择，显示浮动复制按钮
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString();

      if (selectedText && selectedText.trim()) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 检查选中的文本是否是 URL
        const urlPattern = /^https?:\/\/[^\s]+$/;
        const isUrl = urlPattern.test(selectedText.trim());

        setFloatingButton({
          x: rect.left + rect.width / 2,
          y: rect.top - 40, // 在选中区域上方
          text: selectedText.trim(),
          isUrl,
          url: isUrl ? selectedText.trim() : undefined,
        });
      } else {
        setFloatingButton(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // 检测错误消息中是否包含授权错误（参照 WPF 的 ClaudePermissionDetector）
  useEffect(() => {
    if (error && detectAuthError(error)) {
      console.log('[ClaudeCodePanel] 检测到授权错误，显示授权对话框');
      setIsAuthenticated(false);
      setShowAuthDialog(true);
    }
  }, [error]);

  // 处理授权流程（参照 WPF 的 OnStartAuth）
  const handleStartAuth = async () => {
    setIsAuthenticating(true);
    try {
      const result = await startClaudeAuth();
      if (result.success) {
        setIsAuthenticated(true);
        setShowAuthDialog(false);

        // 检查授权状态
        const authStatus = await checkClaudeAuthStatus();
        if (authStatus.isAuthenticated) {
          console.log('[ClaudeCodePanel] 授权成功');
        }
      }
    } catch (error) {
      console.error('[ClaudeCodePanel] 授权失败:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 检查授权状态（参照 WPF 的 VerifyAuthenticationAsync）
  const checkAuthStatus = async () => {
    try {
      const authStatus = await checkClaudeAuthStatus();
      setIsAuthenticated(authStatus.isAuthenticated);
      if (!authStatus.isAuthenticated) {
        setShowAuthDialog(true);
      }
    } catch (error) {
      console.error('[ClaudeCodePanel] 检查授权状态失败:', error);
    }
  };

  // ⭐⭐⭐ 移除文件
  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  // ⭐⭐⭐ 处理文件选择（支持图片和其他文件）
  const handleFileSelect = async () => {
    try {
      const dialogParams = {
        filters: [
          { name: 'All Files (*.*)', extensions: ['*'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
          { name: 'Code Files', extensions: ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rb'] }
        ],
        properties: ['openFile', 'multiSelections'],
        defaultPath: undefined,
        filterIndex: 0  // 明确指定默认选择第一个过滤器（All Files）
      };

      console.log('[ClaudeCodePanel] 🔍 准备打开文件对话框，参数:', dialogParams);

      const result = await window.electronAPI.invoke('dialog:open-file', dialogParams);

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        // 读取选中的文件
        for (const filePath of result.filePaths) {
          const fileData = await window.electronAPI.invoke(IPCChannels.FS_READ_FILE, {
            path: filePath,
            encoding: 'base64'
          });

          const fileName = filePath.split(/[\\/]/).pop() || 'file';
          const ext = fileName.split('.').pop()?.toLowerCase() || '';

          // 判断是否是图片
          const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
          const isImage = imageExtensions.includes(ext);

          // 确定 MIME 类型
          let mimeType = 'application/octet-stream';
          if (isImage) {
            mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          } else if (ext === 'pdf') {
            mimeType = 'application/pdf';
          } else if (ext === 'txt' || ext === 'md') {
            mimeType = 'text/plain';
          }

          // 获取文件大小（通过 base64 长度估算）
          const size = Math.round((fileData.content.length * 3) / 4);

          const newFile: FileAttachment = {
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            dataUrl: `data:${mimeType};base64,${fileData.content}`,
            name: fileName,
            mimeType,
            size,
            isImage,
          };
          setAttachedFiles((prev) => [...prev, newFile]);
        }
      }
    } catch (error) {
      console.error('[ClaudeCodePanel] 选择文件失败:', error);
    }
  };

  // ⭐⭐⭐ 处理特殊本地命令（/clear）
  // 其他斜杠命令直接透传给 Claude CLI 处理
  const handleLocalCommand = (commandText: string): boolean => {
    if (commandText === '/clear') {
      clearMessages();
      return true;
    }
    return false;
  };

  const handleSend = async () => {
    // ⭐⭐⭐ 验证：文件必须配合文字
    if (attachedFiles.length > 0 && !inputValue.trim()) {
      alert('Files must be sent with text message!');
      return;
    }

    if (inputValue.trim() || attachedFiles.length > 0) {
      const message = inputValue.trim();

      // ⭐ 检查是否是本地命令（只有 /clear）
      if (message.startsWith('/')) {
        const handled = handleLocalCommand(message);
        if (handled) {
          // 本地命令已处理（如清空对话）
          setInputValue('');
          setShowSlashMenu(false);
          if (textareaRef.current) {
            textareaRef.current.style.height = '60px';
          }
          return;
        }
        // 其他斜杠命令继续透传给 Claude CLI
      }

      // 构建消息内容
      let messageContent: string | any[];

      if (attachedFiles.length > 0) {
        // 多模态消息格式（支持图片和文档）
        const contentBlocks: any[] = [{ type: 'text', text: message }];

        for (const file of attachedFiles) {
          if (file.isImage) {
            // 图片类型
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.mimeType,
                data: file.dataUrl.split(',')[1], // 去掉 data:image/png;base64, 前缀
              },
            });
          } else {
            // 文档类型
            contentBlocks.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: file.mimeType,
                data: file.dataUrl.split(',')[1],
              },
              cache_control: { type: 'ephemeral' },
            });
          }
        }

        messageContent = contentBlocks;
      } else {
        // 纯文本消息
        messageContent = message;
      }

      await sendMessage(messageContent);
      setInputValue(''); // 清空输入
      setAttachedFiles([]); // 清空文件
      setShowSlashMenu(false); // 关闭斜杠菜单
      setIsPaused(false); // ⭐ 重置暂停状态

      // 重置 textarea 高度
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
      }
    }
  };

  // 取消当前会话
  const handleCancelSession = async () => {
    // 立即设置暂停状态，提供即时视觉反馈
    setIsPaused(true);

    try {
      // ⭐ 立即重置 isLoading 状态，防止显示"正在回复"
      cancelSession();

      await window.electronAPI.invoke(IPCChannels.CLAUDE_CANCEL, { sessionId: currentSessionId });
      setShowCancelTip(true);
      setTimeout(() => setShowCancelTip(false), 2000);
      console.log('[ClaudeCodePanel] 会话已取消');

      // 3秒后自动恢复暂停状态显示
      setTimeout(() => {
        setIsPaused(false);
      }, 3000);
    } catch (error) {
      console.error('[ClaudeCodePanel] 取消会话失败:', error);
      // 如果暂停失败，立即恢复状态
      setIsPaused(false);
      // 也要重置 loading 状态
      cancelSession();
    }
  };

  const handleCopy = async (content: string, messageId: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // ⭐⭐⭐ 处理输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    console.log('[ClaudeCodePanel] 输入变化:', value);
    setInputValue(value);

    // 检测斜杠命令 - 只要以/开头且长度小于20就显示菜单
    const shouldShowMenu = value.startsWith('/') && value.length < 20 && value.indexOf('\n') === -1;
    console.log('[ClaudeCodePanel] 斜杠菜单状态:', { value, shouldShowMenu });
    setShowSlashMenu(shouldShowMenu);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = '60px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // ⭐⭐⭐ 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ESC键关闭斜杠菜单
    if (e.key === 'Escape' && showSlashMenu) {
      e.preventDefault();
      setShowSlashMenu(false);
      return;
    }

    // Enter键发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ⭐⭐⭐ 处理斜杠命令选择
  const handleSlashCommand = (command: string) => {
    setInputValue(command + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  // ⭐⭐⭐ 处理文件粘贴（图片）
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              const newFile: FileAttachment = {
                id: `${Date.now()}-${Math.random()}`,
                dataUrl,
                name: `pasted-image-${Date.now()}.png`,
                mimeType: file.type,
                size: file.size,
                isImage: true,
              };
              setAttachedFiles((prev) => [...prev, newFile]);
            };
            reader.readAsDataURL(file);
          } catch (error) {
            console.error('[ClaudeCodePanel] 粘贴图片失败:', error);
          }
        }
        break;
      }
    }
  };

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, messageIndex: number, content: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageIndex,
      content,
    });
  };

  // 复制选中的文本
  const handleCopySelected = async () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (selectedText && selectedText.trim()) {
      try {
        await navigator.clipboard.writeText(selectedText);
        console.log('[ClaudeCodePanel] 已复制选中文本');
      } catch (err) {
        console.error('[ClaudeCodePanel] 复制失败:', err);
      }
    }
    setContextMenu(null);
  };

  // 复制完整消息
  const handleCopyFullMessage = async () => {
    if (contextMenu) {
      await handleCopy(contextMenu.content, contextMenu.messageIndex);
    }
    setContextMenu(null);
  };

  // 关闭右键菜单（点击其他地方时）
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  // 监听 ESC 键取消会话
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelSession();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [currentSessionId]);

  // 处理浮动按钮复制
  const handleFloatingCopy = async () => {
    if (!floatingButton) return;

    try {
      await navigator.clipboard.writeText(floatingButton.text);
      setShowCopiedTip(true);
      setTimeout(() => {
        setShowCopiedTip(false);
        setFloatingButton(null);
      }, 1500);
    } catch (err) {
      console.error('[ClaudeCodePanel] 复制失败:', err);
    }
  };

  // 处理浮动按钮打开链接
  const handleFloatingOpenUrl = async () => {
    if (!floatingButton?.url) return;
    try {
      await window.electronAPI.invoke('shell:open-url', { url: floatingButton.url });
      setFloatingButton(null);
    } catch (error) {
      console.error('[ClaudeCodePanel] 打开链接失败:', error);
    }
  };

  // 处理工具授权批准（参照 WPF 的 ApproveButton_Click）
  const handleToolApprove = (rememberChoice: boolean) => {
    if (!toolApprovalRequest) return;

    console.log('[ClaudeCodePanel] 批准工具使用:', toolApprovalRequest.toolName);

    // 记录授权结果
    toolApprovalManager.recordApproval(toolApprovalRequest, {
      approved: true,
      rememberChoice,
    });

    // TODO: 通知主进程批准工具使用
    // window.electronAPI.invoke(IPCChannels.CLAUDE_APPROVE_TOOL, {
    //   toolUseId: toolApprovalRequest.toolUseId,
    //   approved: true,
    // });

    setShowToolApprovalDialog(false);
    setToolApprovalRequest(null);
  };

  // 处理工具授权拒绝（参照 WPF 的 DenyButton_Click）
  const handleToolDeny = (rememberChoice: boolean) => {
    if (!toolApprovalRequest) return;

    console.log('[ClaudeCodePanel] 拒绝工具使用:', toolApprovalRequest.toolName);

    // 记录授权结果
    toolApprovalManager.recordApproval(toolApprovalRequest, {
      approved: false,
      rememberChoice,
    });

    // TODO: 通知主进程拒绝工具使用
    // window.electronAPI.invoke(IPCChannels.CLAUDE_DENY_TOOL, {
    //   toolUseId: toolApprovalRequest.toolUseId,
    //   approved: false,
    // });

    setShowToolApprovalDialog(false);
    setToolApprovalRequest(null);
  };

  // 获取消息颜色样式（紧密类型，通过字体颜色区分）
  const getMessageStyle = (role: 'user' | 'assistant' | 'system') => {
    switch (role) {
      case 'user':
        return {
          text: 'text-blue-300', // 用户消息使用蓝色
          icon: 'codicon-account',
          iconColor: 'text-blue-400',
          nameColor: 'text-blue-400',
        };
      case 'assistant':
        return {
          text: 'text-vscode-foreground', // Claude 消息使用默认颜色
          icon: 'codicon-hubot',
          iconColor: 'text-purple-400',
          nameColor: 'text-purple-400',
        };
      case 'system':
        return {
          text: 'text-yellow-200', // 系统消息使用黄色
          icon: 'codicon-info',
          iconColor: 'text-yellow-400',
          nameColor: 'text-yellow-400',
        };
    }
  };

  return (
    <div className="h-full flex flex-col bg-vscode-sidebar-bg border-l border-vscode-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          <img
            src={claudeLogo}
            alt="Claude"
            className="w-6 h-6 rounded-sm"
          />
          <div>
            <h2 className="text-sm font-semibold">Claude Code</h2>
            <p className="text-xs text-vscode-foreground-dim">
              {messages.length} 条消息
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* 授权模式切换按钮（参照 WPF 的 PermissionModeButton）*/}
          <button
            onClick={() => setApprovalMode(approvalMode === 'manual' ? 'auto' : 'manual')}
            className={`p-1.5 hover:bg-vscode-selection-bg/20 rounded transition-colors ${
              approvalMode === 'auto' ? 'text-green-400' : 'text-yellow-400'
            }`}
            title={
              approvalMode === 'auto'
                ? '当前: 自动批准工具使用\n点击切换为手动确认模式'
                : '当前: 手动确认工具使用\n点击切换为自动批准模式'
            }
          >
            <i className={`codicon ${approvalMode === 'auto' ? 'codicon-unlock' : 'codicon-lock'} text-sm`} />
          </button>

          {/* 授权状态按钮（参照 WPF 的授权状态显示）*/}
          <button
            onClick={checkAuthStatus}
            className={`p-1.5 hover:bg-vscode-selection-bg/20 rounded transition-colors ${
              !isAuthenticated ? 'text-yellow-400' : 'text-green-400'
            }`}
            title={isAuthenticated ? '已授权 - 点击重新检查' : '未授权 - 点击查看详情'}
          >
            <i className={`codicon ${isAuthenticated ? 'codicon-verified-filled' : 'codicon-lock'} text-sm`} />
          </button>
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-vscode-selection-bg/20 rounded transition-colors"
            title="创建新会话（清空当前对话）"
          >
            <i className="codicon codicon-add text-sm" />
          </button>
          <button
            className="p-1.5 hover:bg-vscode-selection-bg/20 rounded transition-colors"
            title="更多选项"
          >
            <i className="codicon codicon-ellipsis text-sm" />
          </button>
        </div>
      </div>

      {/* Session Stats Banner (参照 WPF 的会话统计显示) */}
      {showStats && (
        <div className="bg-blue-500/10 border-l-4 border-blue-500 p-3 m-3">
          <div className="flex items-start gap-2">
            <i className="codicon codicon-graph text-blue-400 text-base mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-300 mb-2">会话统计</p>

              {/* 基础统计 */}
              <p className="text-xs text-blue-200 font-mono mb-2">{getSessionStats()}</p>

              {/* 额外元数据（参照图片中的布局）*/}
              {currentSessionMetadata && (
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-200">
                  <div className="flex items-center gap-1">
                    <i className="codicon codicon-calendar text-blue-400" />
                    <span className="text-vscode-foreground-dim">开始时间:</span>
                    <span>{new Date(currentSessionMetadata.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="codicon codicon-symbol-constant text-blue-400" />
                    <span className="text-vscode-foreground-dim">模型:</span>
                    <span className="uppercase">{currentSessionMetadata.model}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="codicon codicon-versions text-blue-400" />
                    <span className="text-vscode-foreground-dim">CLI版本:</span>
                    <span>{currentSessionMetadata.cliVersion}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="codicon codicon-check text-blue-400" />
                    <span className="text-vscode-foreground-dim">审批状态:</span>
                    <span>{currentSessionMetadata.approvalStatus}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="codicon codicon-file text-blue-400" />
                    <span className="text-vscode-foreground-dim">文件大小:</span>
                    <span>{currentSessionMetadata.fileSize ? formatFileSize(currentSessionMetadata.fileSize) : 'N/A'}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <i className="codicon codicon-folder text-blue-400" />
                    <span className="text-vscode-foreground-dim">工作目录:</span>
                    <span className="truncate" title={currentSessionMetadata.workingDirectory}>
                      {currentSessionMetadata.workingDirectory}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowStats(false)}
              className="p-1 hover:bg-blue-500/20 rounded transition-colors"
            >
              <i className="codicon codicon-close text-xs text-blue-300" />
            </button>
          </div>
        </div>
      )}

      {/* Error Banner - ⭐ 暂停状态时不显示错误（避免显示"进程异常退出"等不友好的提示） */}
      {error && !showAuthDialog && !isPaused && (
        <div className="bg-red-500/20 border-l-4 border-red-500 p-3 m-3">
          <div className="flex items-start gap-2">
            <i className="codicon codicon-error text-red-400 text-base mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">错误</p>
              <p className="text-xs text-red-200 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 授权对话框（参照 WPF 的授权提示）*/}
      {showAuthDialog && (
        <div className="bg-yellow-500/20 border-l-4 border-yellow-500 p-4 m-3">
          <div className="flex items-start gap-3">
            <i className="codicon codicon-lock text-yellow-400 text-xl mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-300 mb-2">需要授权</p>
              <div className="text-xs text-yellow-200 whitespace-pre-line mb-3">
                {getAuthGuidanceMessage()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartAuth}
                  disabled={isAuthenticating}
                  className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-700 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors flex items-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <i className="codicon codicon-loading animate-spin" />
                      <span>授权中...</span>
                    </>
                  ) : (
                    <>
                      <i className="codicon codicon-key" />
                      <span>启动授权</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAuthDialog(false)}
                  className="px-3 py-1.5 bg-vscode-input-bg hover:bg-vscode-selection-bg rounded text-xs font-medium transition-colors"
                >
                  稍后
                </button>
                <button
                  onClick={checkAuthStatus}
                  className="px-3 py-1.5 bg-vscode-input-bg hover:bg-vscode-selection-bg rounded text-xs font-medium transition-colors flex items-center gap-1"
                  title="重新检查授权状态"
                >
                  <i className="codicon codicon-refresh text-xs" />
                  <span>检查状态</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowAuthDialog(false)}
              className="p-1 hover:bg-yellow-500/20 rounded transition-colors"
            >
              <i className="codicon codicon-close text-xs text-yellow-300" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
            <div className="text-center max-w-xs">
              <img
                src={claudeLogo}
                alt="Claude"
                className="w-16 h-16 mx-auto mb-4 opacity-30"
              />
              <h3 className="text-sm font-semibold mb-2">开始与 Claude 对话</h3>
              <p className="text-xs opacity-70">
                输入您的问题或指令,Claude 将帮助您完成编码任务
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const style = getMessageStyle(message.role as 'user' | 'assistant' | 'system');
              const isCopied = copiedMessageId === index;

              // ⭐ 计算回复时间（当前 assistant 消息与上一条 user 消息的时间差）
              let responseDuration: number | undefined;
              if (message.role === 'assistant' && index > 0) {
                const prevMessage = messages[index - 1];
                if (prevMessage && prevMessage.role === 'user') {
                  responseDuration = message.timestamp - prevMessage.timestamp;
                }
              }

              return (
                <div
                  key={index}
                  className="py-2 px-1 relative group hover:bg-vscode-selection-bg/5"
                >
                  {/* Message Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {message.role === 'assistant' ? (
                        <img
                          src={claudeLogo}
                          alt="Claude"
                          className="w-4 h-4 rounded-sm"
                        />
                      ) : (
                        <i className={`codicon ${style.icon} ${style.iconColor} text-sm`} />
                      )}
                      <span className={`text-xs font-semibold ${style.nameColor}`}>
                        {message.role === 'user' ? '你' : message.role === 'assistant' ? 'Claude' : '系统'}
                      </span>
                      <span className="text-xs text-vscode-foreground-dim opacity-60">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(message.content, index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-vscode-selection-bg/30 rounded"
                      title="复制消息"
                    >
                      <i
                        className={`codicon ${
                          isCopied ? 'codicon-check' : 'codicon-copy'
                        } text-xs ${isCopied ? 'text-green-400' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Message Content - 支持文本选择和右键菜单 */}
                  <div
                    className={`text-sm ${style.text} whitespace-pre-wrap break-words leading-relaxed pl-6 select-text cursor-text`}
                    onDoubleClick={() => handleCopy(message.content, index)}
                    onContextMenu={(e) => handleContextMenu(e, index, message.content)}
                    title="双击复制整条消息 | 右键显示更多选项"
                  >
                    {renderTextWithLinks(message.content)}
                  </div>

                  {/* Token Usage (参照 WPF 的消息 Token 显示) */}
                  {message.tokenUsage && message.role === 'assistant' && (
                    <div className="mt-1.5 pl-6">
                      <div className="flex items-center gap-2 text-xs text-vscode-foreground-dim opacity-60">
                        <i className="codicon codicon-pulse" />
                        <span className="font-mono">{formatTokenUsage(message.tokenUsage, responseDuration)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* ⭐⭐⭐ 增强的Loading Indicator - 更明显的"正在回复"状态指示器 */}
        {isLoading && !isPaused && (
          <div className="py-4 px-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg mx-1 mb-2 animate-pulse-slow">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <img
                  src={claudeLogo}
                  alt="Claude"
                  className="w-6 h-6 rounded-sm"
                />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-purple-300">Claude 正在回复</span>
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
                <p className="text-xs text-vscode-foreground-dim mt-0.5">正在分析您的问题并生成回复...</p>
              </div>
            </div>
            {/* 进度条动画 */}
            <div className="w-full h-0.5 bg-vscode-input-bg rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 animate-progress" />
            </div>
          </div>
        )}

        {/* ⭐ 暂停状态提示 */}
        {isPaused && (
          <div className="py-4 px-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg mx-1 mb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={claudeLogo}
                  alt="Claude"
                  className="w-6 h-6 rounded-sm opacity-60"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <i className="codicon codicon-debug-pause text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-300">回复已暂停</span>
                </div>
                <p className="text-xs text-vscode-foreground-dim mt-0.5">会话已取消，您可以继续发送新消息</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - 输入区域 */}
      <div className="relative border-t border-vscode-border bg-vscode-input-bg/30">
        {/* 顶部状态栏 */}
        <div className="flex items-center justify-between text-xs px-4 pt-3">
          <div className="flex items-center gap-3">
            {currentProject && (
              <div className="flex items-center gap-1.5 text-blue-400">
                <i className="codicon codicon-folder" />
                <span>{currentProject.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-vscode-foreground-dim">
            <span className={approvalMode === 'auto' ? 'text-green-400' : 'text-yellow-400'}>
              {approvalMode === 'auto' ? '🔓 自动批准' : '🔒 手动确认'}
            </span>
          </div>
        </div>

        {/* ⭐⭐⭐ 文件预览区 */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-2">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="relative group border border-vscode-border rounded-lg overflow-hidden"
              >
                {file.isImage ? (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-20 h-20 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-vscode-input-bg flex flex-col items-center justify-center p-2">
                    <i className="codicon codicon-file text-2xl text-vscode-accent mb-1" />
                    <span className="text-[8px] text-center text-vscode-foreground-dim truncate w-full px-1">
                      {file.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove file"
                >
                  <i className="codicon codicon-close text-xs" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.name} ({(file.size / 1024).toFixed(1)}KB)
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ⭐⭐⭐ 斜杠命令菜单 */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-vscode-menu-bg border-2 border-vscode-accent rounded-lg shadow-2xl py-2 max-h-[400px] overflow-y-auto z-[100]">
            <div className="px-3 py-2 text-xs text-vscode-accent font-semibold border-b border-vscode-border mb-1 flex items-center gap-2">
              <i className="codicon codicon-symbol-keyword" />
              斜杠命令 (Slash Commands)
            </div>
            {slashCommands
              .filter(cmd => {
                // 如果只输入了 "/"，显示所有命令
                if (inputValue === '/') return true;
                // 否则过滤匹配的命令
                return cmd.command.toLowerCase().includes(inputValue.toLowerCase());
              })
              .map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => handleSlashCommand(cmd.command)}
                  className="w-full px-3 py-2 text-left hover:bg-vscode-accent/20 active:bg-vscode-accent/30 flex flex-col gap-1 transition-colors"
                >
                  <code className="text-vscode-accent font-mono text-sm font-bold">{cmd.command}</code>
                  <span className="text-xs text-vscode-foreground-dim leading-relaxed">{cmd.description}</span>
                </button>
              ))}
            {slashCommands.filter(cmd => {
              if (inputValue === '/') return true;
              return cmd.command.toLowerCase().includes(inputValue.toLowerCase());
            }).length === 0 && (
              <div className="px-3 py-4 text-center text-vscode-foreground-dim text-xs">
                没有匹配的命令
              </div>
            )}
          </div>
        )}

        {/* 输入框区域 */}
        <div className="border-t border-vscode-border bg-vscode-sidebar-bg">
          <div className="p-3">
            <div className="flex gap-3 items-end">
              {/* 左侧：文件附件按钮 */}
              <button
                onClick={handleFileSelect}
                className="p-2.5 hover:bg-vscode-selection-bg/30 rounded-md transition-all flex-shrink-0 self-end mb-[26px]"
                title="Attach files (images, documents, code)"
              >
                <i className="codicon codicon-attach text-base opacity-80 hover:opacity-100" />
              </button>

              {/* 中间：输入框 */}
              <div className="flex-1 flex flex-col gap-1.5">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Type your message..."
                  className="w-full px-3 py-2.5 bg-vscode-input-bg text-vscode-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-accent focus:ring-1 focus:ring-vscode-accent/50 transition-all min-h-[60px] max-h-[200px] resize-none placeholder:text-vscode-foreground-dim/50"
                  rows={2}
                />
                <div className="text-xs text-vscode-foreground-dim/70 px-1 flex items-center gap-1.5">
                  {isPaused ? (
                    <>
                      <i className="codicon codicon-debug-stop text-yellow-400" />
                      <span className="text-yellow-400">Paused</span>
                    </>
                  ) : isLoading ? (
                    <>
                      <i className="codicon codicon-loading codicon-modifier-spin" />
                      <span>Claude is responding...</span>
                    </>
                  ) : (
                    <>
                      <i className="codicon codicon-info" />
                      <span>Shift+Enter for new line • Ctrl+V to paste image • Click button to attach files</span>
                    </>
                  )}
                </div>
              </div>

              {/* 右侧：发送/暂停按钮 */}
              <button
                onClick={isLoading ? handleCancelSession : handleSend}
                disabled={!isLoading && !inputValue.trim() && attachedFiles.length === 0}
                className={`p-3 rounded-md flex-shrink-0 self-end mb-[26px] transition-all ${
                  isLoading
                    ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                    : 'bg-vscode-button-bg hover:bg-vscode-button-hover-bg text-vscode-button-fg border border-vscode-button-border disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {isPaused ? (
                  <i className="codicon codicon-debug-stop text-lg" />
                ) : isLoading ? (
                  <i className="codicon codicon-debug-pause text-lg" />
                ) : (
                  <i className="codicon codicon-send text-lg" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* GitHub Sync Status Bar */}
        {currentProject?.path && (
          <SyncStatusBar
            projectPath={currentProject.path}
            sessionId={currentSessionId}
          />
        )}
      </div>

      {/* Tool Approval Dialog (参照 WPF 的 FilePermissionDialog) */}
      {showToolApprovalDialog && toolApprovalRequest && (
        <ToolApprovalDialog
          request={toolApprovalRequest}
          stats={toolApprovalManager.getStats()}
          onApprove={handleToolApprove}
          onDeny={handleToolDeny}
          onClose={() => {
            setShowToolApprovalDialog(false);
            setToolApprovalRequest(null);
          }}
        />
      )}

      {/* Context Menu - 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-vscode-menu-bg border border-vscode-border rounded-md shadow-xl py-1 z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 复制选中文本 */}
          {window.getSelection()?.toString()?.trim() && (
            <button
              onClick={handleCopySelected}
              className="w-full px-4 py-2 text-left text-sm text-vscode-foreground hover:bg-vscode-selection-bg/30 flex items-center gap-2"
            >
              <i className="codicon codicon-copy text-xs" />
              <span>复制选中文本</span>
            </button>
          )}

          {/* 复制完整消息 */}
          <button
            onClick={handleCopyFullMessage}
            className="w-full px-4 py-2 text-left text-sm text-vscode-foreground hover:bg-vscode-selection-bg/30 flex items-center gap-2"
          >
            <i className="codicon codicon-files text-xs" />
            <span>复制完整消息</span>
          </button>
        </div>
      )}

      {/* Floating Copy Button - 浮动复制按钮 */}
      {floatingButton && !showCopiedTip && (
        <div
          className="fixed bg-vscode-menu-bg border border-vscode-border rounded-md shadow-xl px-3 py-2 z-50 animate-fade-in"
          style={{
            left: `${floatingButton.x}px`,
            top: `${floatingButton.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center gap-2">
            {floatingButton.isUrl ? (
              <button
                onClick={handleFloatingOpenUrl}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <i className="codicon codicon-link-external text-xs" />
                <span>打开链接</span>
              </button>
            ) : (
              <button
                onClick={handleFloatingCopy}
                className="flex items-center gap-2 text-sm text-vscode-foreground hover:text-vscode-accent transition-colors"
              >
                <i className="codicon codicon-copy text-xs" />
                <span>复制</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cancel Tip - 取消会话提示 */}
      {showCancelTip && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-white rounded-md shadow-xl px-4 py-2 z-50 animate-slide-in flex items-center gap-2">
          <i className="codicon codicon-debug-stop" />
          <span>会话已取消</span>
        </div>
      )}

      {/* Copied Tip - 已复制提示 */}
      {showCopiedTip && floatingButton && (
        <div
          className="fixed bg-green-500/90 text-white rounded-md shadow-xl px-3 py-2 z-50 animate-fade-in"
          style={{
            left: `${floatingButton.x}px`,
            top: `${floatingButton.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center gap-2 text-sm">
            <i className="codicon codicon-check text-xs" />
            <span>已复制</span>
          </div>
        </div>
      )}
    </div>
  );
}
