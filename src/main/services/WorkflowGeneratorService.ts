/**
 * Workflow Generator Service
 * Automatically generates workflow definitions from Claude conversation history
 */

import { randomBytes } from 'crypto';
import { Logger } from '../utils/Logger';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  SkillNodeConfig,
  FileSystemNodeConfig,
  TransformNodeConfig
} from '../workflow/types';

const logger = Logger.getInstance('WorkflowGeneratorService');

/**
 * Generate a unique ID (alternative to nanoid for CommonJS compatibility)
 */
function generateId(): string {
  return randomBytes(12).toString('base64url');
}

/**
 * Message structure from chat history
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolUses?: ToolUse[];
}

/**
 * Tool use extracted from conversation
 */
interface ToolUse {
  name: string;
  input: Record<string, any>;
  output?: any;
  timestamp: number;
}

/**
 * Workflow generation options
 */
interface GenerationOptions {
  projectPath?: string;
  projectName?: string;
  includeUserPrompts?: boolean;  // Include user messages as Claude nodes
  minToolUses?: number;           // Minimum tool uses to create a workflow
  autoLayout?: boolean;           // Auto-layout nodes
}

export class WorkflowGeneratorService {
  private static instance: WorkflowGeneratorService;

  private constructor() {}

  public static getInstance(): WorkflowGeneratorService {
    if (!WorkflowGeneratorService.instance) {
      WorkflowGeneratorService.instance = new WorkflowGeneratorService();
    }
    return WorkflowGeneratorService.instance;
  }

  /**
   * Generate workflow from conversation messages
   */
  public generateWorkflowFromConversation(
    messages: ChatMessage[],
    options: GenerationOptions = {}
  ): WorkflowDefinition | null {
    const {
      projectPath = '',
      projectName = 'Unknown Project',
      includeUserPrompts = true,
      minToolUses = 2,
      autoLayout = true
    } = options;

    logger.info(`Generating workflow from ${messages.length} messages`);

    // Extract tool uses from conversation
    const toolUses = this.extractToolUses(messages);

    // ⭐⭐⭐ 即使没有 toolUses，只要有用户消息就可以生成 Skill 工作流
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      logger.info(`No user messages found, skipping workflow generation`);
      return null;
    }

    // Analyze conversation to determine workflow category and description
    const analysis = this.analyzeConversation(messages, toolUses);

    // Generate nodes from tool uses (Skill Workflow - no input/output nodes)
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    let previousNodeId: string | null = null;
    let currentY = 0;
    const nodeSpacingY = 150;
    const nodeSpacingX = 300;

    // Add user prompts and tool execution nodes
    let nodeIndex = 0;
    for (const message of messages) {
      if (message.role === 'user' && includeUserPrompts) {
        // Create Skill node for user prompt
        const skillNode = this.createSkillNode(
          nodeSpacingX,
          currentY,
          message.content.substring(0, 100), // Truncate long prompts
          nodeIndex++,
          'User Prompt'
        );
        nodes.push(skillNode);

        // Connect to previous node if exists
        if (previousNodeId) {
          edges.push(this.createEdge(previousNodeId, skillNode.id));
        }
        previousNodeId = skillNode.id;
        currentY += nodeSpacingY;
      } else if (message.role === 'assistant' && message.toolUses) {
        // Create nodes for each tool use
        for (const toolUse of message.toolUses) {
          const toolNode = this.createNodeFromToolUse(
            nodeSpacingX,
            currentY,
            toolUse,
            nodeIndex++
          );

          if (toolNode) {
            nodes.push(toolNode);

            // Connect to previous node if exists
            if (previousNodeId) {
              edges.push(this.createEdge(previousNodeId, toolNode.id));
            }
            previousNodeId = toolNode.id;
            currentY += nodeSpacingY;
          }
        }
      }
    }

    // Create workflow definition
    const workflow: WorkflowDefinition = {
      id: generateId(),
      name: this.generateWorkflowName(analysis),
      description: analysis.description,
      category: analysis.category,
      tags: this.generateTags(analysis, toolUses),
      nodes,
      edges,
      variables: {
        projectPath,
        projectName,
      },
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    logger.info(`Generated workflow: ${workflow.name} with ${nodes.length} nodes`);
    return workflow;
  }

  /**
   * Extract tool uses from messages
   */
  private extractToolUses(messages: ChatMessage[]): ToolUse[] {
    const toolUses: ToolUse[] = [];

    for (const message of messages) {
      if (message.role === 'assistant' && message.toolUses) {
        toolUses.push(...message.toolUses);
      }
    }

    return toolUses;
  }

  /**
   * Analyze conversation to determine category and description
   */
  private analyzeConversation(messages: ChatMessage[], toolUses: ToolUse[]): {
    category: WorkflowDefinition['category'];
    description: string;
    intent: string;
  } {
    const toolNames = toolUses.map(t => t.name);
    const hasFileOps = toolNames.some(n => ['Read', 'Write', 'Edit', 'Glob'].includes(n));
    const hasBash = toolNames.includes('Bash');
    const hasGrep = toolNames.includes('Grep');

    // Get first user message for intent
    const firstUserMessage = messages.find(m => m.role === 'user');
    const intent = firstUserMessage?.content || '';

    let category: WorkflowDefinition['category'] = 'custom';
    let description = 'Auto-generated workflow from conversation';

    // Determine category based on tool usage patterns
    if (hasFileOps && hasBash) {
      category = 'automation';
      description = 'Automated file processing and execution workflow';
    } else if (hasFileOps && hasGrep) {
      category = 'analysis';
      description = 'Code analysis and search workflow';
    } else if (hasFileOps) {
      category = 'coding';
      description = 'File manipulation and code editing workflow';
    } else if (toolNames.includes('WebFetch') || toolNames.includes('WebSearch')) {
      category = 'analysis';
      description = 'Research and data gathering workflow';
    }

    // Enhance description with intent
    if (intent.length > 0 && intent.length < 100) {
      description = `${intent.substring(0, 80)}...`;
    }

    return { category, description, intent };
  }

  /**
   * Generate workflow name from analysis
   */
  private generateWorkflowName(analysis: { intent: string; category: string }): string {
    const { intent, category } = analysis;

    // Try to extract a concise name from intent
    if (intent) {
      const words = intent.split(/\s+/).slice(0, 5);
      const name = words.join(' ');
      if (name.length <= 50) {
        return name;
      }
    }

    // Fallback to category-based name
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${category.charAt(0).toUpperCase() + category.slice(1)} Workflow - ${timestamp}`;
  }

  /**
   * Generate tags from analysis
   */
  private generateTags(
    analysis: { category: string },
    toolUses: ToolUse[]
  ): string[] {
    const tags = new Set<string>();

    tags.add(analysis.category);
    tags.add('auto-generated');

    // Add tags based on tool usage
    const toolNames = toolUses.map(t => t.name);
    if (toolNames.includes('Read') || toolNames.includes('Write')) {
      tags.add('file-operations');
    }
    if (toolNames.includes('Bash')) {
      tags.add('shell');
    }
    if (toolNames.includes('Grep')) {
      tags.add('search');
    }
    if (toolNames.includes('WebFetch') || toolNames.includes('WebSearch')) {
      tags.add('web');
    }

    return Array.from(tags);
  }

  /**
   * Create input node
   */
  private createInputNode(x: number, y: number): WorkflowNode {
    return {
      id: generateId(),
      type: 'input',
      position: { x, y },
      data: {
        label: 'Input',
        config: {
          type: 'input',
          variableName: 'userInput',
          variableType: 'string',
          description: 'Initial user input',
        },
        status: 'idle',
      },
    };
  }

  /**
   * Create output node
   */
  private createOutputNode(x: number, y: number): WorkflowNode {
    return {
      id: generateId(),
      type: 'output',
      position: { x, y },
      data: {
        label: 'Output',
        config: {
          type: 'output',
          variableName: 'result',
          format: 'text',
        },
        status: 'idle',
      },
    };
  }

  /**
   * Create Skill node (replaces Claude AI node)
   */
  private createSkillNode(x: number, y: number, prompt: string, index: number, skillName?: string): WorkflowNode {
    const config: SkillNodeConfig = {
      type: 'skill',
      name: skillName || `Skill ${index + 1}`,
      prompt,
      outputVariable: `skill_response_${index}`,
    };

    return {
      id: generateId(),
      type: 'skill',
      position: { x, y },
      data: {
        label: config.name,
        config,
        status: 'idle',
      },
    };
  }

  /**
   * Create node from tool use
   */
  private createNodeFromToolUse(
    x: number,
    y: number,
    toolUse: ToolUse,
    index: number
  ): WorkflowNode | null {
    const { name, input } = toolUse;

    // Map tool names to node types
    switch (name) {
      case 'Read':
      case 'Write':
      case 'Edit':
      case 'Glob':
        return this.createFileSystemNode(x, y, name, input, index);

      case 'Grep':
        return this.createFileSystemNode(x, y, 'Read', input, index);

      case 'Bash':
        return this.createSkillNode(x, y, `Execute: ${input.command || 'command'}`, index, `Bash: ${(input.command || 'command').substring(0, 20)}`);

      default:
        // For other tools, create a transform node
        return this.createTransformNode(x, y, name, index);
    }
  }

  /**
   * Create file system node
   */
  private createFileSystemNode(
    x: number,
    y: number,
    toolName: string,
    input: Record<string, any>,
    index: number
  ): WorkflowNode {
    let action: FileSystemNodeConfig['action'] = 'read';
    let path = '';
    let content = '';

    if (toolName === 'Read') {
      action = 'read';
      path = input.file_path || input.path || '';
    } else if (toolName === 'Write') {
      action = 'write';
      path = input.file_path || input.path || '';
      content = input.content || '';
    } else if (toolName === 'Glob') {
      action = 'list';
      path = input.pattern || input.path || '';
    }

    const config: FileSystemNodeConfig = {
      type: 'filesystem',
      action,
      path,
      content,
      outputVariable: `file_${action}_${index}`,
    };

    return {
      id: generateId(),
      type: 'filesystem',
      position: { x, y },
      data: {
        label: `File ${action.charAt(0).toUpperCase() + action.slice(1)} ${index + 1}`,
        config,
        status: 'idle',
      },
    };
  }

  /**
   * Create transform node
   */
  private createTransformNode(
    x: number,
    y: number,
    operation: string,
    index: number
  ): WorkflowNode {
    const config: TransformNodeConfig = {
      type: 'transform',
      operation: 'custom',
      inputs: [],
      expression: `// ${operation} operation`,
      outputVariable: `transform_${index}`,
    };

    return {
      id: generateId(),
      type: 'transform',
      position: { x, y },
      data: {
        label: `Transform ${index + 1}`,
        config,
        status: 'idle',
      },
    };
  }

  /**
   * Create edge between nodes
   */
  private createEdge(sourceId: string, targetId: string): WorkflowEdge {
    return {
      id: generateId(),
      source: sourceId,
      target: targetId,
      type: 'default',
    };
  }

  /**
   * Update existing workflow from new conversation
   */
  public updateWorkflowFromConversation(
    existingWorkflow: WorkflowDefinition,
    newMessages: ChatMessage[],
    options: GenerationOptions = {}
  ): WorkflowDefinition {
    logger.info(`Updating workflow: ${existingWorkflow.name}`);

    // Generate new workflow from new messages
    const newWorkflow = this.generateWorkflowFromConversation(newMessages, options);

    if (!newWorkflow) {
      // No significant changes, return existing
      return {
        ...existingWorkflow,
        updatedAt: Date.now(),
      };
    }

    // Merge workflows: append new nodes to existing (Skill Workflow - no input/output)
    const lastExistingNode = existingWorkflow.nodes[existingWorkflow.nodes.length - 1];

    // Calculate offset for new nodes
    const maxY = existingWorkflow.nodes.length > 0
      ? Math.max(...existingWorkflow.nodes.map(n => n.position.y))
      : 0;
    const yOffset = maxY + 150;

    // Add all new nodes
    const newNodesToAdd = newWorkflow.nodes.map(n => ({
      ...n,
      id: generateId(), // Generate new IDs
      position: { x: n.position.x, y: n.position.y + yOffset },
    }));

    // Connect last existing node to first new node
    const newEdges: WorkflowEdge[] = [...existingWorkflow.edges];
    if (newNodesToAdd.length > 0 && lastExistingNode) {
      newEdges.push({
        id: generateId(),
        source: lastExistingNode.id,
        target: newNodesToAdd[0].id,
        type: 'default',
      });

      // Add edges between new nodes
      for (let i = 0; i < newNodesToAdd.length - 1; i++) {
        newEdges.push({
          id: generateId(),
          source: newNodesToAdd[i].id,
          target: newNodesToAdd[i + 1].id,
          type: 'default',
        });
      }
    }

    return {
      ...existingWorkflow,
      nodes: [...existingWorkflow.nodes, ...newNodesToAdd],
      edges: newEdges,
      updatedAt: Date.now(),
    };
  }
}
