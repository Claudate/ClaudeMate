/**
 * Database Service
 * Manages data persistence using LowDB
 */

import { app } from 'electron';
import { join } from 'path';
import { Logger } from '../utils/Logger';
import type { WorkflowDefinition } from '../workflow/types';

const logger = Logger.getInstance('DatabaseService');

export interface ChatSession {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  lastOpened: number;
  isActive: boolean;
  createdAt: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'zh' | 'ja';
  fontSize: number;
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  autoSave: boolean;
  notifications: boolean;
  telemetry: boolean;
}

interface DatabaseSchema {
  sessions: ChatSession[];
  projects: Project[];
  workflows: WorkflowDefinition[]; // ⭐ 新增工作流存储
  settings: AppSettings;
  version: string;
}

const defaultData: DatabaseSchema = {
  sessions: [],
  projects: [],
  workflows: [], // ⭐ 默认空工作流列表
  settings: {
    theme: 'dark',
    language: 'en',
    fontSize: 14,
    claudeModel: 'sonnet',
    autoSave: true,
    notifications: true,
    telemetry: false,
  },
  version: '1.0.0',
};

export class DatabaseService {
  private static instance: DatabaseService;
  private db: any = null; // 使用 any 因为动态加载
  private dbPath: string;

  private constructor() {
    this.dbPath = join(app.getPath('userData'), 'database.json');
    logger.info(`Database path: ${this.dbPath}`);
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // 动态导入 ES Module - 使用 eval 绕过 TypeScript 编译器的转换
      const importFn = new Function('specifier', 'return import(specifier)');
      const { JSONFilePreset } = await importFn('lowdb/node');
      this.db = await JSONFilePreset(this.dbPath, defaultData);
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Session operations
  public async getSessions(): Promise<ChatSession[]> {
    await this.db?.read();
    return this.db?.data.sessions || [];
  }

  public async getSession(id: string): Promise<ChatSession | null> {
    await this.db?.read();
    return this.db?.data.sessions.find((s: ChatSession) => s.id === id) || null;
  }

  public async createSession(session: ChatSession): Promise<void> {
    await this.db?.read();
    this.db?.data.sessions.push(session);
    await this.db?.write();
    logger.info(`Session created: ${session.id}`);
  }

  public async updateSession(id: string, updates: Partial<ChatSession>): Promise<void> {
    await this.db?.read();
    const index = this.db?.data.sessions.findIndex((s: ChatSession) => s.id === id);
    if (index !== undefined && index >= 0) {
      this.db!.data.sessions[index] = {
        ...this.db!.data.sessions[index],
        ...updates,
        updatedAt: Date.now(),
      };
      await this.db?.write();
      logger.info(`Session updated: ${id}`);
    }
  }

  public async deleteSession(id: string): Promise<void> {
    await this.db?.read();
    this.db!.data.sessions = this.db!.data.sessions.filter((s: ChatSession) => s.id !== id);
    await this.db?.write();
    logger.info(`Session deleted: ${id}`);
  }

  // Project operations
  public async getProjects(): Promise<Project[]> {
    await this.db?.read();
    return this.db?.data.projects || [];
  }

  public async getProject(id: string): Promise<Project | null> {
    await this.db?.read();
    return this.db?.data.projects.find((p: Project) => p.id === id) || null;
  }

  public async createProject(project: Project): Promise<void> {
    await this.db?.read();
    this.db?.data.projects.push(project);
    await this.db?.write();
    logger.info(`Project created: ${project.id}`);
  }

  public async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    await this.db?.read();
    const index = this.db?.data.projects.findIndex((p: Project) => p.id === id);
    if (index !== undefined && index >= 0) {
      this.db!.data.projects[index] = {
        ...this.db!.data.projects[index],
        ...updates,
      };
      await this.db?.write();
      logger.info(`Project updated: ${id}`);
    }
  }

  public async deleteProject(id: string): Promise<void> {
    await this.db?.read();
    this.db!.data.projects = this.db!.data.projects.filter((p: Project) => p.id !== id);
    await this.db?.write();
    logger.info(`Project deleted: ${id}`);
  }

  // Settings operations
  public async getSettings(): Promise<AppSettings> {
    await this.db?.read();
    return this.db?.data.settings || defaultData.settings;
  }

  public async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    await this.db?.read();
    this.db!.data.settings = {
      ...this.db!.data.settings,
      ...updates,
    };
    await this.db?.write();
    logger.info('Settings updated');
  }

  // ⭐ Workflow operations
  public async getWorkflows(): Promise<WorkflowDefinition[]> {
    await this.db?.read();
    return this.db?.data.workflows || [];
  }

  public async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    await this.db?.read();
    return this.db?.data.workflows.find((w: WorkflowDefinition) => w.id === id) || null;
  }

  public async createWorkflow(workflow: WorkflowDefinition): Promise<void> {
    await this.db?.read();
    this.db?.data.workflows.push(workflow);
    await this.db?.write();
    logger.info(`Workflow created: ${workflow.id}`);
  }

  public async updateWorkflow(id: string, updates: Partial<WorkflowDefinition>): Promise<void> {
    await this.db?.read();
    const index = this.db?.data.workflows.findIndex((w: WorkflowDefinition) => w.id === id);
    if (index !== undefined && index >= 0) {
      this.db!.data.workflows[index] = {
        ...this.db!.data.workflows[index],
        ...updates,
        updatedAt: Date.now(),
      };
      await this.db?.write();
      logger.info(`Workflow updated: ${id}`);
    }
  }

  public async deleteWorkflow(id: string): Promise<void> {
    await this.db?.read();
    this.db!.data.workflows = this.db!.data.workflows.filter((w: WorkflowDefinition) => w.id !== id);
    await this.db?.write();
    logger.info(`Workflow deleted: ${id}`);
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    logger.info('Database cleanup complete');
  }
}
