/**
 * Input Dialog Component
 * A modal dialog for text input (replacement for window.prompt)
 */

import { useState, useEffect, useRef } from 'react';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  isOpen,
  title,
  placeholder = '',
  defaultValue = '',
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input when dialog opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-vscode-sidebar-bg border border-vscode-border rounded shadow-2xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-base font-semibold mb-4">{title}</h3>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="vscode-input w-full mb-4"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="vscode-button-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              className="vscode-button-primary"
              disabled={!value.trim()}
            >
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
