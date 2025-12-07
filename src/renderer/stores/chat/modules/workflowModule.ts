/**
 * Workflow Module - 工作流生成
 * 负责从会话历史生成可重用的工作流
 */

import { StateCreator } from 'zustand';
import { IPCChannels } from '@shared/types/ipc.types';
import { WorkflowActions, ChatState } from '../types';
import { useProjectStore } from '../../projectStore';

export type WorkflowSlice = WorkflowActions;

export const createWorkflowSlice: StateCreator<
  ChatState,
  [['zustand/immer', never]],
  [],
  WorkflowSlice
> = (set, get) => ({
  /**
   * ⭐⭐⭐ 从当前会话自动生成工作流
   * 在离开项目前调用，将对话历史转换为可重用的工作流
   */
  generateWorkflowFromCurrentSession: async () => {
    const messages = get().messages;
    const currentProjectPath = get().currentProjectPath;

    console.log(`[ChatStore] 开始生成工作流检查 - 项目: ${currentProjectPath}, 消息数: ${messages.length}`);

    if (!currentProjectPath) {
      console.log('[ChatStore] ❌ 无当前项目，跳过工作流生成');
      return;
    }

    if (messages.length < 2) {
      console.log(`[ChatStore] ❌ 消息数量不足 (${messages.length} < 2)，跳过工作流生成`);
      return;
    }

    try {
      // 从项目Store获取项目名称
      const projectStore = useProjectStore.getState();
      const currentProject = projectStore.currentProject;
      const projectName = currentProject?.name || 'Unknown Project';

      console.log(`[ChatStore] 为项目 ${projectName} 生成工作流...`);

      // 准备消息数据（包括工具使用信息）
      const messagesWithToolUses = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        toolUses: [], // TODO: 需要从实际数据中提取工具使用信息
      }));

      // 调用 IPC 生成工作流
      const result = await window.electronAPI.invoke(
        IPCChannels.WORKFLOW_GENERATE_FROM_CONVERSATION,
        {
          messages: messagesWithToolUses,
          projectPath: currentProjectPath,
          projectName,
        }
      );

      if (result.workflow) {
        console.log(`[ChatStore] ✅ 成功生成工作流: ${result.workflow.name} (${result.workflow.id})`);
      } else {
        console.log('[ChatStore] 未生成工作流（对话内容不足）');
      }
    } catch (error) {
      console.error('[ChatStore] 生成工作流失败:', error);
      throw error;
    }
  },
});
