/**
 * Custom Title Bar Component (VSCode-like)
 * Frameless window with custom controls + Menu Bar
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { IPCChannels } from '../../../shared/types/ipc.types';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  {
    path: '/assistant',
    label: 'Assistant',
    icon: 'codicon-comment-discussion',
  },
  {
    path: '/history',
    label: 'History',
    icon: 'codicon-history',
  },
];

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
    window.electronAPI.invoke(IPCChannels.WINDOW_MINIMIZE).catch(console.error);
  };

  const handleMaximize = () => {
    window.electronAPI
      .invoke(IPCChannels.WINDOW_MAXIMIZE)
      .then(() => setIsMaximized(!isMaximized))
      .catch(console.error);
  };

  const handleClose = () => {
    window.electronAPI.invoke(IPCChannels.WINDOW_CLOSE).catch(console.error);
  };


  return (
    <div className="h-8 bg-vscode-titlebar-bg flex items-center justify-between px-2 select-none border-b border-vscode-border" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left: App Title + Navigation */}
      <div className="flex items-center gap-2">
        <i className="codicon codicon-symbol-namespace text-vscode-accent" />
        <span className="text-sm text-vscode-foreground">Claudate</span>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 ml-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? 'text-vscode-foreground bg-vscode-selection-bg/30'
                    : 'text-vscode-foreground-dim hover:text-vscode-foreground hover:bg-vscode-selection-bg/10'
                }`
              }
            >
              <i className={`codicon ${item.icon} text-sm`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
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
