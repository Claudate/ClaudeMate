/**
 * File Explorer Panel
 * VSCode-style file tree explorer with real file system integration
 *
 * 参照 WPF 的项目上下文模式:
 * - 打开文件夹时设置当前项目
 * - 切换项目时自动切换 Claude CLI 会话
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IPCChannels } from '../../../../shared/types/ipc.types';
import { useProjectStore } from '../../../stores/projectStore';
import { useChatStore } from '../../../stores/chatStore';
import { useAppStore } from '../../../stores/appStore';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  isExpanded?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileTreeNode | null;
}

interface FileTreeItemProps {
  node: FileTreeNode;
  level: number;
  onSelect: (node: FileTreeNode) => void;
  onToggle: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  selectedPath?: string;
}

function FileTreeItem({ node, level, onSelect, onToggle, onContextMenu, selectedPath }: FileTreeItemProps) {
  const isSelected = selectedPath === node.path;
  const paddingLeft = level * 16 + 8;

  const handleClick = () => {
    if (node.type === 'folder') {
      onToggle(node);
    } else {
      onSelect(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-sm hover:bg-vscode-selection-bg/20 ${
          isSelected ? 'bg-vscode-selection-bg/30' : ''
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Folder arrow */}
        {node.type === 'folder' && (
          <i
            className={`codicon ${
              node.isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'
            } text-xs`}
          />
        )}
        {node.type === 'file' && <span className="w-4" />}

        {/* Icon */}
        <i
          className={`codicon ${
            node.type === 'folder'
              ? node.isExpanded
                ? 'codicon-folder-opened'
                : 'codicon-folder'
              : 'codicon-file'
          } text-base`}
        />

        {/* Name */}
        <span className="truncate">{node.name}</span>
      </div>

      {/* Children */}
      {node.type === 'folder' && node.isExpanded && node.children && (
        <>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              selectedPath={selectedPath}
            />
          ))}
        </>
      )}
    </>
  );
}

interface FileExplorerPanelProps {
  onFileSelect: (file: FileTreeNode) => void;
}

export function FileExplorerPanel({ onFileSelect }: FileExplorerPanelProps) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [rootPath, setRootPath] = useState<string>();
  const [loading, setLoading] = useState(false);

  // Project context store (参照 WPF 的 IProjectContext)
  const { currentProject, setCurrentProject } = useProjectStore();
  const { restoreFromTerminal, switchToProject, sendMessage } = useChatStore();  // ⭐ 添加 sendMessage
  const { setCurrentProject: setAppCurrentProject } = useAppStore();

  // Inline input states (VSCode-style)
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ⭐⭐⭐ 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [clipboard, setClipboard] = useState<{ node: FileTreeNode; operation: 'cut' | 'copy' } | null>(null);

  // ⭐⭐⭐ 拖拽状态
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // ⭐⭐⭐ 系统剪贴板状态（检测是否有可粘贴的文件）
  const [hasClipboardFiles, setHasClipboardFiles] = useState(false);

  // 自动聚焦输入框
  useEffect(() => {
    if (creatingType && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [creatingType]);

  // ⭐ 关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, node: null });
    if (contextMenu.visible) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  // 从localStorage加载上次打开的项目
  useEffect(() => {
    const savedProject = localStorage.getItem('lastOpenedProject');
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject);
        loadDirectory(project.path);
      } catch (error) {
        console.error('Failed to load saved project:', error);
      }
    }
  }, []);

  // ⭐⭐⭐ 键盘快捷键支持（参照 VSCode）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // 只在文件资源管理器有焦点时生效
      const explorerPanel = document.querySelector('.file-explorer-panel');
      if (!explorerPanel?.contains(document.activeElement)) {
        return;
      }

      // Ctrl+C: 复制
      if (e.ctrlKey && e.key === 'c' && !e.shiftKey && !e.altKey && selectedPath) {
        e.preventDefault();
        const node = findNodeByPath(fileTree, selectedPath);
        if (node) {
          setClipboard({ node, operation: 'copy' });
          console.log('[快捷键] 复制:', node.name);
        }
      }

      // Ctrl+X: 剪切
      if (e.ctrlKey && e.key === 'x' && !e.shiftKey && !e.altKey && selectedPath) {
        e.preventDefault();
        const node = findNodeByPath(fileTree, selectedPath);
        if (node) {
          setClipboard({ node, operation: 'cut' });
          console.log('[快捷键] 剪切:', node.name);
        }
      }

      // Ctrl+V: 粘贴
      if (e.ctrlKey && e.key === 'v' && !e.shiftKey && !e.altKey && clipboard && rootPath) {
        e.preventDefault();
        handlePaste();
        console.log('[快捷键] 粘贴');
      }

      // Delete: 删除
      if (e.key === 'Delete' && !e.ctrlKey && !e.shiftKey && !e.altKey && selectedPath) {
        e.preventDefault();
        const node = findNodeByPath(fileTree, selectedPath);
        if (node) {
          handleDeleteNode(node);
          console.log('[快捷键] 删除:', node.name);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPath, clipboard, rootPath, fileTree]);

  // ⭐ 辅助函数：根据路径查找节点
  const findNodeByPath = (nodes: FileTreeNode[], path: string): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  // ⭐ 辅助函数：删除节点
  const handleDeleteNode = async (node: FileTreeNode) => {
    if (!confirm(`确定要删除 "${node.name}" 吗？`)) return;

    try {
      await window.electronAPI.invoke(IPCChannels.FS_DELETE, { path: node.path });
      await loadDirectory(rootPath!);
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(`删除失败: ${error}`);
    }
  };

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke<{
        fileTree: FileTreeNode[];
        rootPath: string;
      }>(IPCChannels.FS_SCAN_DIRECTORY, { path: dirPath });

      if (result) {
        setFileTree(result.fileTree);
        setRootPath(result.rootPath);

        // 提取项目名称
        const projectName = result.rootPath.split(/[/\\]/).pop() || 'Project';

        // 关键: 设置当前项目上下文（参照 WPF 的 _projectContext.CurrentProject）
        // 这会触发 Claude CLI 切换到新的工作目录
        const project = {
          name: projectName,
          path: result.rootPath,
        };

        console.log(`[FileExplorer] 切换项目: ${projectName} (${result.rootPath})`);

        // 参照 WPF 的多终端模式：切换项目时不清空聊天
        // 而是通过 TerminalInstance 保存/恢复每个项目的聊天历史
        if (currentProject?.path !== result.rootPath) {
          console.log('[FileExplorer] 检测到项目切换，恢复终端历史');
          // 切换到新项目的终端实例，自动保存当前终端并恢复新终端
          restoreFromTerminal(result.rootPath, projectName);

          // ⭐ 切换到项目的会话 ID (支持跨应用重启的会话恢复)
          switchToProject(result.rootPath);
        }

        setCurrentProject(project);

        // ⭐ 同步到 appStore,让 StatusBar 显示项目状态
        setAppCurrentProject(projectName);

        // 保存到localStorage
        localStorage.setItem(
          'lastOpenedProject',
          JSON.stringify({
            path: result.rootPath,
            name: projectName,
            lastOpened: Date.now(),
          })
        );
      }
    } catch (error) {
      console.error('Failed to scan directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async () => {
    console.log('[FileExplorer] handleOpenFile clicked');
    try {
      console.log('[FileExplorer] Calling FS_OPEN_FILE_DIALOG');
      const result = await window.electronAPI.invoke<{
        canceled: boolean;
        filePath?: string;
      }>(IPCChannels.FS_OPEN_FILE_DIALOG);

      console.log('[FileExplorer] Dialog result:', result);
      if (!result.canceled && result.filePath) {
        const fileName = result.filePath.split(/[/\\]/).pop() || 'file';
        const fileNode: FileTreeNode = {
          name: fileName,
          path: result.filePath,
          type: 'file',
        };

        // 直接选中该文件
        setSelectedPath(result.filePath);
        onFileSelect(fileNode);

        // 保存到localStorage
        localStorage.setItem(
          'lastOpenedFile',
          JSON.stringify({
            path: result.filePath,
            name: fileName,
            lastOpened: Date.now(),
          })
        );
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  const handleOpenFolder = async () => {
    console.log('[FileExplorer] handleOpenFolder clicked');
    try {
      console.log('[FileExplorer] Calling FS_OPEN_FOLDER_DIALOG');
      const result = await window.electronAPI.invoke<{
        canceled: boolean;
        folderPath?: string;
      }>(IPCChannels.FS_OPEN_FOLDER_DIALOG);

      console.log('[FileExplorer] Dialog result:', result);
      if (!result.canceled && result.folderPath) {
        await loadDirectory(result.folderPath);
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  };

  const handleRefresh = () => {
    if (rootPath) {
      loadDirectory(rootPath);
    }
  };

  const handleCloseFolder = () => {
    setFileTree([]);
    setRootPath(undefined);
    setSelectedPath(undefined);
    localStorage.removeItem('lastOpenedProject');
  };

  const handleCreateFile = () => {
    console.log('[FileExplorer] handleCreateFile clicked');
    if (!rootPath) return;

    setCreatingType('file');
    setNewItemName('');
  };

  const handleCreateFolder = () => {
    console.log('[FileExplorer] handleCreateFolder clicked');
    if (!rootPath) return;

    setCreatingType('folder');
    setNewItemName('');
  };

  const handleConfirmCreate = async () => {
    if (!newItemName.trim() || !rootPath || !creatingType) return;

    try {
      const itemPath = `${rootPath}${rootPath.endsWith('/') || rootPath.endsWith('\\') ? '' : '/'}${newItemName.trim()}`;

      if (creatingType === 'file') {
        await window.electronAPI.invoke(IPCChannels.FS_CREATE_FILE, {
          path: itemPath,
          content: '',
        });
      } else {
        await window.electronAPI.invoke(IPCChannels.FS_CREATE_FOLDER, {
          path: itemPath,
        });
      }

      // 刷新文件树
      await loadDirectory(rootPath);

      // 重置状态
      setCreatingType(null);
      setNewItemName('');
    } catch (error) {
      console.error(`Failed to create ${creatingType}:`, error);
      alert(`创建${creatingType === 'file' ? '文件' : '文件夹'}失败: ${error}`);
    }
  };

  const handleCancelCreate = () => {
    setCreatingType(null);
    setNewItemName('');
  };

  const handleToggle = (node: FileTreeNode) => {
    const toggleNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map((n) => {
        if (n.path === node.path) {
          return { ...n, isExpanded: !n.isExpanded };
        }
        if (n.children) {
          return { ...n, children: toggleNode(n.children) };
        }
        return n;
      });
    };

    setFileTree(toggleNode(fileTree));
  };

  const handleSelect = (node: FileTreeNode) => {
    console.log('[FileExplorer] File selected', {
      name: node.name,
      path: node.path,
      type: node.type,
    });
    setSelectedPath(node.path);
    onFileSelect(node);
  };

  // ⭐⭐⭐ 检查系统剪贴板是否有文件
  const checkClipboardFiles = async () => {
    try {
      const result = await window.electronAPI.invoke('clipboard:has-files' as any);
      setHasClipboardFiles(result?.hasFiles || false);
    } catch (error) {
      console.warn('检查剪贴板失败:', error);
      setHasClipboardFiles(false);
    }
  };

  // ⭐⭐⭐ 右键菜单处理（优化：不再预检查剪贴板，避免卡顿）
  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation(); // ⭐ 防止事件冒泡到父容器，避免重复显示菜单

    // 立即显示菜单，避免卡顿
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });

    // ⭐ 优化：移除自动检查剪贴板，只在菜单打开后延迟检查（用户看不到延迟）
    setTimeout(() => {
      checkClipboardFiles();
    }, 100);
  };

  // 在文件资源管理器中显示
  const handleRevealInExplorer = async () => {
    if (!contextMenu.node) return;
    try {
      await window.electronAPI.invoke(IPCChannels.FS_REVEAL_IN_EXPLORER, {
        path: contextMenu.node.path,
      });
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    } catch (error) {
      console.error('Failed to reveal in explorer:', error);
      alert(`打开文件管理器失败: ${error}`);
    }
  };

  // 复制（使用 useCallback 优化性能）
  const handleCopy = useCallback(() => {
    if (!contextMenu.node) return;
    setClipboard({ node: contextMenu.node, operation: 'copy' });
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  }, [contextMenu.node]);

  // 剪切（使用 useCallback 优化性能）
  const handleCut = useCallback(() => {
    if (!contextMenu.node) return;
    setClipboard({ node: contextMenu.node, operation: 'cut' });
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  }, [contextMenu.node]);

  // ⭐⭐⭐ 从系统剪贴板粘贴文件（支持外部文件）
  const handlePasteFromSystem = async () => {
    if (!rootPath) return;

    try {
      // 获取目标目录
      const targetDir = contextMenu.node?.type === 'folder' ? contextMenu.node.path : rootPath;

      // 调用 IPC 从系统剪贴板粘贴
      await window.electronAPI.invoke('fs:paste-from-clipboard' as any, {
        targetDir,
      });

      // 刷新文件树
      await loadDirectory(rootPath);
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    } catch (error) {
      console.error('Failed to paste from system:', error);
      alert(`粘贴失败: ${error}`);
    }
  };

  // 粘贴（应用内剪贴板）
  const handlePaste = async () => {
    if (!clipboard || !rootPath) return;

    try {
      const targetDir = contextMenu.node?.type === 'folder' ? contextMenu.node.path : rootPath;
      const newPath = `${targetDir}${targetDir.endsWith('/') || targetDir.endsWith('\\') ? '' : '/'}${clipboard.node.name}`;

      if (clipboard.operation === 'copy') {
        // 复制文件/文件夹
        await window.electronAPI.invoke(IPCChannels.FS_COPY, {
          source: clipboard.node.path,
          destination: newPath,
        });
      } else {
        // 移动文件/文件夹
        await window.electronAPI.invoke(IPCChannels.FS_MOVE, {
          source: clipboard.node.path,
          destination: newPath,
        });
        setClipboard(null);
      }

      // 刷新文件树
      await loadDirectory(rootPath);
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    } catch (error) {
      console.error('Failed to paste:', error);
      alert(`粘贴失败: ${error}`);
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!contextMenu.node) return;

    const confirmed = window.confirm(`确定要删除 "${contextMenu.node.name}" 吗？`);
    if (!confirmed) return;

    try {
      await window.electronAPI.invoke(IPCChannels.FS_DELETE, {
        path: contextMenu.node.path,
      });

      // 刷新文件树
      if (rootPath) {
        await loadDirectory(rootPath);
      }
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(`删除失败: ${error}`);
    }
  };

  // ⭐⭐⭐ 添加到AI对话
  const handleAddToChat = () => {
    if (!contextMenu.node) return;

    // 只添加路径，不读取文件内容
    const textToAdd = contextMenu.node.type === 'file'
      ? `文件路径: ${contextMenu.node.path}`
      : `文件夹路径: ${contextMenu.node.path}`;

    // 添加到待输入文本（而不是直接发送）
    const chatStore = useChatStore.getState();
    chatStore.appendToPendingInput(textToAdd);

    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // ⭐⭐⭐ 拖放事件处理器（支持从外部拖拽文件进来）
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有在离开整个容器时才移除高亮
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (!rootPath) return;

    try {
      // 获取拖拽的文件
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // 获取文件路径
      const filePaths = files.map((file) => (file as any).path).filter(Boolean);
      if (filePaths.length === 0) {
        console.warn('无法获取文件路径');
        return;
      }

      console.log('[FileExplorer] 拖拽文件:', filePaths);

      // 确定目标目录
      const targetDir = rootPath;

      // 调用 IPC 复制文件
      const result = await window.electronAPI.invoke('fs:copy-files' as any, {
        sourcePaths: filePaths,
        targetDir,
      });

      console.log('[FileExplorer] 文件复制成功:', result);

      // 刷新文件树
      await loadDirectory(rootPath);
    } catch (error) {
      console.error('拖拽文件失败:', error);
      alert(`拖拽文件失败: ${error}`);
    }
  };

  return (
    <div className="file-explorer-panel h-full flex flex-col bg-vscode-sidebar-bg border-r border-vscode-border" tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-vscode-border relative z-50">
        <span className="text-xs font-semibold uppercase text-vscode-foreground-dim">
          资源管理器
        </span>
        <div className="flex items-center gap-1 relative z-50">
          {!rootPath ? (
            <>
              <button
                className="p-1 hover:bg-vscode-selection-bg/20 rounded pointer-events-auto relative z-50"
                title="打开文件"
                onClick={handleOpenFile}
              >
                <i className="codicon codicon-file-add text-sm" />
              </button>
              <button
                className="p-1 hover:bg-vscode-selection-bg/20 rounded pointer-events-auto relative z-50"
                title="打开文件夹"
                onClick={handleOpenFolder}
              >
                <i className="codicon codicon-folder-opened text-sm" />
              </button>
            </>
          ) : (
            <>
              <button
                className="p-1 hover:bg-vscode-selection-bg/20 rounded pointer-events-auto relative z-50"
                title="新建文件"
                onClick={handleCreateFile}
              >
                <i className="codicon codicon-new-file text-sm" />
              </button>
              <button
                className="p-1 hover:bg-vscode-selection-bg/20 rounded pointer-events-auto relative z-50"
                title="新建文件夹"
                onClick={handleCreateFolder}
              >
                <i className="codicon codicon-new-folder text-sm" />
              </button>
              <button
                className="p-1 hover:bg-vscode-selection-bg/20 rounded"
                title="刷新"
                onClick={handleRefresh}
                disabled={loading}
              >
                <i className={`codicon codicon-refresh text-sm ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                className="p-1 hover:bg-vscode-selection-bg/20 rounded"
                title="关闭文件夹"
                onClick={handleCloseFolder}
              >
                <i className="codicon codicon-close text-sm" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* File Tree or Empty State */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden relative ${
          isDraggingOver ? 'ring-2 ring-vscode-accent ring-inset bg-vscode-selection-bg/10' : ''
        }`}
        onContextMenu={(e) => {
          // ⭐⭐⭐ 空白区域右键菜单（没有点击到任何文件/文件夹时）
          if (rootPath && e.target === e.currentTarget) {
            e.preventDefault();

            // 立即显示菜单，避免卡顿
            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              node: null, // 空白区域，node 为 null
            });

            // ⭐ 优化：延迟检查剪贴板，不阻塞菜单显示
            setTimeout(() => {
              checkClipboardFiles();
            }, 100);
          }
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ⭐⭐⭐ 拖拽提示覆盖层 */}
        {isDraggingOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-vscode-editor-bg/90 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-vscode-accent">
              <i className="codicon codicon-arrow-down text-4xl animate-bounce" />
              <span className="text-sm font-semibold">释放以复制文件到此文件夹</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32 text-vscode-foreground-dim text-sm">
            <i className="codicon codicon-loading animate-spin mr-2" />
            加载中...
          </div>
        ) : fileTree.length > 0 ? (
          <>
            {/* Inline Input for Creating New File/Folder (VSCode-style) */}
            {creatingType && (
              <div className="flex items-center gap-1 px-2 py-1 text-sm bg-vscode-selection-bg/10" style={{ paddingLeft: '8px' }}>
                <i className={`codicon ${creatingType === 'folder' ? 'codicon-folder' : 'codicon-file'} text-base`} />
                <input
                  ref={inputRef}
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmCreate();
                    } else if (e.key === 'Escape') {
                      handleCancelCreate();
                    }
                  }}
                  onBlur={handleCancelCreate}
                  className="flex-1 bg-vscode-input-bg text-vscode-foreground px-1 py-0.5 outline-none border border-vscode-accent"
                  placeholder={creatingType === 'file' ? '新文件名' : '新文件夹名'}
                />
              </div>
            )}

            {/* File Tree */}
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                level={0}
                onSelect={handleSelect}
                onToggle={handleToggle}
                onContextMenu={handleContextMenu}
                selectedPath={selectedPath}
              />
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <i className="codicon codicon-folder-opened text-4xl text-vscode-foreground-dim mb-4" />
            <p className="text-sm text-vscode-foreground-dim mb-4">
              还没有打开任何文件或文件夹
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                className="px-4 py-2 bg-vscode-button-bg hover:bg-vscode-button-hover text-vscode-button-fg rounded text-sm flex items-center justify-center gap-2"
                onClick={handleOpenFolder}
              >
                <i className="codicon codicon-folder-opened" />
                打开文件夹
              </button>
              <button
                className="px-4 py-2 bg-vscode-button-secondary-bg hover:bg-vscode-button-secondary-hover text-vscode-button-secondary-fg rounded text-sm flex items-center justify-center gap-2"
                onClick={handleOpenFile}
              >
                <i className="codicon codicon-file-add" />
                打开文件
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {rootPath && (
        <div className="p-2 border-t border-vscode-border text-xs text-vscode-foreground-dim">
          <div className="flex items-center gap-1 truncate" title={rootPath}>
            <i className="codicon codicon-folder text-sm flex-shrink-0" />
            <span className="truncate">{rootPath.split(/[/\\]/).pop() || rootPath}</span>
          </div>
        </div>
      )}

      {/* ⭐⭐⭐ 统一的右键菜单（所有位置完全相同） */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-vscode-menu-bg border border-vscode-border rounded shadow-lg py-1 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 新建文件 */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              setContextMenu({ visible: false, x: 0, y: 0, node: null });
              setCreatingType('file');
              setNewItemName('');
            }}
          >
            <i className="codicon codicon-new-file text-xs flex-shrink-0" />
            <span className="flex-1">新建文件</span>
          </button>

          {/* 新建文件夹 */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              setContextMenu({ visible: false, x: 0, y: 0, node: null });
              setCreatingType('folder');
              setNewItemName('');
            }}
          >
            <i className="codicon codicon-new-folder text-xs flex-shrink-0" />
            <span className="flex-1">新建文件夹</span>
          </button>

          <div className="border-t border-vscode-border my-1" />

          {/* 剪切 */}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
              contextMenu.node ? 'hover:bg-vscode-selection-bg/20' : 'opacity-40 cursor-not-allowed'
            }`}
            onClick={contextMenu.node ? handleCut : undefined}
            disabled={!contextMenu.node}
          >
            <i className="codicon codicon-scissors text-xs flex-shrink-0" />
            <span className="flex-1">剪切</span>
            <span className="text-xs text-vscode-foreground-dim">Ctrl+X</span>
          </button>

          {/* 复制 */}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
              contextMenu.node ? 'hover:bg-vscode-selection-bg/20' : 'opacity-40 cursor-not-allowed'
            }`}
            onClick={contextMenu.node ? handleCopy : undefined}
            disabled={!contextMenu.node}
          >
            <i className="codicon codicon-copy text-xs flex-shrink-0" />
            <span className="flex-1">复制</span>
            <span className="text-xs text-vscode-foreground-dim">Ctrl+C</span>
          </button>

          {/* 粘贴 */}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
              clipboard || hasClipboardFiles ? 'hover:bg-vscode-selection-bg/20' : 'opacity-40 cursor-not-allowed'
            }`}
            onClick={
              clipboard || hasClipboardFiles
                ? async () => {
                    // 优先使用应用内剪贴板，否则使用系统剪贴板
                    if (clipboard) {
                      await handlePaste();
                    } else if (hasClipboardFiles) {
                      await handlePasteFromSystem();
                    }
                  }
                : undefined
            }
            disabled={!clipboard && !hasClipboardFiles}
          >
            <i className="codicon codicon-clippy text-xs flex-shrink-0" />
            <span className="flex-1">粘贴</span>
            <span className="text-xs text-vscode-foreground-dim">Ctrl+V</span>
          </button>

          <div className="border-t border-vscode-border my-1" />

          {/* 在文件资源管理器中显示 */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={async () => {
              const pathToReveal = contextMenu.node?.path || rootPath;
              if (pathToReveal) {
                await window.electronAPI.invoke(IPCChannels.FS_REVEAL_IN_EXPLORER, {
                  path: pathToReveal,
                });
              }
              setContextMenu({ visible: false, x: 0, y: 0, node: null });
            }}
          >
            <i className="codicon codicon-folder-opened text-xs flex-shrink-0" />
            <span className="flex-1">在文件资源管理器中显示</span>
            <span className="text-xs text-vscode-foreground-dim">Shift+Alt+R</span>
          </button>

          {/* 复制路径 */}
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={async () => {
              const pathToCopy = contextMenu.node?.path || rootPath;
              if (pathToCopy) {
                try {
                  await window.electronAPI.invoke('clipboard:write-text', {
                    text: pathToCopy,
                  });
                } catch (error) {
                  console.error('Failed to copy path:', error);
                }
              }
              setContextMenu({ visible: false, x: 0, y: 0, node: null });
            }}
          >
            <i className="codicon codicon-link text-xs flex-shrink-0" />
            <span className="flex-1">复制路径</span>
            <span className="text-xs text-vscode-foreground-dim">Shift+Alt+C</span>
          </button>

          {/* 复制相对路径 */}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
              contextMenu.node ? 'hover:bg-vscode-selection-bg/20' : 'opacity-40 cursor-not-allowed'
            }`}
            onClick={
              contextMenu.node
                ? async () => {
                    if (contextMenu.node && rootPath) {
                      const relativePath = contextMenu.node.path.replace(rootPath, '').replace(/^[/\\]/, '');
                      try {
                        await window.electronAPI.invoke('clipboard:write-text', {
                          text: relativePath,
                        });
                      } catch (error) {
                        console.error('Failed to copy relative path:', error);
                      }
                      setContextMenu({ visible: false, x: 0, y: 0, node: null });
                    }
                  }
                : undefined
            }
            disabled={!contextMenu.node}
          >
            <i className="codicon codicon-link text-xs flex-shrink-0" />
            <span className="flex-1">复制相对路径</span>
            <span className="text-xs text-vscode-foreground-dim">Ctrl+K Ctrl+Shift+C</span>
          </button>

          <div className="border-t border-vscode-border my-1" />

          {/* 添加到AI聊天 */}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
              contextMenu.node ? 'hover:bg-vscode-selection-bg/20' : 'opacity-40 cursor-not-allowed'
            }`}
            onClick={contextMenu.node ? handleAddToChat : undefined}
            disabled={!contextMenu.node}
          >
            <i className="codicon codicon-comment text-xs flex-shrink-0" />
            <span className="flex-1">添加到AI聊天</span>
          </button>

          <div className="border-t border-vscode-border my-1" />

          {/* 删除 */}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
              contextMenu.node ? 'hover:bg-vscode-selection-bg/20 text-red-400' : 'opacity-40 cursor-not-allowed'
            }`}
            onClick={contextMenu.node ? handleDelete : undefined}
            disabled={!contextMenu.node}
          >
            <i className="codicon codicon-trash text-xs flex-shrink-0" />
            <span className="flex-1">删除</span>
            <span className="text-xs text-vscode-foreground-dim">Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
