/**
 * Resizable Panel
 * VSCode-style resizable panel with drag handles
 * Features: Collapse/Expand, Auto-hide on min size
 */

import { useState, useRef, useEffect, ReactNode } from 'react';

interface ResizablePanelProps {
  children: ReactNode;
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  direction: 'horizontal' | 'vertical';
  position: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
  collapsible?: boolean; // 是否可折叠
  onCollapse?: (collapsed: boolean) => void; // 折叠状态回调
}

export function ResizablePanel({
  children,
  defaultSize,
  minSize = 200,
  maxSize = 800,
  direction,
  position,
  className = '',
  collapsible = true,
  onCollapse,
}: ResizablePanelProps) {
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // 折叠状态
  const panelRef = useRef<HTMLDivElement>(null);
  const savedSizeRef = useRef(defaultSize); // 保存折叠前的尺寸

  // 折叠/展开切换
  const toggleCollapse = () => {
    if (isCollapsed) {
      // 展开: 恢复之前的尺寸
      setSize(savedSizeRef.current);
      setIsCollapsed(false);
      onCollapse?.(false);
    } else {
      // 折叠: 保存当前尺寸并设为0
      savedSizeRef.current = size;
      setSize(0);
      setIsCollapsed(true);
      onCollapse?.(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const panelRect = panelRef.current.getBoundingClientRect();
      let newSize: number;

      if (direction === 'horizontal') {
        if (position === 'left') {
          newSize = e.clientX - panelRect.left;
        } else {
          newSize = panelRect.right - e.clientX;
        }
      } else {
        if (position === 'top') {
          newSize = e.clientY - panelRect.top;
        } else {
          newSize = panelRect.bottom - e.clientY;
        }
      }

      // ⭐ 拖到小于50px时自动折叠
      if (collapsible && newSize < 50) {
        if (!isCollapsed) {
          savedSizeRef.current = size;
          setSize(0);
          setIsCollapsed(true);
          onCollapse?.(true);
        }
        return;
      }

      // 如果从折叠状态拖出来,自动展开
      if (isCollapsed && newSize >= 50) {
        setIsCollapsed(false);
        onCollapse?.(false);
      }

      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, direction, position, minSize, maxSize, collapsible, isCollapsed, size, onCollapse]);

  const handleStyle = direction === 'horizontal'
    ? {
        width: '4px',
        height: '100%',
        cursor: 'col-resize',
        position: 'absolute' as const,
        top: 0,
        [position === 'left' ? 'right' : 'left']: -2,
        zIndex: 1,
      }
    : {
        width: '100%',
        height: '4px',
        cursor: 'row-resize',
        position: 'absolute' as const,
        left: 0,
        [position === 'top' ? 'bottom' : 'top']: -2,
        zIndex: 1,
      };

  const panelStyle = direction === 'horizontal'
    ? { width: `${size}px`, flexShrink: 0 }
    : { height: `${size}px`, flexShrink: 0 };

  // 如果折叠了,返回一个收缩的面板带展开按钮
  if (isCollapsed && collapsible) {
    const collapsedStyle = direction === 'horizontal'
      ? { width: '32px', flexShrink: 0 }
      : { height: '32px', flexShrink: 0 };

    return (
      <div
        className={`relative flex items-center justify-center bg-vscode-sidebar-bg border-vscode-border ${
          position === 'left' ? 'border-r' : position === 'right' ? 'border-l' : ''
        } ${className}`}
        style={collapsedStyle}
      >
        {/* 展开按钮 */}
        <button
          onClick={toggleCollapse}
          className="p-2 hover:bg-vscode-selection-bg/20 rounded transition-colors"
          title={position === 'left' ? '展开资源管理器' : '展开侧边栏'}
        >
          <i className={`codicon ${
            position === 'left' ? 'codicon-chevron-right' : 'codicon-chevron-left'
          } text-sm`} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`relative ${className}`}
      style={panelStyle}
    >
      {children}

      {/* 折叠按钮 (在面板内部显示) */}
      {collapsible && !isCollapsed && (
        <button
          onClick={toggleCollapse}
          className={`absolute top-2 ${
            position === 'left' ? 'right-2' : 'left-2'
          } p-1 hover:bg-vscode-selection-bg/20 rounded transition-colors z-10 opacity-50 hover:opacity-100`}
          title={position === 'left' ? '收起资源管理器' : '收起侧边栏'}
        >
          <i className={`codicon ${
            position === 'left' ? 'codicon-chevron-left' : 'codicon-chevron-right'
          } text-xs`} />
        </button>
      )}

      {/* Resize Handle */}
      <div
        style={handleStyle}
        onMouseDown={() => setIsResizing(true)}
        className="hover:bg-vscode-accent/30 transition-colors"
      />
    </div>
  );
}
