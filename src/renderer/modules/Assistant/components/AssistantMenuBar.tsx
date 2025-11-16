/**
 * Assistant Menu Bar
 * VSCode-style dropdown menu bar
 */

import { useState, useRef, useEffect } from 'react';

interface MenuBarProps {
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onScanSkills: () => void;
}

interface DropdownMenuProps {
  title: string;
  items: MenuItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
  divider?: boolean;
}

function DropdownMenu({ title, items, isOpen, onToggle, onClose }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onToggle}
        className={`px-3 py-1 text-sm hover:bg-vscode-selection-bg/20 ${
          isOpen ? 'bg-vscode-selection-bg/30' : ''
        }`}
      >
        {title}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-vscode-dropdown-bg border border-vscode-border shadow-lg z-50">
          {items.map((item, index) => (
            <div key={index}>
              {item.divider ? (
                <div className="h-px bg-vscode-border my-1" />
              ) : (
                <button
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-vscode-selection-bg/20 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    {item.icon && <i className={`codicon ${item.icon} text-base`} />}
                    <span>{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <span className="text-xs text-vscode-foreground-dim opacity-70 group-hover:opacity-100">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssistantMenuBar({ onOpenFile, onOpenFolder, onScanSkills }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleToggleMenu = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const handleCloseMenu = () => {
    setOpenMenu(null);
  };

  const fileMenuItems: MenuItem[] = [
    {
      label: '打开文件...',
      icon: 'codicon-file',
      shortcut: 'Ctrl+O',
      action: onOpenFile,
    },
    {
      label: '打开文件夹...',
      icon: 'codicon-folder-opened',
      shortcut: 'Ctrl+K Ctrl+O',
      action: onOpenFolder,
    },
    {
      divider: true,
      label: '',
      action: () => {},
    },
    {
      label: '扫描 Skills 项目',
      icon: 'codicon-search',
      shortcut: 'Ctrl+Shift+S',
      action: onScanSkills,
    },
  ];

  const editMenuItems: MenuItem[] = [
    {
      label: '撤销',
      icon: 'codicon-discard',
      shortcut: 'Ctrl+Z',
      action: () => console.log('Undo'),
    },
    {
      label: '重做',
      icon: 'codicon-redo',
      shortcut: 'Ctrl+Y',
      action: () => console.log('Redo'),
    },
    {
      divider: true,
      label: '',
      action: () => {},
    },
    {
      label: '复制',
      icon: 'codicon-copy',
      shortcut: 'Ctrl+C',
      action: () => console.log('Copy'),
    },
    {
      label: '粘贴',
      icon: 'codicon-clippy',
      shortcut: 'Ctrl+V',
      action: () => console.log('Paste'),
    },
  ];

  const viewMenuItems: MenuItem[] = [
    {
      label: '命令面板',
      icon: 'codicon-symbol-event',
      shortcut: 'Ctrl+Shift+P',
      action: () => console.log('Command Palette'),
    },
    {
      divider: true,
      label: '',
      action: () => {},
    },
    {
      label: '切换资源管理器',
      icon: 'codicon-files',
      shortcut: 'Ctrl+B',
      action: () => console.log('Toggle Explorer'),
    },
    {
      label: '切换 Claude 面板',
      icon: 'codicon-hubot',
      shortcut: 'Ctrl+`',
      action: () => console.log('Toggle Claude Panel'),
    },
  ];

  return (
    <div className="h-8 bg-vscode-titlebar-bg border-b border-vscode-border flex items-center px-2 text-vscode-foreground">
      <DropdownMenu
        title="文件"
        items={fileMenuItems}
        isOpen={openMenu === 'file'}
        onToggle={() => handleToggleMenu('file')}
        onClose={handleCloseMenu}
      />
      <DropdownMenu
        title="编辑"
        items={editMenuItems}
        isOpen={openMenu === 'edit'}
        onToggle={() => handleToggleMenu('edit')}
        onClose={handleCloseMenu}
      />
      <DropdownMenu
        title="查看"
        items={viewMenuItems}
        isOpen={openMenu === 'view'}
        onToggle={() => handleToggleMenu('view')}
        onClose={handleCloseMenu}
      />
    </div>
  );
}
