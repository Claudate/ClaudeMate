/**
 * File Explorer Module
 * Browse project files with VSCode-style tree view
 */

import { useState } from 'react';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  isExpanded?: boolean;
  size?: number;
  modified?: number;
}

export default function FileExplorer() {
  const [currentPath, setCurrentPath] = useState('C:\\Users\\Projects\\example');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([
    {
      id: '1',
      name: 'src',
      type: 'folder',
      path: 'C:\\Users\\Projects\\example\\src',
      isExpanded: true,
      children: [
        {
          id: '1-1',
          name: 'components',
          type: 'folder',
          path: 'C:\\Users\\Projects\\example\\src\\components',
          isExpanded: false,
          children: [
            {
              id: '1-1-1',
              name: 'Button.tsx',
              type: 'file',
              path: 'C:\\Users\\Projects\\example\\src\\components\\Button.tsx',
              size: 1024,
              modified: Date.now() - 1000 * 60 * 30,
            },
          ],
        },
        {
          id: '1-2',
          name: 'index.ts',
          type: 'file',
          path: 'C:\\Users\\Projects\\example\\src\\index.ts',
          size: 512,
          modified: Date.now() - 1000 * 60 * 60,
        },
      ],
    },
    {
      id: '2',
      name: 'package.json',
      type: 'file',
      path: 'C:\\Users\\Projects\\example\\package.json',
      size: 2048,
      modified: Date.now() - 1000 * 60 * 60 * 24,
    },
    {
      id: '3',
      name: 'README.md',
      type: 'file',
      path: 'C:\\Users\\Projects\\example\\README.md',
      size: 4096,
      modified: Date.now() - 1000 * 60 * 60 * 2,
    },
  ]);

  const toggleFolder = (nodeId: string, nodes: FileNode[] = fileTree): FileNode[] => {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, isExpanded: !node.isExpanded };
      }
      if (node.children) {
        return { ...node, children: toggleFolder(nodeId, node.children) };
      }
      return node;
    });
  };

  const handleNodeClick = (node: FileNode) => {
    if (node.type === 'folder') {
      setFileTree(toggleFolder(node.id));
    } else {
      setSelectedFile(node.id);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'folder') return 'codicon-folder';

    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'codicon-symbol-namespace';
      case 'js':
      case 'jsx':
        return 'codicon-symbol-method';
      case 'json':
        return 'codicon-json';
      case 'md':
        return 'codicon-markdown';
      case 'css':
      case 'scss':
        return 'codicon-symbol-color';
      case 'html':
        return 'codicon-symbol-tag';
      default:
        return 'codicon-file';
    }
  };

  const renderFileTree = (nodes: FileNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div
          onClick={() => handleNodeClick(node)}
          className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-vscode-selection-bg/30 ${
            selectedFile === node.id ? 'bg-vscode-selection-bg' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === 'folder' && (
            <i
              className={`codicon ${
                node.isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'
              } text-xs`}
            />
          )}
          <i className={`codicon ${getFileIcon(node.name, node.type)}`} />
          <span className="flex-1">{node.name}</span>
          {node.type === 'file' && node.size && (
            <span className="text-xs text-vscode-foreground-dim">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
        {node.type === 'folder' && node.isExpanded && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const selectedNode = selectedFile
    ? (() => {
        const findNode = (nodes: FileNode[]): FileNode | null => {
          for (const node of nodes) {
            if (node.id === selectedFile) return node;
            if (node.children) {
              const found = findNode(node.children);
              if (found) return found;
            }
          }
          return null;
        };
        return findNode(fileTree);
      })()
    : null;

  return (
    <div className="h-full flex flex-col bg-vscode-editor-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-vscode-border bg-vscode-sidebar-bg">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <i className="codicon codicon-files text-vscode-accent text-2xl" />
            File Explorer
          </h1>
          <p className="text-xs text-vscode-foreground-dim mt-1 flex items-center gap-1">
            <i className="codicon codicon-folder" />
            {currentPath}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-sm bg-vscode-input-bg hover:bg-vscode-input-border rounded transition-colors border border-vscode-border"
            title="Refresh"
          >
            <i className="codicon codicon-refresh" />
          </button>
          <button
            className="px-2 py-1 text-sm bg-vscode-input-bg hover:bg-vscode-input-border rounded transition-colors border border-vscode-border"
            title="New file"
          >
            <i className="codicon codicon-new-file" />
          </button>
          <button
            className="px-2 py-1 text-sm bg-vscode-input-bg hover:bg-vscode-input-border rounded transition-colors border border-vscode-border"
            title="New folder"
          >
            <i className="codicon codicon-new-folder" />
          </button>
        </div>
      </div>

      {/* Content - Split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Tree */}
        <div className="w-1/3 border-r border-vscode-border overflow-y-auto">
          <div className="py-2">{renderFileTree(fileTree)}</div>
        </div>

        {/* File Details */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedNode ? (
            <div className="space-y-4">
              {/* File Info Card */}
              <div className="vscode-panel p-4">
                <div className="flex items-start gap-4">
                  <i
                    className={`codicon ${getFileIcon(
                      selectedNode.name,
                      selectedNode.type
                    )} text-4xl text-vscode-accent`}
                  />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1">
                      {selectedNode.name}
                    </h2>
                    <p className="text-sm text-vscode-foreground-dim">
                      {selectedNode.type === 'folder' ? 'Folder' : 'File'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Properties */}
              <div className="vscode-panel p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <i className="codicon codicon-info" />
                  Properties
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-vscode-foreground-dim">Path:</span>
                    <span className="font-mono text-xs">{selectedNode.path}</span>
                  </div>
                  {selectedNode.size !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-vscode-foreground-dim">Size:</span>
                      <span>{formatFileSize(selectedNode.size)}</span>
                    </div>
                  )}
                  {selectedNode.modified && (
                    <div className="flex justify-between">
                      <span className="text-vscode-foreground-dim">Modified:</span>
                      <span>{formatDate(selectedNode.modified)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-vscode-foreground-dim">Type:</span>
                    <span>
                      {selectedNode.type === 'folder'
                        ? 'Folder'
                        : selectedNode.name.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="vscode-panel p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <i className="codicon codicon-tools" />
                  Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button className="vscode-button-secondary text-sm flex items-center gap-1">
                    <i className="codicon codicon-go-to-file" />
                    Open
                  </button>
                  <button className="vscode-button-secondary text-sm flex items-center gap-1">
                    <i className="codicon codicon-edit" />
                    Rename
                  </button>
                  <button className="vscode-button-secondary text-sm flex items-center gap-1">
                    <i className="codicon codicon-copy" />
                    Copy Path
                  </button>
                  <button className="vscode-button-secondary text-sm flex items-center gap-1 text-red-400">
                    <i className="codicon codicon-trash" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
              <div className="text-center">
                <i className="codicon codicon-files text-6xl opacity-30 mb-4 block" />
                <p className="text-sm">Select a file or folder to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
