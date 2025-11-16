/**
 * Sidebar Navigation Component (VSCode-like)
 * Uses official VSCode Codicons
 */

import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';

interface NavItem {
  path: string;
  icon: string; // Codicon class name
  label: string;
  shortcut?: string;
}

const navItems: NavItem[] = [
  {
    path: '/assistant',
    label: 'Assistant',
    icon: 'codicon-comment-discussion',
  },
  {
    path: '/projects',
    label: 'Projects',
    icon: 'codicon-folder-library',
  },
  {
    path: '/explorer',
    label: 'Explorer',
    icon: 'codicon-files',
  },
  {
    path: '/history',
    label: 'History',
    icon: 'codicon-history',
  },
  {
    path: '/workflow',
    label: 'Workflow',
    icon: 'codicon-symbol-namespace',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'codicon-settings-gear',
  },
];

export function Sidebar() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={`${
        sidebarCollapsed ? 'w-12' : 'w-12'
      } bg-vscode-sidebar-bg border-r border-vscode-border flex flex-col transition-all duration-200`}
    >
      {/* Navigation Items */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-center h-12 text-vscode-foreground-dim hover:text-vscode-foreground transition-colors relative group ${
                isActive ? 'text-vscode-foreground bg-vscode-selection-bg/20' : ''
              }`
            }
            title={item.label}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 w-0.5 h-full bg-vscode-accent" />
                )}
                <i className={`codicon ${item.icon} text-2xl`} />
                {!sidebarCollapsed && (
                  <span className="ml-3 text-sm">{item.label}</span>
                )}
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-vscode-titlebar-bg text-vscode-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-vscode-border">
                  {item.label}
                  {item.shortcut && (
                    <span className="ml-2 text-vscode-foreground-dim">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
