/**
 * Terminal Module - 终端管理
 * 负责与 TerminalStore 的集成和状态同步
 */

import { StateCreator } from 'zustand';
import { TerminalActions, ChatState } from '../types';
import { useTerminalStore } from '../../terminalStore';

export type TerminalSlice = TerminalActions;

export const createTerminalSlice: StateCreator<
  ChatState,
  [['zustand/immer', never]],
  [],
  TerminalSlice
> = (set, get) => ({
  /**
   * 从 TerminalStore 恢复终端状态
   * 参照 WPF 的多终端切换逻辑
   */
  restoreFromTerminal: (projectPath: string, projectName: string) => {
    console.log(`[ChatStore] 恢复终端状态: ${projectName} (${projectPath})`);

    // 先保存当前状态
    const { messages, currentSessionId, isLoading, error } = get();
    const terminalStore = useTerminalStore.getState();

    // ⭐ 检查 terminalStore 和必要的方法是否存在
    if (!terminalStore || !terminalStore.switchToTerminal || !terminalStore.saveActiveTerminal) {
      console.error('[ChatStore] TerminalStore 未正确初始化或方法缺失');
      console.log('[ChatStore] terminalStore:', terminalStore);
      return;
    }

    terminalStore.saveActiveTerminal(messages, currentSessionId, isLoading, error);

    // 切换到新终端
    const terminal = terminalStore.switchToTerminal(projectPath, projectName);

    // 恢复新终端的状态
    set((state) => {
      state.messages = terminal.messages;
      state.currentSessionId = terminal.currentSessionId;
      state.isLoading = terminal.isLoading;
      state.error = terminal.error;
      state.sessionWarningShown = false; // 重置警告状态
    });

    console.log(`[ChatStore] 已恢复终端: ${projectName}, 消息数: ${terminal.messages.length}`);
  },
});
