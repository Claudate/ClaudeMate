/**
 * Application Store
 * Manages global application state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AppEvent } from '../../shared/types/domain.types';

interface AppState {
  isInitialized: boolean;
  currentProjectId: string | null;
  currentSessionId: string | null;
  sidebarCollapsed: boolean;
  events: AppEvent[];

  // Actions
  setInitialized: (initialized: boolean) => void;
  setCurrentProject: (projectId: string | null) => void;
  setCurrentSession: (sessionId: string | null) => void;
  toggleSidebar: () => void;
  addEvent: (event: AppEvent) => void;
  clearEvents: () => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    isInitialized: false,
    currentProjectId: null,
    currentSessionId: null,
    sidebarCollapsed: false,
    events: [],

    setInitialized: (initialized) => {
      set((state) => {
        state.isInitialized = initialized;
      });
    },

    setCurrentProject: (projectId) => {
      set((state) => {
        state.currentProjectId = projectId;
        state.currentSessionId = null; // Reset session when project changes
      });
    },

    setCurrentSession: (sessionId) => {
      set((state) => {
        state.currentSessionId = sessionId;
      });
    },

    toggleSidebar: () => {
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      });
    },

    addEvent: (event) => {
      set((state) => {
        state.events.push(event);
        // Keep only last 100 events to prevent memory leak
        if (state.events.length > 100) {
          state.events = state.events.slice(-100);
        }
      });
    },

    clearEvents: () => {
      set((state) => {
        state.events = [];
      });
    },
  }))
);
