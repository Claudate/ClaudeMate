/**
 * Status Bar Component (VSCode-like)
 * Shows system info, current project, memory usage, etc.
 */

import { useState, useEffect } from 'react';
import { IPCChannels } from '../../../shared/types/ipc.types';
import { useAppStore } from '../../stores/appStore';

export function StatusBar() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);

  useEffect(() => {
    // Update memory usage periodically
    const interval = setInterval(() => {
      window.electronAPI
        .invoke<{ rss: number }>(IPCChannels.SYSTEM_MEMORY)
        .then((mem) => {
          if (mem) {
            setMemoryUsage(Math.round(mem.rss / 1024 / 1024));
          }
        })
        .catch(console.error);
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-6 min-h-6 bg-vscode-statusbar-bg flex items-center justify-between px-3 text-white text-xs select-none overflow-hidden">
      {/* Left Section */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {currentProjectId ? (
          <div className="flex items-center gap-1">
            <i className="codicon codicon-folder-opened" />
            <span className="whitespace-nowrap">{currentProjectId}</span>
          </div>
        ) : (
          <span className="text-white/70 whitespace-nowrap">No Folder Opened</span>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
        {memoryUsage > 0 && (
          <>
            <i className="codicon codicon-dashboard" />
            <span>{memoryUsage} MB</span>
            <span className="text-white/30 mx-1">|</span>
          </>
        )}
        <span>{window.platform.platform}</span>
        <span className="text-white/30 mx-1">|</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
