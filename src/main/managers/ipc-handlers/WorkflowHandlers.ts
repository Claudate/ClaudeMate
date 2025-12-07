/**
 * Workflow Handlers - 工作流管理相关的 IPC 处理器
 */

import { z } from 'zod';
import { BaseHandler } from './BaseHandler';
import {
  IPCChannels,
  IPCChannel,
  WorkflowGenerateFromConversationSchema,
  WorkflowGetByProjectSchema,
} from '../../../shared/types/ipc.types';

export class WorkflowHandlers extends BaseHandler {
  private dbService: any;
  private workflowEngine: any;

  constructor() {
    super('Workflow');
    const { DatabaseService } = require('../../services/DatabaseService');
    const { WorkflowEngine } = require('../../workflow/WorkflowEngine');
    this.dbService = DatabaseService.getInstance();
    this.workflowEngine = WorkflowEngine.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void,
    sendToRenderer?: (channel: string, ...args: unknown[]) => void
  ): void {
    // 基础 CRUD
    this.registerBasicOperations(registerFn);

    // 执行和取消
    this.registerExecutionOperations(registerFn);

    // 生成和过滤
    this.registerAdvancedOperations(registerFn);

    // 设置事件转发
    if (sendToRenderer) {
      this.workflowEngine.on('workflow-event', (event: any) => {
        sendToRenderer('workflow:event', event);
      });
    }

    this.logger.info('Workflow IPC handlers registered');
  }

  private registerBasicOperations(registerFn: any): void {
    // 列出所有工作流
    registerFn(IPCChannels.WORKFLOW_LIST, async () => {
      return await this.dbService.getWorkflows();
    });

    // 获取工作流
    registerFn(IPCChannels.WORKFLOW_GET, async (data: { id: string }) => {
      return await this.dbService.getWorkflow(data.id);
    });

    // 创建工作流
    registerFn(IPCChannels.WORKFLOW_CREATE, async (data: any) => {
      await this.dbService.createWorkflow(data);
      return { success: true };
    });

    // 更新工作流
    registerFn(IPCChannels.WORKFLOW_UPDATE, async (data: { id: string; updates: any }) => {
      await this.dbService.updateWorkflow(data.id, data.updates);
      return { success: true };
    });

    // 删除工作流
    registerFn(IPCChannels.WORKFLOW_DELETE, async (data: { id: string }) => {
      await this.dbService.deleteWorkflow(data.id);
      return { success: true };
    });
  }

  private registerExecutionOperations(registerFn: any): void {
    // 执行工作流
    registerFn(IPCChannels.WORKFLOW_EXECUTE, async (data: { id: string; variables?: Record<string, any> }) => {
      const workflow = await this.dbService.getWorkflow(data.id);
      if (!workflow) {
        throw new Error(`Workflow not found: ${data.id}`);
      }

      this.logger.info(`Executing workflow: ${workflow.name} (${workflow.id})`);
      const context = await this.workflowEngine.execute(workflow, data.variables);

      return {
        executionId: context.executionId,
        status: context.status,
        startTime: context.startTime,
        endTime: context.endTime,
        error: context.error,
        nodeResults: context.nodeResults,
        variables: context.variables,
      };
    });

    // 取消执行
    registerFn(IPCChannels.WORKFLOW_CANCEL, async (data: { executionId: string }) => {
      const canceled = this.workflowEngine.cancel(data.executionId);
      return { canceled };
    });
  }

  private registerAdvancedOperations(registerFn: any): void {
    // 从对话生成工作流
    registerFn(
      IPCChannels.WORKFLOW_GENERATE_FROM_CONVERSATION,
      async (data: z.infer<typeof WorkflowGenerateFromConversationSchema>) => {
        const { WorkflowGeneratorService } = require('../../services/WorkflowGeneratorService');
        const generatorService = WorkflowGeneratorService.getInstance();

        const { messages, projectPath, projectName, existingWorkflowId } = data;

        // 检查是否需要更新现有工作流
        if (existingWorkflowId) {
          const existingWorkflow = await this.dbService.getWorkflow(existingWorkflowId);
          if (existingWorkflow) {
            this.logger.info(`Updating existing workflow: ${existingWorkflowId}`);
            const updatedWorkflow = generatorService.updateWorkflowFromConversation(
              existingWorkflow,
              messages,
              { projectPath, projectName }
            );
            await this.dbService.updateWorkflow(existingWorkflowId, updatedWorkflow);
            return { workflow: updatedWorkflow, created: false };
          }
        }

        // 生成新工作流
        const workflow = generatorService.generateWorkflowFromConversation(messages, {
          projectPath,
          projectName,
        });

        if (workflow) {
          workflow.projectPath = projectPath;
          workflow.projectName = projectName;

          await this.dbService.createWorkflow(workflow);
          this.logger.info(`Created new workflow: ${workflow.name} (${workflow.id})`);
          return { workflow, created: true };
        }

        return { workflow: null, created: false };
      },
      WorkflowGenerateFromConversationSchema
    );

    // 根据项目获取工作流
    registerFn(
      IPCChannels.WORKFLOW_GET_BY_PROJECT,
      async (data: z.infer<typeof WorkflowGetByProjectSchema>) => {
        const workflows = await this.dbService.getWorkflowsByProject(data.projectPath);
        return workflows;
      },
      WorkflowGetByProjectSchema
    );
  }
}
