/**
 * Preload Script
 * Exposes safe APIs to renderer process through contextBridge
 * This is the only way for renderer to communicate with main process securely
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import {
  IPCChannel,
  IPCResponse,
} from '../../shared/types/ipc.types';

/**
 * Type-safe IPC API exposed to renderer
 */
const electronAPI = {
  /**
   * Invoke IPC handler in main process (async, returns result)
   */
  invoke: async <T = unknown>(channel: IPCChannel, data?: unknown): Promise<T> => {
    const response: IPCResponse<T> = await ipcRenderer.invoke('ipc:invoke', channel, data);

    if (!response.success) {
      const error = new Error(response.error?.message ?? 'Unknown error');
      error.name = response.error?.code ?? 'IPCError';
      throw error;
    }

    return response.data as T;
  },

  /**
   * Subscribe to events from main process (one-way)
   */
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };

    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  /**
   * Subscribe once to event from main process
   */
  once: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.once(channel, (_event: IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    });
  },

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
};

/**
 * Platform information (safe to expose)
 */
const platformAPI = {
  platform: process.platform,
  arch: process.arch,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
};

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('platform', platformAPI);

// Type declarations for renderer process
export type ElectronAPI = typeof electronAPI;
export type PlatformAPI = typeof platformAPI;
