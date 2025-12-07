/**
 * Custom Title Bar Component (VSCode-like)
 * Frameless window with custom controls
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { IPCChannels } from '../../../shared/types/ipc.types';
import appIcon from '../../assets/icon.png';

interface TitleBarProps {}

export function TitleBar({}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    window.electronAPI
      .invoke<boolean>(IPCChannels.WINDOW_IS_MAXIMIZED)
      .then((maximized) => setIsMaximized(maximized ?? false))
      .catch(console.error);
  }, []);

  const handleMinimize = () => {
    window.electronAPI.invoke(IPCChannels.WINDOW_MINIMIZE).catch((error) => {
      console.error('[TitleBar] Failed to minimize window:', error);
      // 即使出错也不阻止用户操作
    });
  };

  const handleMaximize = () => {
    window.electronAPI
      .invoke(IPCChannels.WINDOW_MAXIMIZE)
      .then(() => setIsMaximized(!isMaximized))
      .catch((error) => {
        console.error('[TitleBar] Failed to maximize window:', error);
        // 即使出错也不阻止用户操作
      });
  };

  const handleClose = () => {
    window.electronAPI.invoke(IPCChannels.WINDOW_CLOSE).catch((error) => {
      console.error('[TitleBar] Failed to close window:', error);
      // 如果 IPC 失败，尝试直接关闭窗口
      if (window.close) {
        window.close();
      }
    });
  };


  return (
    <div
      className="h-8 bg-vscode-titlebar-bg flex items-center justify-between px-2 select-none border-b border-vscode-border"
      style={{
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 9999, // 确保标题栏始终在最顶层
      } as React.CSSProperties}
    >
      {/* Left: App Title + Nav Menu */}
      <div className="flex items-center gap-4 pl-1">
        <div className="flex items-center gap-2">
          <img src={appIcon} alt="ClaudeMate" className="w-5 h-5" />
          <span className="text-sm text-vscode-foreground font-semibold">ClaudeMate</span>
        </div>

        {/* Navigation Menu */}
        <nav className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <NavLink
            to="/assistant"
            className={({ isActive }) =>
              `px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-vscode-accent/20 text-vscode-foreground'
                  : 'text-vscode-foreground-dim hover:text-vscode-foreground hover:bg-white/5'
              }`
            }
          >
            <i className="codicon codicon-comment-discussion" />
            Assistant
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-vscode-accent/20 text-vscode-foreground'
                  : 'text-vscode-foreground-dim hover:text-vscode-foreground hover:bg-white/5'
              }`
            }
          >
            <i className="codicon codicon-history" />
            History
          </NavLink>
          <NavLink
            to="/workflow"
            className={({ isActive }) =>
              `px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-vscode-accent/20 text-vscode-foreground'
                  : 'text-vscode-foreground-dim hover:text-vscode-foreground hover:bg-white/5'
              }`
            }
          >
            <i className="codicon codicon-symbol-namespace" />
            Workflow
          </NavLink>
        </nav>
      </div>

      {/* Window Controls */}
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-12 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Minimize"
        >
          <i className="codicon codicon-chrome-minimize text-vscode-foreground" />
        </button>

        <button
          onClick={handleMaximize}
          className="w-12 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          <i className={`codicon ${isMaximized ? 'codicon-chrome-restore' : 'codicon-chrome-maximize'} text-vscode-foreground`} />
        </button>

        <button
          onClick={handleClose}
          className="w-12 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
          aria-label="Close"
        >
          <i className="codicon codicon-chrome-close text-vscode-foreground" />
        </button>
      </div>
    </div>
  );
}
