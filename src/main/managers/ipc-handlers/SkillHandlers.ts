/**
 * Skill Handlers - 技能管理相关的 IPC 处理器
 */

import { z } from 'zod';
import { BaseHandler } from './BaseHandler';
import {
  IPCChannels,
  IPCChannel,
  SkillGetAllSchema,
  SkillLoadSchema,
} from '../../../shared/types/ipc.types';

export class SkillHandlers extends BaseHandler {
  private skillService: any;

  constructor() {
    super('Skill');
    const { SkillService } = require('../../services/SkillService');
    this.skillService = SkillService.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    // 获取所有可用的 Skills
    registerFn(
      IPCChannels.SKILL_GET_ALL,
      async (data: z.infer<typeof SkillGetAllSchema>) => {
        this.logger.info(`Getting all skills for project: ${data.projectPath || 'none'}`);
        const skills = await this.skillService.getAllSkills(data.projectPath);
        this.logger.info(`Found ${skills.length} skills`);
        return { skills };
      },
      SkillGetAllSchema
    );

    // 加载指定 Skill 到 Assistant
    registerFn(
      IPCChannels.SKILL_LOAD,
      async (data: z.infer<typeof SkillLoadSchema>) => {
        this.logger.info(`Loading skill: ${data.skillId}`);
        // This will be handled by the renderer (navigate to Assistant with context)
        return { success: true, skillId: data.skillId };
      },
      SkillLoadSchema
    );

    this.logger.info('Skill IPC handlers registered');
  }
}
