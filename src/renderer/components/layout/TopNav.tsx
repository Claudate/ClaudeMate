/**
 * Top Navigation Component
 * Horizontal navigation bar replacing sidebar
 */

import { NavLink } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: string; // Codicon class name
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

export function TopNav() {
  return (
    <nav className="h-12 bg-vscode-titlebar-bg border-b border-vscode-border flex items-center px-4">
      {/* Navigation Items */}
      <div className="flex items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-vscode-foreground bg-vscode-selection-bg/30'
                  : 'text-vscode-foreground-dim hover:text-vscode-foreground hover:bg-vscode-selection-bg/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-vscode-accent" />
                )}

                {/* Icon */}
                <i className={`codicon ${item.icon} text-base`} />

                {/* Label */}
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
