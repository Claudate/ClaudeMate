/**
 * Calendar Component
 * 显示月历视图，并在每个日期下显示会话数量
 */

import { useEffect, useState } from 'react';

interface CalendarProps {
  /** 会话数据（按日期统计） */
  sessionsByDate: Record<string, number>; // { '2025-01-15': 5, '2025-01-16': 3 }
  /** 选中的日期 */
  selectedDate: Date | null;
  /** 日期选择回调 */
  onSelectDate: (date: Date | null) => void;
}

export default function Calendar({ sessionsByDate, selectedDate, onSelectDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 获取当月的所有日期
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Date[] = [];

    // 补齐第一周前面的空白日期（上个月的日期）
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }

    // 当月所有日期
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // 补齐最后一周后面的空白日期（下个月的日期）
    const lastDayOfWeek = lastDay.getDay();
    for (let i = 1; i < 7 - lastDayOfWeek; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push(nextDate);
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 格式化日期为 YYYY-MM-DD（用于查找会话数量）
  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 检查两个日期是否是同一天
  const isSameDay = (date1: Date | null, date2: Date): boolean => {
    if (!date1) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // 切换月份
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    onSelectDate(new Date());
  };

  return (
    <div className="p-3">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-vscode-input-bg rounded"
          title="Previous Month"
        >
          <i className="codicon codicon-chevron-left text-xs" />
        </button>

        <div className="text-xs font-bold text-vscode-foreground">
          {currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
        </div>

        <button
          onClick={goToNextMonth}
          className="p-1 hover:bg-vscode-input-bg rounded"
          title="Next Month"
        >
          <i className="codicon codicon-chevron-right text-xs" />
        </button>
      </div>

      {/* 回到今天按钮 */}
      <button
        onClick={goToToday}
        className="w-full mb-2 py-1 text-xs text-vscode-accent hover:bg-vscode-input-bg rounded"
      >
        Today
      </button>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <div key={day} className="text-center text-xs text-vscode-foreground-dim font-semibold">
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateKey = formatDateKey(date);
          const sessionCount = sessionsByDate[dateKey] || 0;
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isToday = isSameDay(today, date);
          const isSelected = isSameDay(selectedDate, date);

          return (
            <button
              key={index}
              onClick={() => {
                // 如果点击已选中的日期，则取消选择
                if (isSelected) {
                  onSelectDate(null);
                } else {
                  onSelectDate(date);
                }
              }}
              className={`
                relative p-1 rounded text-xs flex items-center justify-center h-8
                hover:bg-vscode-input-bg cursor-pointer transition-colors
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isToday ? 'ring-1 ring-vscode-accent' : ''}
                ${isSelected ? 'bg-vscode-selection-bg' : ''}
                ${sessionCount > 0 ? 'bg-vscode-accent/5' : ''}
              `}
              title={`${dateKey}${sessionCount > 0 ? ` - ${sessionCount} 个会话` : ''}`}
            >
              {/* 日期数字 */}
              <div className={`font-medium ${isToday ? 'text-vscode-accent' : ''}`}>
                {date.getDate()}
              </div>

              {/* 会话数量指示器 - 右上角小圆点徽章 */}
              {sessionCount > 0 && (
                <div className="absolute top-0 right-0 bg-vscode-accent text-white text-[8px] leading-none px-1 py-0.5 rounded-full min-w-[12px] text-center">
                  {sessionCount > 99 ? '99' : sessionCount}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 清除日期选择按钮 */}
      {selectedDate && (
        <button
          onClick={() => onSelectDate(null)}
          className="w-full mt-2 py-1 text-xs text-vscode-foreground-dim hover:text-vscode-foreground hover:bg-vscode-input-bg rounded"
        >
          Clear Date
        </button>
      )}
    </div>
  );
}
