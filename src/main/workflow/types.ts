/**
 * Workflow Type Definitions
 * Visual node-based workflow system for Claude AI automation with JSON persistence
 */

/**
 * Workflow node types (mapped to Skills)
 */
export type NodeType = 'skill' | 'filesystem' | 'transform' | 'condition' | 'input' | 'output';

/**
 * Workflow node status
 */
export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Visual node position (React Flow)
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Base workflow node (visual representation)
 */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  data: NodeData;
}

/**
 * Node data union type
 */
export type NodeData = {
  label: string;
  config: NodeConfig;
  status?: NodeStatus;
  output?: any;
  error?: string;
};

/**
 * Workflow edge (connection between nodes)
 */
export interface WorkflowEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  label?: string;
  type?: 'default' | 'success' | 'error';
}

/**
 * Node configuration union type
 */
export type NodeConfig = SkillNodeConfig | FileSystemNodeConfig | TransformNodeConfig | ConditionNodeConfig | InputNodeConfig | OutputNodeConfig;

/**
 * Skill node configuration (replaces Claude AI node)
 */
export interface SkillNodeConfig {
  type: 'skill';
  name: string; // Editable skill name
  prompt: string; // User prompt or description
  toolUses?: string[]; // List of tools used in this skill
  outputVariable?: string; // Variable name to store response
}

/**
 * File system node configuration
 */
export interface FileSystemNodeConfig {
  type: 'filesystem';
  action: 'read' | 'write' | 'list' | 'delete';
  path: string; // Can use {{variableName}}
  content?: string; // For write action, can use {{variableName}}
  outputVariable?: string;
}

/**
 * Transform node configuration
 */
export interface TransformNodeConfig {
  type: 'transform';
  operation: 'concat' | 'extract' | 'format' | 'custom';
  inputs: string[]; // Variable names
  expression?: string; // JS expression for custom transform
  outputVariable?: string;
}

/**
 * Condition node configuration
 */
export interface ConditionNodeConfig {
  type: 'condition';
  condition: string; // JS expression that returns boolean
}

/**
 * Input node configuration
 */
export interface InputNodeConfig {
  type: 'input';
  variableName: string;
  variableType: 'string' | 'number' | 'boolean' | 'file';
  defaultValue?: any;
  description?: string;
}

/**
 * Output node configuration
 */
export interface OutputNodeConfig {
  type: 'output';
  variableName: string;
  format?: 'text' | 'json' | 'file';
}

/**
 * Workflow definition (JSON-serializable)
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'writing' | 'analysis' | 'automation' | 'custom';
  tags?: string[];
  projectPath?: string; // ⭐ 关联的项目路径（用于按项目筛选）
  projectName?: string; // ⭐ 关联的项目名称
  nodes: WorkflowNode[]; // Visual nodes
  edges: WorkflowEdge[]; // Connections between nodes
  variables: Record<string, any>; // Initial variables
  version: string; // Workflow version for compatibility
  createdAt: number;
  updatedAt: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  definition: WorkflowDefinition;
  variables: Record<string, any>; // Runtime variables
  currentNodeId: string | null;
  status: WorkflowStatus;
  startTime: number;
  endTime?: number;
  error?: string;
  nodeResults: NodeExecutionResult[];
}

/**
 * Node execution result
 */
export interface NodeExecutionResult {
  nodeId: string;
  nodeType: NodeType;
  status: NodeStatus;
  startTime: number;
  endTime?: number;
  output?: any;
  error?: string;
}

/**
 * Workflow execution event
 */
export interface WorkflowEvent {
  type: 'started' | 'node-started' | 'node-completed' | 'node-failed' | 'completed' | 'failed' | 'cancelled';
  workflowId: string;
  executionId: string;
  nodeId?: string;
  data?: any;
  timestamp: number;
}

/**
 * Workflow execution rules
 */
export interface WorkflowRules {
  maxExecutionTime?: number; // Max execution time in milliseconds
  maxNodes?: number; // Max number of nodes
  allowConcurrent?: boolean; // Allow concurrent node execution
  retryOnError?: boolean; // Retry failed nodes
  maxRetries?: number; // Max retry attempts
}
