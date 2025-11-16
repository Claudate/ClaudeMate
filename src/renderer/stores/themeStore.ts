/**
 * Theme Store
 * Manages application theme (dark/light/auto)
 * Uses Zustand for state management with Immer for immutability
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { IPCChannels } from '../../shared/types/ipc.types';

export type Theme = 'light' | 'dark' | 'auto';

interface ThemeState {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => Promise<void>;
  initializeTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>()(
  immer((set) => ({
    theme: 'dark',
    effectiveTheme: 'dark',

    setTheme: async (theme: Theme) => {
      try {
        // Save to main process
        await window.electronAPI.invoke(IPCChannels.THEME_SET, { theme });

        set((state) => {
          state.theme = theme;
          state.effectiveTheme = resolveEffectiveTheme(theme);
        });
      } catch (error) {
        console.error('Failed to set theme:', error);
      }
    },

    initializeTheme: async () => {
      try {
        // Check if electronAPI is available
        if (!window.electronAPI?.invoke) {
          console.warn('[themeStore] electronAPI not available, using default theme');
          return;
        }

        // Load theme from main process
        const savedTheme = await window.electronAPI.invoke<{ theme: Theme }>(
          IPCChannels.THEME_GET
        );

        if (savedTheme?.theme) {
          set((state) => {
            state.theme = savedTheme.theme;
            state.effectiveTheme = resolveEffectiveTheme(savedTheme.theme);
          });
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          set((state) => {
            if (state.theme === 'auto') {
              state.effectiveTheme = e.matches ? 'dark' : 'light';
            }
          });
        });
      } catch (error) {
        console.error('Failed to initialize theme:', error);
      }
    },
  }))
);

function resolveEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}
