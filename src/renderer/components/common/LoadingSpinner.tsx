/**
 * Loading Spinner Component
 * 支持显示有趣的加载提示
 */

import { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  /** 是否显示加载提示 */
  showTip?: boolean;
  /** 自定义提示文本（如果提供则不使用随机提示） */
  customTip?: string;
}

// 有趣的加载提示列表
const loadingTips = [
  '正在唤醒 Claude...',
  '正在整理思路...',
  '正在热身中...',
  '正在检查工具箱...',
  '正在准备对话环境...',
  '正在加载智慧模块...',
  '马上就好，请稍等...',
  '正在连接大脑...',
  '正在激活神经元...',
  '正在打开知识宝库...',
  '深呼吸，放松一下...',
  '让我想想该说些什么...',
  '正在校准语言模型...',
  '正在启动推理引擎...',
  '准备开始精彩对话...',
  '咖啡泡好了，开始工作！',
  '正在阅读使用手册...',
  '让我伸个懒腰...',
  '正在加载创意灵感...',
  '马上回来，别走开！',
];

export function LoadingSpinner({ showTip = false, customTip }: LoadingSpinnerProps = {}) {
  const [currentTip, setCurrentTip] = useState('');

  useEffect(() => {
    if (showTip && !customTip) {
      // 随机选择一个提示
      const randomTip = loadingTips[Math.floor(Math.random() * loadingTips.length)];
      setCurrentTip(randomTip);

      // 每 3 秒切换一个新提示
      const interval = setInterval(() => {
        const newTip = loadingTips[Math.floor(Math.random() * loadingTips.length)];
        setCurrentTip(newTip);
      }, 3000);

      return () => clearInterval(interval);
    } else if (customTip) {
      setCurrentTip(customTip);
    }
  }, [showTip, customTip]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vscode-accent" />
      {showTip && currentTip && (
        <p className="text-vscode-foreground-dim text-sm animate-pulse">
          {currentTip}
        </p>
      )}
    </div>
  );
}
