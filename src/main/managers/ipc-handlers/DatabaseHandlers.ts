/**
 * Database Handlers - 数据库操作相关的 IPC 处理器
 */

import { BaseHandler } from './BaseHandler';
import { IPCChannels, IPCChannel } from '../../../shared/types/ipc.types';

export class DatabaseHandlers extends BaseHandler {
  private dbService: any;

  constructor() {
    super('Database');
    const { DatabaseService } = require('../../services/DatabaseService');
    this.dbService = DatabaseService.getInstance();
  }

  register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: any,
      validator?: any
    ) => void
  ): void {
    // Session 操作
    this.registerSessionHandlers(registerFn);

    // Project 操作
    this.registerProjectHandlers(registerFn);

    // Settings 操作
    this.registerSettingsHandlers(registerFn);

    this.logger.info('Database IPC handlers registered');
  }

  private registerSessionHandlers(registerFn: any): void {
    registerFn(IPCChannels.SESSION_LIST, async () => {
      return await this.dbService.getSessions();
    });

    registerFn(IPCChannels.SESSION_CREATE, async (data: any) => {
      await this.dbService.createSession(data);
      return { success: true };
    });

    registerFn(IPCChannels.SESSION_LOAD, async (data: { id: string }) => {
      return await this.dbService.getSession(data.id);
    });

    registerFn(IPCChannels.SESSION_SAVE, async (data: { id: string; updates: any }) => {
      await this.dbService.updateSession(data.id, data.updates);
      return { success: true };
    });

    registerFn(IPCChannels.SESSION_DELETE, async (data: { id: string }) => {
      await this.dbService.deleteSession(data.id);
      return { success: true };
    });
  }

  private registerProjectHandlers(registerFn: any): void {
    registerFn(IPCChannels.PROJECT_LIST, async () => {
      return await this.dbService.getProjects();
    });

    registerFn(IPCChannels.PROJECT_CREATE, async (data: any) => {
      await this.dbService.createProject(data);
      return { success: true };
    });

    registerFn(IPCChannels.PROJECT_OPEN, async (data: { id: string }) => {
      const project = await this.dbService.getProject(data.id);
      if (project) {
        await this.dbService.updateProject(data.id, {
          lastOpened: Date.now(),
          isActive: true
        });
      }
      return project;
    });

    registerFn(IPCChannels.PROJECT_DELETE, async (data: { id: string }) => {
      await this.dbService.deleteProject(data.id);
      return { success: true };
    });
  }

  private registerSettingsHandlers(registerFn: any): void {
    registerFn(IPCChannels.SETTINGS_GET, async () => {
      return await this.dbService.getSettings();
    });

    registerFn(IPCChannels.SETTINGS_SET, async (data: any) => {
      await this.dbService.updateSettings(data);
      return { success: true };
    });
  }
}
