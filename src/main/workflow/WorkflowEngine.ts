/**
 * Workflow Execution Engine - Skill Orchestration via Claude CLI
 * 将工作流节点转换为 Claude CLI 指令,让 Claude 执行 Skills
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { ClaudeService } from '../services/ClaudeService';
import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowStatus,
  WorkflowEvent,
  NodeExecutionResult,
  WorkflowNode,
  WorkflowEdge,
  NodeStatus,
} from './types';
import { randomBytes } from 'crypto';

const logger = Logger.getInstance('WorkflowEngine');

// 简单的 ID 生成函数,替代 nanoid
function generateId(): string {
  return randomBytes(10).toString('base64url');
}

export class WorkflowEngine extends EventEmitter {
  private static instance: WorkflowEngine;
  private activeExecutions = new Map<string, WorkflowContext>();
  private claudeService: ClaudeService;

  private constructor() {
    super();
    this.claudeService = ClaudeService.getInstance();
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * 执行工作流 - 将节点转换为 Claude 指令并执行
   */
  public async execute(
    definition: WorkflowDefinition,
    initialVariables?: Record<string, any>
  ): Promise<WorkflowContext> {
    const executionId = generateId();
    const context: WorkflowContext = {
      workflowId: definition.id,
      executionId,
      definition,
      variables: { ...definition.variables, ...initialVariables },
      currentNodeId: null,
      status: 'running',
      startTime: Date.now(),
      nodeResults: [],
    };

    this.activeExecutions.set(executionId, context);
    this.emitEvent({
      type: 'started',
      workflowId: definition.id,
      executionId,
      timestamp: Date.now(),
    });

    logger.info(`Starting workflow execution: ${definition.name} (${executionId})`);

    try {
      // 构建节点执行顺序(按依赖关系)
      const executionOrder = this.buildExecutionOrder(definition.nodes, definition.edges);

      logger.debug(`Execution order: ${executionOrder.map(n => n.id).join(' -> ')}`);

      // 依次执行每个节点(让 Claude 执行)
      for (const node of executionOrder) {
        if (context.status === 'cancelled') {
          throw new Error('Workflow cancelled');
        }

        await this.executeNodeViaClaude(node, context);
      }

      // 完成
      context.status = 'completed';
      context.endTime = Date.now();

      this.emitEvent({
        type: 'completed',
        workflowId: definition.id,
        executionId,
        timestamp: Date.now(),
      });

      logger.info(`Workflow completed: ${definition.name} (${executionId})`);
    } catch (error) {
      context.status = 'failed';
      context.endTime = Date.now();
      context.error = error instanceof Error ? error.message : String(error);

      this.emitEvent({
        type: 'failed',
        workflowId: definition.id,
        executionId,
        data: { error: context.error },
        timestamp: Date.now(),
      });

      logger.error(`Workflow failed: ${definition.name} (${executionId})`, error);
    } finally {
      this.activeExecutions.delete(executionId);
    }

    return context;
  }

  /**
   * 取消工作流执行
   */
  public cancel(executionId: string): boolean {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return false;
    }

    context.status = 'cancelled';
    context.endTime = Date.now();

    // 取消 Claude CLI 进程
    this.claudeService.cancel(executionId);

    this.emitEvent({
      type: 'cancelled',
      workflowId: context.workflowId,
      executionId,
      timestamp: Date.now(),
    });

    this.activeExecutions.delete(executionId);
    logger.info(`Workflow cancelled: ${executionId}`);
    return true;
  }

  /**
   * 构建节点执行顺序(拓扑排序)
   */
  private buildExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // 初始化
    nodes.forEach((node) => {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    });

    // 构建邻接表和入度
    edges.forEach((edge) => {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // 拓扑排序(Kahn算法)
    const queue: string[] = [];
    const result: WorkflowNode[] = [];

    // 找到所有入度为0的节点(起始节点)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) {
        result.push(node);
      }

      // 减少相邻节点的入度
      const neighbors = adjList.get(nodeId) || [];
      neighbors.forEach((neighborId) => {
        const newDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          queue.push(neighborId);
        }
      });
    }

    // 检测循环依赖
    if (result.length !== nodes.length) {
      throw new Error('Circular dependency detected in workflow');
    }

    return result;
  }

  /**
   * 通过 Claude CLI 执行单个节点
   */
  private async executeNodeViaClaude(node: WorkflowNode, context: WorkflowContext): Promise<void> {
    context.currentNodeId = node.id;
    const result: NodeExecutionResult = {
      nodeId: node.id,
      nodeType: node.type,
      status: 'running',
      startTime: Date.now(),
    };

    this.emitEvent({
      type: 'node-started',
      workflowId: context.workflowId,
      executionId: context.executionId,
      nodeId: node.id,
      timestamp: Date.now(),
    });

    logger.debug(`Executing node via Claude: ${node.id} (${node.type})`);

    try {
      // 将节点转换为 Claude 指令
      const instruction = this.nodeToClaudeInstruction(node, context);

      logger.debug(`Claude instruction: ${instruction.substring(0, 200)}...`);

      // 通过 Claude CLI 执行
      const response = await this.claudeService.execute({
        message: instruction,
        sessionId: context.executionId,
        model: 'sonnet',
      });

      result.status = 'completed';
      result.output = response;
      result.endTime = Date.now();

      // 解析 Claude 的响应,提取变量
      this.extractVariablesFromResponse(node, response, context);

      this.emitEvent({
        type: 'node-completed',
        workflowId: context.workflowId,
        executionId: context.executionId,
        nodeId: node.id,
        data: { output: response },
        timestamp: Date.now(),
      });

      logger.debug(`Node completed: ${node.id}`);
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.endTime = Date.now();

      this.emitEvent({
        type: 'node-failed',
        workflowId: context.workflowId,
        executionId: context.executionId,
        nodeId: node.id,
        data: { error: result.error },
        timestamp: Date.now(),
      });

      logger.error(`Node failed: ${node.id}`, error);
      throw error;
    }

    context.nodeResults.push(result);
  }

  /**
   * 将节点转换为 Claude 指令
   */
  private nodeToClaudeInstruction(node: WorkflowNode, context: WorkflowContext): string {
    const config = node.data.config;

    // 替换变量
    const substituteVars = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return context.variables[varName] !== undefined
          ? String(context.variables[varName])
          : match;
      });
    };

    switch (config.type) {
      case 'input':
        // Input 节点:设置变量
        return `设置变量 ${config.variableName} = ${context.variables[config.variableName] || config.defaultValue || ''}`;

      case 'skill':
        // Skill 节点:直接使用 prompt
        return substituteVars(config.prompt);

      case 'filesystem':
        // 文件系统节点:让 Claude 执行文件操作
        const path = substituteVars(config.path);
        if (config.action === 'read') {
          return `请读取文件 ${path} 的内容${config.outputVariable ? `，并将内容保存到变量 ${config.outputVariable}` : ''}`;
        } else if (config.action === 'write') {
          const content = config.content ? substituteVars(config.content) : '';
          return `请将以下内容写入文件 ${path}:\n\n${content}`;
        } else if (config.action === 'list') {
          return `请列出目录 ${path} 中的所有文件${config.outputVariable ? `，并将列表保存到变量 ${config.outputVariable}` : ''}`;
        } else if (config.action === 'delete') {
          return `请删除文件 ${path}`;
        }
        break;

      case 'transform':
        // 转换节点:让 Claude 进行数据转换
        const inputs = config.inputs.map(v => `${v}=${context.variables[v]}`).join(', ');
        if (config.operation === 'concat') {
          return `请将这些变量连接起来: ${inputs}${config.outputVariable ? `，结果保存到 ${config.outputVariable}` : ''}`;
        } else if (config.operation === 'format') {
          return `请将这些变量格式化为 JSON: ${inputs}${config.outputVariable ? `，结果保存到 ${config.outputVariable}` : ''}`;
        } else if (config.operation === 'custom' && config.expression) {
          return `请执行以下转换表达式: ${config.expression}，使用变量: ${inputs}${config.outputVariable ? `，结果保存到 ${config.outputVariable}` : ''}`;
        }
        break;

      case 'condition':
        // 条件节点:让 Claude 评估条件
        return `请评估以下条件是否为真: ${config.condition}，当前变量: ${JSON.stringify(context.variables)}`;

      case 'output':
        // Output 节点:输出变量
        const value = context.variables[config.variableName];
        return `请输出变量 ${config.variableName} 的值: ${JSON.stringify(value)}`;

      default:
        return `执行节点: ${node.data.label}`;
    }

    return `执行节点: ${node.data.label}`;
  }

  /**
   * 从 Claude 响应中提取变量
   */
  private extractVariablesFromResponse(
    node: WorkflowNode,
    response: string,
    context: WorkflowContext
  ): void {
    const config = node.data.config;

    // 根据节点类型提取变量
    if (config.type === 'skill' && config.outputVariable) {
      // Skill 节点:整个响应作为变量
      context.variables[config.outputVariable] = response;
    } else if (config.type === 'filesystem' && config.outputVariable) {
      // 文件系统节点:尝试提取文件内容
      context.variables[config.outputVariable] = response;
    } else if (config.type === 'transform' && config.outputVariable) {
      // 转换节点:尝试提取转换结果
      context.variables[config.outputVariable] = response;
    } else if (config.type === 'input') {
      // Input 节点:已经在执行前设置了变量
      if (!context.variables[config.variableName]) {
        context.variables[config.variableName] = config.defaultValue;
      }
    }

    // 通用:尝试从响应中提取格式化的变量定义
    // 例如: "变量 result = xxx"
    const varMatch = response.match(/变量\s+(\w+)\s*=\s*(.+)/);
    if (varMatch) {
      const [, varName, varValue] = varMatch;
      context.variables[varName] = varValue.trim();
    }
  }

  /**
   * 发送事件
   */
  private emitEvent(event: WorkflowEvent): void {
    this.emit('workflow-event', event);
  }

  /**
   * 获取活动执行
   */
  public getActiveExecutions(): WorkflowContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 获取执行上下文
   */
  public getExecution(executionId: string): WorkflowContext | undefined {
    return this.activeExecutions.get(executionId);
  }
}
