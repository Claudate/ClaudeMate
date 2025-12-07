/**
 * Application Events
 * 全局事件类型定义，用于主进程和渲染进程之间的通信
 */

/**
 * 事件名称常量
 */
export const AppEvents = {
  // History 模块事件
  HISTORY_DATA_CLEARED: 'history:data-cleared',           // SQLite 数据已清空
  HISTORY_DATA_IMPORTED: 'history:data-imported',         // 数据已导入
  HISTORY_SESSION_CREATED: 'history:session-created',     // 会话已创建
  HISTORY_SESSION_UPDATED: 'history:session-updated',     // 会话已更新
  HISTORY_SESSION_DELETED: 'history:session-deleted',     // 会话已删除

  // Settings 模块事件
  SETTINGS_CHANGED: 'settings:changed',                   // 设置已更改

  // Theme 模块事件
  THEME_CHANGED: 'theme:changed',                         // 主题已更改
} as const;

export type AppEventName = typeof AppEvents[keyof typeof AppEvents];

/**
 * 事件数据类型
 */
export interface AppEventData {
  [AppEvents.HISTORY_DATA_CLEARED]: {
    deletedProjects: number;
    deletedSessions: number;
    timestamp: number;
  };
  [AppEvents.HISTORY_DATA_IMPORTED]: {
    importedProjects: number;
    importedSessions: number;
    timestamp: number;
  };
  [AppEvents.HISTORY_SESSION_CREATED]: {
    sessionId: string;
    projectPath: string;
    projectName: string;
    timestamp: number;
  };
  [AppEvents.HISTORY_SESSION_UPDATED]: {
    sessionId: string;
    projectPath: string;
    timestamp: number;
  };
  [AppEvents.HISTORY_SESSION_DELETED]: {
    sessionId: string;
    projectPath: string;
    timestamp: number;
  };
  [AppEvents.SETTINGS_CHANGED]: {
    key: string;
    value: any;
    timestamp: number;
  };
  [AppEvents.THEME_CHANGED]: {
    theme: 'light' | 'dark' | 'auto';
    timestamp: number;
  };
}

/**
 * 事件监听器类型
 */
export type AppEventListener<T extends AppEventName> = (data: AppEventData[T]) => void | Promise<void>;
