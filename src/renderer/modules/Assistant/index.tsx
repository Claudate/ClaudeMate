/**
 * Assistant Module - VSCode Full Layout
 * Resizable Three-Column Layout
 * Left: File Explorer | Center: File Viewer | Right: Claude Code Panel
 */

import { useState, useEffect, useRef } from 'react';
import { ResizablePanel } from './components/ResizablePanel';
import { FileExplorerPanel } from './components/FileExplorerPanel';
import { FileViewerPanel } from './components/FileViewerPanel';
import { ClaudeCodePanel } from './components/ClaudeCodePanel';
import { PermissionDialog } from '../../components/PermissionDialog';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';

export default function Assistant() {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    path: string;
    type?: string;
    timestamp?: number; // 添加时间戳强制更新
  }>();

  // ⭐ 获取授权请求状态
  const permissionRequest = useChatStore((state) => state.permissionRequest);
  const respondToPermission = useChatStore((state) => state.respondToPermission);

  // ⭐⭐⭐ 监听项目变化，切换项目时清空选中的文件
  const currentProject = useProjectStore((state) => state.currentProject);
  const projectPathRef = useRef<string | null>(null);

  useEffect(() => {
    const newProjectPath = currentProject?.path || null;

    // 检查项目是否发生变化
    if (projectPathRef.current !== null && projectPathRef.current !== newProjectPath) {
      console.log('[Assistant] 🔄 项目切换，清空选中的文件', {
        from: projectPathRef.current,
        to: newProjectPath,
      });

      // 清空选中的文件
      setSelectedFile(undefined);
    }

    // 更新项目路径引用
    projectPathRef.current = newProjectPath;
  }, [currentProject?.path]);

  const handleFileSelect = (file: { name: string; path: string; type?: string }) => {
    // 强制创建新对象,并添加时间戳确保每次点击都会触发更新
    setSelectedFile({
      name: file.name,
      path: file.path,
      type: file.type,
      timestamp: Date.now(), // 每次点击生成新的时间戳
    });
  };

  return (
    <div className="h-full flex overflow-hidden bg-vscode-editor-bg">
      {/* Left Panel: File Explorer - Resizable */}
      <ResizablePanel
        defaultSize={256}
        minSize={200}
        maxSize={500}
        direction="horizontal"
        position="left"
      >
        <FileExplorerPanel onFileSelect={handleFileSelect} />
      </ResizablePanel>

      {/* Center Panel: File Viewer - Flexible */}
      <div className="flex-1 overflow-hidden">
        <FileViewerPanel currentFile={selectedFile} />
      </div>

      {/* Right Panel: Claude Code - Resizable */}
      <ResizablePanel
        defaultSize={384}
        minSize={300}
        maxSize={600}
        direction="horizontal"
        position="right"
      >
        <ClaudeCodePanel />
      </ResizablePanel>

      {/* ⭐ Permission Dialog - 授权对话框 (手动模式) */}
      <PermissionDialog
        request={permissionRequest}
        onResponse={respondToPermission}
      />
    </div>
  );
}
