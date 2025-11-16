/**
 * Resizable Panel
 * VSCode-style resizable panel with drag handles
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
}

export function ResizablePanel({
  children,
  defaultSize,
  minSize = 200,
  maxSize = 800,
  direction,
  position,
  className = '',
}: ResizablePanelProps) {
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
  }, [isResizing, direction, position, minSize, maxSize]);

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

  return (
    <div
      ref={panelRef}
      className={`relative ${className}`}
      style={panelStyle}
    >
      {children}

      {/* Resize Handle */}
      <div
        style={handleStyle}
        onMouseDown={() => setIsResizing(true)}
        className="hover:bg-vscode-accent/30 transition-colors"
      />
    </div>
  );
}
