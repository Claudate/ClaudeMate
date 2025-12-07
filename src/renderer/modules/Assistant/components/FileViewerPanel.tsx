/**
 * File Viewer Panel
 * VSCode-style file content viewer with tabs, editing, and context menu
 */

import { useState, useEffect, useRef } from 'react';
import { IPCChannels } from '../../../../shared/types/ipc.types';
import { useProjectStore } from '../../../stores/projectStore';
import { useChatStore } from '../../../stores/chatStore';

interface OpenFile {
  name: string;
  path: string;
  content: string;
  originalContent: string; // 用于检测是否有未保存更改
  language: string;
  isDirty: boolean; // 是否有未保存的更改
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  fileIndex: number;
}

interface ContentContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
}

interface FileViewerPanelProps {
  currentFile?: {
    name: string;
    path: string;
    type?: string;
  };
}

export function FileViewerPanel({ currentFile }: FileViewerPanelProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    fileIndex: -1,
  });
  const [contentContextMenu, setContentContextMenu] = useState<ContentContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ⭐⭐⭐ 监听项目变化，切换项目时关闭所有打开的文件
  const currentProject = useProjectStore((state) => state.currentProject);
  const projectPathRef = useRef<string | null>(null);

  useEffect(() => {
    const newProjectPath = currentProject?.path || null;

    // 检查项目是否发生变化
    if (projectPathRef.current !== null && projectPathRef.current !== newProjectPath) {
      console.log('[FileViewer] 🔄 项目切换，关闭所有打开的文件', {
        from: projectPathRef.current,
        to: newProjectPath,
      });

      // 关闭所有打开的文件
      setOpenFiles([]);
      setActiveFileIndex(0);
    }

    // 更新项目路径引用
    projectPathRef.current = newProjectPath;
  }, [currentProject?.path]);

  // 当选中新文件时加载内容
  useEffect(() => {
    console.log('[FileViewer] useEffect triggered', {
      path: currentFile?.path,
      name: currentFile?.name,
      type: currentFile?.type,
      currentOpenFiles: openFiles.length,
    });

    if (currentFile && currentFile.type !== 'folder') {
      loadFile(currentFile.path, currentFile.name);
    }
  }, [currentFile?.path, currentFile?.name, currentFile?.type, currentFile?.timestamp]);

  // 监听 Ctrl+S 保存快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile?.isDirty) {
          handleSaveFile();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileIndex, openFiles]);

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClick = () => {
      setContextMenu({ ...contextMenu, visible: false });
      setContentContextMenu({ ...contentContextMenu, visible: false });
    };
    if (contextMenu.visible || contentContextMenu.visible) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible, contentContextMenu.visible]);

  const loadFile = async (filePath: string, fileName: string) => {
    console.log('[FileViewer] loadFile called', {
      filePath,
      fileName,
      currentOpenFilesCount: openFiles.length,
      openFilesPaths: openFiles.map((f) => f.path),
    });

    setLoading(true);

    // 使用函数式更新来获取最新的 openFiles
    let shouldContinue = true;
    setOpenFiles((currentFiles) => {
      console.log('[FileViewer] Checking in setOpenFiles', {
        filePath,
        currentFilesCount: currentFiles.length,
        currentFilesPaths: currentFiles.map((f) => f.path),
      });

      // 检查文件是否已经打开
      const existingIndex = currentFiles.findIndex((f) => f.path === filePath);
      if (existingIndex !== -1) {
        console.log('[FileViewer] File already open at index', existingIndex);
        setActiveFileIndex(existingIndex);
        setLoading(false);
        shouldContinue = false;
        return currentFiles; // 文件已打开,不做任何更改
      }

      console.log('[FileViewer] File not in list, will load');
      // 文件未打开,继续加载
      return currentFiles;
    });

    if (!shouldContinue) {
      console.log('[FileViewer] Exiting loadFile - file was already open');
      return;
    }

    console.log('[FileViewer] Starting file load from disk');

    try {
      // ⭐⭐⭐ 添加错误处理包装，防止加载大文件卡死
      let result: { content: string } | null = null;

      try {
        result = await window.electronAPI.invoke<{ content: string }>(
          IPCChannels.FS_READ_FILE,
          { path: filePath, encoding: 'utf8' }
        );
      } catch (readError) {
        console.error('[FileViewer] Failed to read file:', readError);
        alert(`无法读取文件: ${fileName}\n\n错误: ${readError instanceof Error ? readError.message : '未知错误'}`);
        setLoading(false);
        return;
      }

      if (result) {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const languageMap: Record<string, string> = {
          ts: 'typescript',
          tsx: 'tsx',
          js: 'javascript',
          jsx: 'jsx',
          json: 'json',
          md: 'markdown',
          css: 'css',
          html: 'html',
          py: 'python',
          java: 'java',
          cpp: 'cpp',
          c: 'c',
          rs: 'rust',
          go: 'go',
          sql: 'sql',
          sh: 'shell',
          yaml: 'yaml',
          yml: 'yaml',
          xml: 'xml',
        };

        const content = result.content || '';
        const newFile: OpenFile = {
          name: fileName,
          path: filePath,
          content,
          originalContent: content, // 保存原始内容
          language: languageMap[ext] || 'text',
          isDirty: false,
        };

        setOpenFiles((currentFiles) => {
          // 再次检查以防竞态条件
          const stillExists = currentFiles.findIndex((f) => f.path === filePath);
          if (stillExists !== -1) {
            setActiveFileIndex(stillExists);
            return currentFiles;
          }

          setActiveFileIndex(currentFiles.length);
          return [...currentFiles, newFile];
        });
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      // 即使失败也添加一个空文件显示错误
      const errorContent = `// 无法加载文件内容\n// 错误: ${error}`;
      const errorFile: OpenFile = {
        name: fileName,
        path: filePath,
        content: errorContent,
        originalContent: errorContent,
        language: 'text',
        isDirty: false,
      };

      setOpenFiles((currentFiles) => {
        setActiveFileIndex(currentFiles.length);
        return [...currentFiles, errorFile];
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存文件
  const handleSaveFile = async () => {
    if (!activeFile || !activeFile.isDirty) return;

    setSaving(true);
    try {
      await window.electronAPI.invoke(IPCChannels.FS_WRITE_FILE, {
        path: activeFile.path,
        content: activeFile.content,
        encoding: 'utf8',
      });

      // 更新文件状态为已保存
      const updatedFiles = [...openFiles];
      updatedFiles[activeFileIndex] = {
        ...activeFile,
        originalContent: activeFile.content,
        isDirty: false,
      };
      setOpenFiles(updatedFiles);
    } catch (error) {
      console.error('Failed to save file:', error);
      alert(`保存失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  // 处理内容变化
  const handleContentChange = (newContent: string) => {
    if (!activeFile) return;

    const updatedFiles = [...openFiles];
    updatedFiles[activeFileIndex] = {
      ...activeFile,
      content: newContent,
      isDirty: newContent !== activeFile.originalContent,
    };
    setOpenFiles(updatedFiles);
  };

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      fileIndex: index,
    });
  };

  const handleCloseFile = (index: number) => {
    const fileToClose = openFiles[index];

    // 如果有未保存的更改,提示用户
    if (fileToClose.isDirty) {
      const confirmed = window.confirm(`${fileToClose.name} 有未保存的更改,确定要关闭吗?`);
      if (!confirmed) return;
    }

    const newOpenFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newOpenFiles);

    if (activeFileIndex >= newOpenFiles.length) {
      setActiveFileIndex(Math.max(0, newOpenFiles.length - 1));
    } else if (activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  // 关闭其他文件
  const handleCloseOthers = (keepIndex: number) => {
    const fileToKeep = openFiles[keepIndex];

    // 检查其他文件是否有未保存的更改
    const hasUnsaved = openFiles.some((f, i) => i !== keepIndex && f.isDirty);
    if (hasUnsaved) {
      const confirmed = window.confirm('部分文件有未保存的更改,确定要关闭吗?');
      if (!confirmed) return;
    }

    setOpenFiles([fileToKeep]);
    setActiveFileIndex(0);
  };

  // 关闭右侧文件
  const handleCloseRight = (fromIndex: number) => {
    const hasUnsaved = openFiles.slice(fromIndex + 1).some((f) => f.isDirty);
    if (hasUnsaved) {
      const confirmed = window.confirm('部分文件有未保存的更改,确定要关闭吗?');
      if (!confirmed) return;
    }

    const newOpenFiles = openFiles.slice(0, fromIndex + 1);
    setOpenFiles(newOpenFiles);

    if (activeFileIndex > fromIndex) {
      setActiveFileIndex(fromIndex);
    }
  };

  // 关闭所有文件
  const handleCloseAll = () => {
    const hasUnsaved = openFiles.some((f) => f.isDirty);
    if (hasUnsaved) {
      const confirmed = window.confirm('部分文件有未保存的更改,确定要关闭所有文件吗?');
      if (!confirmed) return;
    }

    setOpenFiles([]);
    setActiveFileIndex(0);
  };

  // ⭐⭐⭐ 处理内容区域右键菜单
  const handleContentContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea || !activeFile) return;

    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

    // 只有选中文本时才显示菜单
    if (selectedText) {
      e.preventDefault();
      setContentContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        selectedText,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
      });
    }
  };

  // ⭐⭐⭐ 添加选中内容到AI聊天
  const handleAddSelectionToChat = () => {
    if (!contentContextMenu.selectedText || !activeFile) return;

    // 计算选中文本的行号
    const content = activeFile.content;
    const beforeSelection = content.substring(0, contentContextMenu.selectionStart);
    const startLine = beforeSelection.split('\n').length;

    const selectedLines = contentContextMenu.selectedText.split('\n');
    const endLine = startLine + selectedLines.length - 1;

    // 构建要添加到聊天的文本
    const lineInfo = startLine === endLine ? `第 ${startLine} 行` : `第 ${startLine}-${endLine} 行`;
    const textToAdd = `文件: ${activeFile.path}\n${lineInfo}\n\`\`\`\n${contentContextMenu.selectedText}\n\`\`\``;

    // 添加到待输入文本
    const chatStore = useChatStore.getState();
    chatStore.appendToPendingInput(textToAdd);

    setContentContextMenu({ ...contentContextMenu, visible: false });
  };

  const activeFile = openFiles[activeFileIndex];

  return (
    <div className="h-full flex flex-col bg-vscode-editor-bg">
      {/* Tab Bar */}
      <div className="flex items-center bg-vscode-titlebar-bg border-b border-vscode-border overflow-x-auto">
        {openFiles.map((file, index) => (
          <div
            key={file.path}
            className={`flex items-center gap-2 px-3 py-2 border-r border-vscode-border cursor-pointer group relative ${
              index === activeFileIndex
                ? 'bg-vscode-editor-bg'
                : 'bg-vscode-titlebar-bg hover:bg-vscode-selection-bg/10'
            }`}
            onClick={() => setActiveFileIndex(index)}
            onContextMenu={(e) => handleContextMenu(e, index)}
          >
            {/* File Icon */}
            <i className="codicon codicon-file text-sm" />

            {/* File Name */}
            <span className="text-sm whitespace-nowrap">{file.name}</span>

            {/* Dirty Indicator (未保存的圆点) */}
            {file.isDirty && (
              <span className="w-2 h-2 bg-vscode-accent rounded-full" title="有未保存的更改" />
            )}

            {/* Close Button */}
            <button
              className={`${
                file.isDirty ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              } hover:bg-vscode-selection-bg/20 rounded p-0.5 transition-opacity`}
              onClick={(e) => {
                e.stopPropagation();
                handleCloseFile(index);
              }}
            >
              <i className="codicon codicon-close text-xs" />
            </button>

            {/* Active Indicator */}
            {index === activeFileIndex && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-vscode-accent" />
            )}
          </div>
        ))}

        {/* Empty State */}
        {openFiles.length === 0 && (
          <div className="px-3 py-2 text-xs text-vscode-foreground-dim">
            没有打开的文件
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-vscode-menu-bg border border-vscode-border rounded shadow-lg py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              handleCloseFile(contextMenu.fileIndex);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            <i className="codicon codicon-close text-xs" />
            关闭
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              handleCloseOthers(contextMenu.fileIndex);
              setContextMenu({ ...contextMenu, visible: false });
            }}
            disabled={openFiles.length === 1}
          >
            <i className="codicon codicon-close-all text-xs" />
            关闭其他
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              handleCloseRight(contextMenu.fileIndex);
              setContextMenu({ ...contextMenu, visible: false });
            }}
            disabled={contextMenu.fileIndex === openFiles.length - 1}
          >
            <i className="codicon codicon-arrow-right text-xs" />
            关闭右侧
          </button>
          <div className="border-t border-vscode-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              handleCloseAll();
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            <i className="codicon codicon-close-all text-xs" />
            关闭所有
          </button>
        </div>
      )}

      {/* Editor Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-vscode-foreground-dim">
            <i className="codicon codicon-loading animate-spin text-4xl mb-4 block" />
            <p className="text-sm">加载中...</p>
          </div>
        </div>
      ) : activeFile ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* File Path & Actions Bar */}
          <div className="flex items-center justify-between px-4 py-2 text-xs bg-vscode-editor-bg border-b border-vscode-border">
            <span className="text-vscode-foreground-dim truncate flex-1">{activeFile.path}</span>
            <div className="flex items-center gap-2 ml-4">
              {activeFile.isDirty && (
                <button
                  className="px-3 py-1 bg-vscode-button-bg hover:bg-vscode-button-hover text-vscode-button-fg rounded text-xs flex items-center gap-1.5 disabled:opacity-50"
                  onClick={handleSaveFile}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <i className="codicon codicon-loading animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <i className="codicon codicon-save" />
                      保存 (Ctrl+S)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Editable Textarea */}
          <textarea
            ref={textareaRef}
            className="flex-1 p-4 text-sm font-mono leading-relaxed bg-vscode-editor-bg text-vscode-foreground resize-none outline-none"
            value={activeFile.content}
            onChange={(e) => handleContentChange(e.target.value)}
            onContextMenu={handleContentContextMenu}
            spellCheck={false}
            style={{
              tabSize: 2,
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-vscode-foreground-dim">
          <div className="text-center">
            <i className="codicon codicon-file-code text-6xl opacity-20 mb-4 block" />
            <p className="text-sm">没有打开的文件</p>
            <p className="text-xs mt-2 opacity-70">从资源管理器中选择一个文件打开</p>
          </div>
        </div>
      )}

      {/* ⭐⭐⭐ 内容选择右键菜单 */}
      {contentContextMenu.visible && (
        <div
          className="fixed z-50 bg-vscode-menu-bg border border-vscode-border rounded shadow-lg py-1 min-w-[200px]"
          style={{ left: contentContextMenu.x, top: contentContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={handleAddSelectionToChat}
          >
            <i className="codicon codicon-comment text-xs flex-shrink-0" />
            <span className="flex-1">添加到AI聊天</span>
          </button>
          <div className="border-t border-vscode-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-vscode-selection-bg/20 flex items-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(contentContextMenu.selectedText);
              setContentContextMenu({ ...contentContextMenu, visible: false });
            }}
          >
            <i className="codicon codicon-copy text-xs flex-shrink-0" />
            <span className="flex-1">复制</span>
            <span className="text-xs text-vscode-foreground-dim">Ctrl+C</span>
          </button>
        </div>
      )}
    </div>
  );
}
