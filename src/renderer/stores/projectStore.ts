/**
 * Project Store
 * Manages current project context for directory-based Claude CLI sessions
 *
 * 参照 WPF 的 IProjectContext 模式:
 * - 维护 CurrentProject 状态
 * - 切换项目时自动切换 Claude CLI 会话
 * - 每个项目目录都有独立的 .claude/ 会话历史
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  name: string;
  path: string;
}

interface ProjectStore {
  // 当前打开的项目
  currentProject: Project | null;

  // 最近打开的项目列表
  recentProjects: Project[];

  // 设置当前项目
  setCurrentProject: (project: Project | null) => void;

  // 清除当前项目
  clearProject: () => void;

  // 添加到最近项目列表
  addRecentProject: (project: Project) => void;

  // 从最近项目列表移除
  removeRecentProject: (path: string) => void;

  // 清除最近项目列表
  clearRecentProjects: () => void;
}

/**
 * Project Store Hook
 *
 * 使用示例:
 * ```typescript
 * const { currentProject, setCurrentProject } = useProjectStore();
 *
 * // 设置项目
 * setCurrentProject({ name: 'my-app', path: 'C:/projects/my-app' });
 *
 * // 执行 Claude CLI (会使用 currentProject.path 作为 cwd)
 * await claudeService.execute({
 *   message: '帮我修复这个 bug',
 *   cwd: currentProject?.path
 * });
 * ```
 */
export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      currentProject: null,
      recentProjects: [],

      setCurrentProject: (project) => {
        set({ currentProject: project });

        // 添加到最近项目列表
        if (project) {
          get().addRecentProject(project);
        }

        // ⭐ 切换聊天会话到对应项目
        // 动态导入 chatStore 以避免循环依赖
        import('./chatStore').then(({ useChatStore }) => {
          useChatStore.getState().switchToProject(project?.path || null);
        });
      },

      clearProject: () => {
        set({ currentProject: null });
      },

      addRecentProject: (project) => {
        set((state) => {
          // 移除重复项
          const filtered = state.recentProjects.filter((p) => p.path !== project.path);

          // 添加到列表开头，限制最多 10 个
          return {
            recentProjects: [project, ...filtered].slice(0, 10),
          };
        });
      },

      removeRecentProject: (path) => {
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.path !== path),
        }));
      },

      clearRecentProjects: () => {
        set({ recentProjects: [] });
      },
    }),
    {
      name: 'project-storage', // localStorage key
      partialize: (state) => ({
        // 只持久化最近项目列表，不持久化当前项目（避免启动时加载旧项目）
        recentProjects: state.recentProjects,
      }),
    }
  )
);
