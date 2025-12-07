/**
 * Workflow From Skill Service
 * 将 Skill 定义转换为可视化工作流
 */

import { randomBytes } from 'crypto';
import { Logger } from '../utils/Logger';
import type { SkillDefinition } from './SkillService';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '../workflow/types';

const logger = Logger.getInstance('WorkflowFromSkillService');

/**
 * Generate a unique ID
 */
function generateId(): string {
  return randomBytes(12).toString('base64url');
}

export class WorkflowFromSkillService {
  private static instance: WorkflowFromSkillService;

  private constructor() {}

  public static getInstance(): WorkflowFromSkillService {
    if (!WorkflowFromSkillService.instance) {
      WorkflowFromSkillService.instance = new WorkflowFromSkillService();
    }
    return WorkflowFromSkillService.instance;
  }

  /**
   * 将单个 Skill 转换为工作流定义
   */
  public createWorkflowFromSkill(skill: SkillDefinition): WorkflowDefinition {
    logger.info(`Creating workflow from skill: ${skill.name}`);

    // 为 Skill 创建单个节点
    const skillNode: WorkflowNode = {
      id: generateId(),
      type: 'skill',
      position: { x: 300, y: 200 },
      data: {
        label: skill.name,
        config: {
          type: 'skill',
          name: skill.name,
          prompt: skill.prompt || skill.description,
          outputVariable: 'skill_result',
        },
        status: 'idle',
      },
    };

    // 创建工作流定义
    const workflow: WorkflowDefinition = {
      id: skill.id, // 使用 Skill ID 作为工作流 ID
      name: skill.name,
      description: skill.description,
      category: skill.category === 'coding' ? 'coding' :
                skill.category === 'writing' ? 'writing' :
                skill.category === 'analysis' ? 'analysis' :
                skill.category === 'automation' ? 'automation' : 'custom',
      tags: skill.tags || [],
      nodes: [skillNode],
      edges: [],
      variables: {
        skillId: skill.id,
        skillSource: skill.source,
        projectPath: skill.projectPath || '',
        projectName: skill.projectName || '',
      },
      version: '1.0.0',
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
      projectPath: skill.projectPath,
      projectName: skill.projectName,
    };

    return workflow;
  }

  /**
   * 将多个 Skills 转换为工作流列表
   */
  public createWorkflowsFromSkills(skills: SkillDefinition[]): WorkflowDefinition[] {
    return skills.map(skill => this.createWorkflowFromSkill(skill));
  }

  /**
   * 将 Skill 扩展为完整的可编辑工作流
   * (当用户点击编辑时,可以添加更多节点)
   */
  public expandSkillToWorkflow(skill: SkillDefinition): WorkflowDefinition {
    logger.info(`Expanding skill to editable workflow: ${skill.name}`);

    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // 主 Skill 节点
    const mainSkillNode: WorkflowNode = {
      id: generateId(),
      type: 'skill',
      position: { x: 300, y: 200 },
      data: {
        label: skill.name,
        config: {
          type: 'skill',
          name: skill.name,
          prompt: skill.prompt || skill.description,
          outputVariable: 'skill_result',
        },
        status: 'idle',
      },
    };
    nodes.push(mainSkillNode);

    // 如果 Skill 有 context 定义,添加文件读取节点
    if (skill.context && skill.context.length > 0) {
      let prevNodeId = mainSkillNode.id;
      let currentY = 200;

      skill.context.forEach((contextPath, index) => {
        // 文件读取节点
        const fileNode: WorkflowNode = {
          id: generateId(),
          type: 'filesystem',
          position: { x: 100, y: currentY },
          data: {
            label: `Read: ${contextPath}`,
            config: {
              type: 'filesystem',
              action: 'read',
              path: contextPath,
              outputVariable: `context_${index}`,
            },
            status: 'idle',
          },
        };
        nodes.push(fileNode);

        // 连接到主节点
        edges.push({
          id: generateId(),
          source: fileNode.id,
          target: prevNodeId,
          type: 'default',
        });

        currentY += 150;
      });
    }

    const workflow: WorkflowDefinition = {
      id: skill.id,
      name: `${skill.name} (Expanded)`,
      description: skill.description,
      category: skill.category === 'coding' ? 'coding' :
                skill.category === 'writing' ? 'writing' :
                skill.category === 'analysis' ? 'analysis' :
                skill.category === 'automation' ? 'automation' : 'custom',
      tags: [...(skill.tags || []), 'expanded'],
      nodes,
      edges,
      variables: {
        skillId: skill.id,
        skillSource: skill.source,
        projectPath: skill.projectPath || '',
        projectName: skill.projectName || '',
      },
      version: '1.0.0',
      createdAt: skill.createdAt,
      updatedAt: Date.now(),
      projectPath: skill.projectPath,
      projectName: skill.projectName,
    };

    return workflow;
  }
}
