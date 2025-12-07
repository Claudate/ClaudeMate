/**
 * Activity Bar Component (VSCode-style)
 * Left vertical navigation bar
 */

import { NavLink } from 'react-router-dom';
import { useState } from 'react';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

export function ActivityBar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);

  // TODO: 实际的登录逻辑
  const handleLogin = () => {
    // 模拟登录
    setIsLoggedIn(true);
    setUserInfo({ name: 'User', email: 'user@example.com' });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserInfo(null);
  };

  return (
    <div className="w-12 bg-vscode-titlebar-bg border-r border-vscode-border flex flex-col items-center py-2">
      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom icons */}
      <div className="flex flex-col gap-2 w-full">
        {/* User Account / Login */}
        {isLoggedIn && userInfo ? (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center p-2 transition-colors relative group text-vscode-foreground-dim hover:text-vscode-foreground"
            title={`${userInfo.name}\n${userInfo.email}\nClick to logout`}
          >
            <div className="w-8 h-8 rounded-full bg-vscode-accent flex items-center justify-center text-white text-sm font-semibold">
              {userInfo.name.charAt(0).toUpperCase()}
            </div>

            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-vscode-menu-bg border border-vscode-border rounded text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              <div className="font-semibold">{userInfo.name}</div>
              <div className="text-vscode-foreground-dim">{userInfo.email}</div>
              <div className="mt-1 text-vscode-accent">Click to logout</div>
            </div>
          </button>
        ) : (
          <button
            onClick={handleLogin}
            className="flex flex-col items-center justify-center p-2 transition-colors relative group text-vscode-foreground-dim hover:text-vscode-foreground"
            title="Sign in"
          >
            <i className="codicon codicon-account text-2xl" />

            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-vscode-menu-bg border border-vscode-border rounded text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              Sign in
            </div>
          </button>
        )}

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-2 transition-colors relative group ${
              isActive
                ? 'text-vscode-foreground'
                : 'text-vscode-foreground-dim hover:text-vscode-foreground'
            }`
          }
          title="Settings"
        >
          {({ isActive }) => (
            <>
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-vscode-accent" />
              )}

              {/* Icon */}
              <i className="codicon codicon-settings-gear text-2xl" />

              {/* Tooltip on hover */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-vscode-menu-bg border border-vscode-border rounded text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                Settings
              </div>
            </>
          )}
        </NavLink>
      </div>
    </div>
  );
}
