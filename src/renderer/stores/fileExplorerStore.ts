/**
 * File Explorer Store
 * Manages file explorer preferences including hidden files visibility
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface FileExplorerState {
  showHiddenFiles: boolean;
  setShowHiddenFiles: (show: boolean) => void;
}

export const useFileExplorerStore = create<FileExplorerState>()(
  persist(
    immer((set) => ({
      // Default to false to show only whitelisted hidden files
      showHiddenFiles: false,

      setShowHiddenFiles: (show: boolean) => {
        set((state) => {
          state.showHiddenFiles = show;
        });
      },
    })),
    {
      name: 'file-explorer-settings',
    }
  )
);
