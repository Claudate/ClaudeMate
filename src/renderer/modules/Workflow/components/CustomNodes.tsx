/**
 * Custom Node Components for React Flow
 * Skill-based visual nodes for workflow editor
 */

import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import type { NodeData } from '../../../../main/workflow/types';

/**
 * Skill Node - Purple themed (replaces Claude AI Node)
 */
export const SkillNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const { deleteElements, setNodes } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  // Handle inline name editing
  const handleNameEdit = (e: React.FocusEvent<HTMLDivElement>) => {
    const newName = e.currentTarget.textContent?.trim() || data.label;
    if (newName !== data.label && data.config.type === 'skill') {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: newName,
                  config: { ...node.data.config, name: newName },
                },
              }
            : node
        )
      );
    }
  };

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-lg shadow-none border-2 min-w-[200px] max-w-[300px] overflow-hidden
        ${selected ? 'border-vscode-accent' : 'border-purple-500/50'}
        ${isRunning ? 'animate-pulse' : ''}
        bg-vscode-sidebar-bg break-words
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20 border border-vscode-editor-bg"
        title="删除节点"
      >
        <i className="codicon codicon-chrome-close text-white" style={{ fontSize: '10px' }} />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <i className="codicon codicon-symbol-method text-purple-400 text-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={handleNameEdit}
            className="font-semibold text-sm text-purple-300 truncate outline-none focus:bg-vscode-input-bg focus:px-1 focus:rounded cursor-text"
            title="点击编辑技能名称"
          >
            {data.label}
          </div>
          <div className="text-xs text-vscode-foreground-dim">Skill</div>
        </div>
        {isRunning && <i className="codicon codicon-loading animate-spin text-purple-400 flex-shrink-0" />}
        {isCompleted && <i className="codicon codicon-check text-green-400 flex-shrink-0" />}
        {isFailed && <i className="codicon codicon-error text-red-400 flex-shrink-0" />}
      </div>

      {data.config.type === 'skill' && (
        <div className="text-xs text-vscode-foreground-dim mt-2 line-clamp-2 break-words">
          {data.config.prompt.substring(0, 60)}...
        </div>
      )}

      {data.error && (
        <div className="text-xs text-red-400 mt-2 flex items-start gap-1 break-words">
          <i className="codicon codicon-warning flex-shrink-0 mt-0.5" />
          <span className="break-words">{data.error}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />
    </div>
  );
});

SkillNode.displayName = 'SkillNode';

/**
 * File System Node - Blue themed
 */
export const FileSystemNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-lg shadow-none border-2 min-w-[200px] max-w-[300px] overflow-hidden
        ${selected ? 'border-vscode-accent' : 'border-blue-500/50'}
        ${isRunning ? 'animate-pulse' : ''}
        bg-vscode-sidebar-bg break-words
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20 border border-vscode-editor-bg"
        title="删除节点"
      >
        <i className="codicon codicon-chrome-close text-white" style={{ fontSize: '10px' }} />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <i className="codicon codicon-file text-blue-400 text-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-blue-300 truncate">{data.label}</div>
          <div className="text-xs text-vscode-foreground-dim">
            {data.config.type === 'filesystem' ? data.config.action : 'File Operation'}
          </div>
        </div>
        {isRunning && <i className="codicon codicon-loading animate-spin text-blue-400 flex-shrink-0" />}
        {isCompleted && <i className="codicon codicon-check text-green-400 flex-shrink-0" />}
        {isFailed && <i className="codicon codicon-error text-red-400 flex-shrink-0" />}
      </div>

      {data.config.type === 'filesystem' && (
        <div className="text-xs text-vscode-foreground-dim mt-2 truncate">
          📁 {data.config.path}
        </div>
      )}

      {data.error && (
        <div className="text-xs text-red-400 mt-2 flex items-start gap-1 break-words">
          <i className="codicon codicon-warning flex-shrink-0 mt-0.5" />
          <span className="break-words">{data.error}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />
    </div>
  );
});

FileSystemNode.displayName = 'FileSystemNode';

/**
 * Transform Node - Green themed
 */
export const TransformNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-lg shadow-none border-2 min-w-[200px] max-w-[300px] overflow-hidden
        ${selected ? 'border-vscode-accent' : 'border-green-500/50'}
        ${isRunning ? 'animate-pulse' : ''}
        bg-vscode-sidebar-bg break-words
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20 border border-vscode-editor-bg"
        title="删除节点"
      >
        <i className="codicon codicon-chrome-close text-white" style={{ fontSize: '10px' }} />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <i className="codicon codicon-symbol-misc text-green-400 text-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-green-300 truncate">{data.label}</div>
          <div className="text-xs text-vscode-foreground-dim">Transform</div>
        </div>
        {isRunning && <i className="codicon codicon-loading animate-spin text-green-400 flex-shrink-0" />}
        {isCompleted && <i className="codicon codicon-check text-green-400 flex-shrink-0" />}
        {isFailed && <i className="codicon codicon-error text-red-400 flex-shrink-0" />}
      </div>

      {data.config.type === 'transform' && (
        <div className="text-xs text-vscode-foreground-dim mt-2 truncate">
          {data.config.operation}
        </div>
      )}

      {data.error && (
        <div className="text-xs text-red-400 mt-2 flex items-start gap-1 break-words">
          <i className="codicon codicon-warning flex-shrink-0 mt-0.5" />
          <span className="break-words">{data.error}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />
    </div>
  );
});

TransformNode.displayName = 'TransformNode';

/**
 * Condition Node - Orange themed (diamond shape)
 */
export const ConditionNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-lg shadow-none border-2 min-w-[200px] max-w-[300px] overflow-hidden
        ${selected ? 'border-vscode-accent' : 'border-orange-500/50'}
        ${isRunning ? 'animate-pulse' : ''}
        bg-vscode-sidebar-bg break-words
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20 border border-vscode-editor-bg"
        title="删除节点"
      >
        <i className="codicon codicon-chrome-close text-white" style={{ fontSize: '10px' }} />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <i className="codicon codicon-symbol-operator text-orange-400 text-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-orange-300 truncate">{data.label}</div>
          <div className="text-xs text-vscode-foreground-dim">Condition</div>
        </div>
        {isRunning && <i className="codicon codicon-loading animate-spin text-orange-400 flex-shrink-0" />}
        {isCompleted && <i className="codicon codicon-check text-green-400 flex-shrink-0" />}
        {isFailed && <i className="codicon codicon-error text-red-400 flex-shrink-0" />}
      </div>

      {data.config.type === 'condition' && (
        <div className="text-xs text-vscode-foreground-dim mt-2 font-mono break-words">
          {data.config.condition}
        </div>
      )}

      {data.error && (
        <div className="text-xs text-red-400 mt-2 flex items-start gap-1 break-words">
          <i className="codicon codicon-warning flex-shrink-0 mt-0.5" />
          <span className="break-words">{data.error}</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg"
        style={{ top: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg"
        style={{ top: '65%' }}
      />
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

/**
 * Input Node - Cyan themed
 */
export const InputNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-lg shadow-none border-2 min-w-[180px] max-w-[280px] overflow-hidden
        ${selected ? 'border-vscode-accent' : 'border-cyan-500/50'}
        bg-vscode-sidebar-bg break-words
      `}
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20 border border-vscode-editor-bg"
        title="删除节点"
      >
        <i className="codicon codicon-chrome-close text-white" style={{ fontSize: '10px' }} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <i className="codicon codicon-symbol-variable text-cyan-400 text-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-cyan-300 truncate">{data.label}</div>
          <div className="text-xs text-vscode-foreground-dim">Input</div>
        </div>
      </div>

      {data.config.type === 'input' && (
        <div className="text-xs text-vscode-foreground-dim mt-2 truncate">
          {data.config.variableName}: {data.config.variableType}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />
    </div>
  );
});

InputNode.displayName = 'InputNode';

/**
 * Output Node - Yellow themed
 */
export const OutputNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-lg shadow-none border-2 min-w-[180px] max-w-[280px] overflow-hidden
        ${selected ? 'border-vscode-accent' : 'border-yellow-500/50'}
        bg-vscode-sidebar-bg break-words
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-yellow-500 !w-3 !h-3 !border-2 !border-vscode-editor-bg" />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20 border border-vscode-editor-bg"
        title="删除节点"
      >
        <i className="codicon codicon-chrome-close text-white" style={{ fontSize: '10px' }} />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <i className="codicon codicon-output text-yellow-400 text-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-yellow-300 truncate">{data.label}</div>
          <div className="text-xs text-vscode-foreground-dim">Output</div>
        </div>
      </div>

      {data.config.type === 'output' && (
        <div className="text-xs text-vscode-foreground-dim mt-2 truncate">
          {data.config.variableName}
        </div>
      )}
    </div>
  );
});

OutputNode.displayName = 'OutputNode';

/**
 * Export node types for React Flow
 */
export const nodeTypes = {
  skill: SkillNode,
  filesystem: FileSystemNode,
  transform: TransformNode,
  condition: ConditionNode,
  input: InputNode,
  output: OutputNode,
};
