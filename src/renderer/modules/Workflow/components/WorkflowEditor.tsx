/**
 * Visual Workflow Editor Component
 * Drag-and-drop node-based workflow builder using React Flow
 */

import { useCallback, useState, useEffect, useRef, DragEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  useReactFlow,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nanoid } from 'nanoid';

import { nodeTypes } from './CustomNodes';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, NodeType } from '../../../../main/workflow/types';

interface WorkflowEditorProps {
  workflow?: WorkflowDefinition;
  onSave?: (workflow: WorkflowDefinition) => void;
  onClose?: () => void;
}

/**
 * Node palette - Available skill nodes that can be added
 */
const NODE_TEMPLATES: Array<{
  type: NodeType;
  label: string;
  icon: string;
  color: string;
  styles: {
    border: string;
    hoverBorder: string;
    iconColor: string;
    textColor: string;
  };
}> = [
  {
    type: 'input',
    label: 'Input',
    icon: 'codicon-symbol-variable',
    color: 'cyan',
    styles: {
      border: 'border-cyan-500/30',
      hoverBorder: 'hover:border-cyan-500/60',
      iconColor: 'text-cyan-400',
      textColor: 'text-cyan-300'
    }
  },
  {
    type: 'skill',
    label: 'Skill',
    icon: 'codicon-symbol-method',
    color: 'purple',
    styles: {
      border: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-500/60',
      iconColor: 'text-purple-400',
      textColor: 'text-purple-300'
    }
  },
  {
    type: 'filesystem',
    label: 'File System',
    icon: 'codicon-file',
    color: 'blue',
    styles: {
      border: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-500/60',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300'
    }
  },
  {
    type: 'transform',
    label: 'Transform',
    icon: 'codicon-symbol-misc',
    color: 'green',
    styles: {
      border: 'border-green-500/30',
      hoverBorder: 'hover:border-green-500/60',
      iconColor: 'text-green-400',
      textColor: 'text-green-300'
    }
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: 'codicon-symbol-operator',
    color: 'orange',
    styles: {
      border: 'border-orange-500/30',
      hoverBorder: 'hover:border-orange-500/60',
      iconColor: 'text-orange-400',
      textColor: 'text-orange-300'
    }
  },
  {
    type: 'output',
    label: 'Output',
    icon: 'codicon-output',
    color: 'yellow',
    styles: {
      border: 'border-yellow-500/30',
      hoverBorder: 'hover:border-yellow-500/60',
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-300'
    }
  },
];

export default function WorkflowEditor({ workflow, onSave, onClose }: WorkflowEditorProps) {
  // Convert workflow nodes to React Flow format
  const initialNodes: Node[] = workflow?.nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  })) || [];

  const initialEdges: Edge[] = workflow?.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: edge.type || 'default',
  })) || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [workflowName, setWorkflowName] = useState(workflow?.name || 'New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '');
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  // React Flow instance reference for drag-and-drop
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Handle edge connection
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds));
    },
    [setEdges]
  );

  // Helper function to create node data based on type
  const createNodeData = useCallback((nodeType: NodeType) => {
    return {
      label: `${nodeType} Node`,
      config: {
        type: nodeType,
        // Default config based on type
        ...(nodeType === 'skill' && {
          name: 'New Skill',
          prompt: 'Enter your prompt here',
          outputVariable: 'response',
        }),
        ...(nodeType === 'filesystem' && {
          action: 'read' as const,
          path: '/path/to/file',
        }),
        ...(nodeType === 'transform' && {
          operation: 'concat' as const,
          inputs: [],
        }),
        ...(nodeType === 'condition' && {
          condition: 'value > 0',
        }),
        ...(nodeType === 'input' && {
          variableName: 'inputVar',
          variableType: 'string' as const,
        }),
        ...(nodeType === 'output' && {
          variableName: 'outputVar',
          format: 'text' as const,
        }),
      },
      status: 'idle',
    } as any;
  }, []);

  // Add new node to canvas (for click-to-add)
  const addNode = useCallback(
    (nodeType: NodeType) => {
      const newNode: Node = {
        id: nanoid(),
        type: nodeType,
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        },
        data: createNodeData(nodeType),
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, createNodeData]
  );

  // Handle drag start from node palette
  const onDragStart = useCallback((event: DragEvent<HTMLButtonElement>, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle drag over canvas
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop on canvas
  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType;

      // Check if the dropped element is a valid node type
      if (typeof nodeType === 'undefined' || !nodeType) {
        return;
      }

      // Get the position where the node was dropped
      if (reactFlowInstance) {
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: Node = {
          id: nanoid(),
          type: nodeType,
          position,
          data: createNodeData(nodeType),
        };

        setNodes((nds) => nds.concat(newNode));
      }
    },
    [reactFlowInstance, setNodes, createNodeData]
  );

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => {
      // Also remove edges connected to deleted nodes
      const deletedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
      return !deletedNodeIds.includes(edge.source) && !deletedNodeIds.includes(edge.target);
    }));
  }, [nodes, setNodes, setEdges]);

  // Handle keyboard shortcuts for delete
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && !event.repeat) {
        // Check if any input is focused
        const activeElement = document.activeElement;
        const isInputFocused = activeElement?.tagName === 'INPUT' ||
                              activeElement?.tagName === 'TEXTAREA' ||
                              activeElement?.hasAttribute('contenteditable');

        if (!isInputFocused) {
          event.preventDefault();
          deleteSelectedNodes();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedNodes]);

  // Track selected nodes
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedNodes(selectedNodes.map(n => n.id));
    },
    []
  );

  // Save workflow as JSON
  const handleSave = useCallback(() => {
    const workflowDefinition: WorkflowDefinition = {
      id: workflow?.id || nanoid(),
      name: workflowName,
      description: workflowDescription,
      category: workflow?.category || 'custom',
      tags: workflow?.tags || [],
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as NodeType,
        position: node.position,
        data: node.data,
      })) as WorkflowNode[],
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label as string | undefined,
        type: (edge.type as 'default' | 'success' | 'error' | undefined) || 'default',
      })) as WorkflowEdge[],
      variables: workflow?.variables || {},
      version: '1.0.0',
      createdAt: workflow?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave?.(workflowDefinition);
  }, [workflow, workflowName, workflowDescription, nodes, edges, onSave]);

  // Export workflow as JSON file
  const handleExportJSON = useCallback(() => {
    const workflowDefinition: WorkflowDefinition = {
      id: workflow?.id || nanoid(),
      name: workflowName,
      description: workflowDescription,
      category: workflow?.category || 'custom',
      tags: workflow?.tags || [],
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as NodeType,
        position: node.position,
        data: node.data,
      })) as WorkflowNode[],
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label as string | undefined,
        type: (edge.type as 'default' | 'success' | 'error' | undefined) || 'default',
      })) as WorkflowEdge[],
      variables: workflow?.variables || {},
      version: '1.0.0',
      createdAt: workflow?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Download as JSON
    const dataStr = JSON.stringify(workflowDefinition, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${workflowName.replace(/\s+/g, '-')}.workflow.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [workflow, workflowName, workflowDescription, nodes, edges]);

  return (
    <div className="h-full flex flex-col bg-vscode-editor-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-vscode-border bg-vscode-sidebar-bg">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onClose}
            className="text-vscode-foreground-dim hover:text-vscode-foreground"
            title="Back"
          >
            <i className="codicon codicon-arrow-left text-xl" />
          </button>
          <div className="flex-1">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="vscode-input text-sm font-semibold w-full"
              placeholder="Workflow Name"
            />
            <input
              type="text"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              className="vscode-input text-xs mt-1 w-full"
              placeholder="Description"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedNodes.length > 0 && (
            <button
              onClick={deleteSelectedNodes}
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
              title={`删除选中的 ${selectedNodes.length} 个节点`}
            >
              <i className="codicon codicon-trash" />
              删除 ({selectedNodes.length})
            </button>
          )}
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-xs vscode-button-secondary flex items-center gap-1"
            title="Export as JSON"
          >
            <i className="codicon codicon-export" />
            导出
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs vscode-button flex items-center gap-1"
          >
            <i className="codicon codicon-save" />
            保存
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Node Palette - Left Sidebar */}
        <div className="w-48 border-r border-vscode-border bg-vscode-sidebar-bg p-3">
          <div className="text-xs font-semibold text-vscode-foreground-dim mb-3 flex items-center gap-1">
            <i className="codicon codicon-symbol-misc" />
            Node Palette
          </div>
          <div className="space-y-2">
            {NODE_TEMPLATES.map((template) => (
              <button
                key={template.type}
                draggable
                onDragStart={(event) => onDragStart(event, template.type)}
                onClick={() => addNode(template.type)}
                className={`
                  w-full p-2 text-left rounded border-2 cursor-grab active:cursor-grabbing
                  ${template.styles.border} ${template.styles.hoverBorder}
                  hover:bg-vscode-input-bg transition-all flex items-center gap-2 text-sm
                `}
                title={`Drag to canvas or click to add ${template.label} node`}
              >
                <i className={`codicon ${template.icon} ${template.styles.iconColor}`} />
                <span className={template.styles.textColor}>{template.label}</span>
              </button>
            ))}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-2 bg-vscode-panel-bg rounded text-xs text-vscode-foreground-dim">
            <div className="font-semibold mb-2 flex items-center gap-1">
              <i className="codicon codicon-lightbulb" />
              Tips
            </div>
            <ul className="space-y-1 text-[10px]">
              <li>• Drag nodes to canvas</li>
              <li>• Or click to add</li>
              <li>• Drag nodes to position</li>
              <li>• Connect handles</li>
              <li>• Double-click to edit</li>
            </ul>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div
          className="flex-1 relative"
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            className="bg-vscode-editor-bg"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="var(--vscode-editorIndentGuide-background)"
            />
            <Controls className="bg-vscode-sidebar-bg border border-vscode-border rounded" />
            <MiniMap
              className="bg-vscode-sidebar-bg border border-vscode-border rounded"
              nodeColor={(node) => {
                const colorMap: Record<string, string> = {
                  claude: '#a855f7',
                  filesystem: '#3b82f6',
                  transform: '#10b981',
                  condition: '#f97316',
                  input: '#06b6d4',
                  output: '#eab308',
                };
                return colorMap[node.type || ''] || '#6b7280';
              }}
            />
          </ReactFlow>
        </div>

        {/* Properties Panel - Right Sidebar */}
        <div className="w-64 border-l border-vscode-border bg-vscode-sidebar-bg p-3 overflow-y-auto">
          <div className="text-xs font-semibold text-vscode-foreground-dim mb-3 flex items-center gap-1">
            <i className="codicon codicon-settings-gear" />
            Properties
          </div>

          <div className="text-xs text-vscode-foreground-dim">
            <div className="mb-2">
              <div className="font-semibold mb-1">Nodes: {nodes.length}</div>
              <div className="font-semibold mb-1">Connections: {edges.length}</div>
            </div>

            <div className="mt-4 p-2 bg-vscode-panel-bg rounded">
              <div className="font-semibold mb-2">Stats</div>
              <ul className="space-y-1 text-[10px]">
                <li>• Claude AI: {nodes.filter(n => n.type === 'claude').length}</li>
                <li>• File System: {nodes.filter(n => n.type === 'filesystem').length}</li>
                <li>• Transform: {nodes.filter(n => n.type === 'transform').length}</li>
                <li>• Condition: {nodes.filter(n => n.type === 'condition').length}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
