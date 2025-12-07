/**
 * Workflow Module
 * Visual node-based workflow builder with Claude AI automation
 */

import { useState, useEffect, useCallback } from 'react';
import WorkflowEditor from './components/WorkflowEditor';
import type { WorkflowDefinition } from '../../../main/workflow/types';
import { IPCChannels } from '../../../shared/types/ipc.types';
import { WORKFLOW_TEMPLATES, TEMPLATE_METADATA } from './utils/workflowTemplates';
import { useProjectStore } from '../../stores/projectStore';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'writing' | 'analysis' | 'automation' | 'custom';
  steps: number;
  estimatedTime: string;
  isActive: boolean;
  definition?: WorkflowDefinition; // Added workflow definition
}

// Helper function: Simple hash for generating stable IDs
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export default function Workflow() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | WorkflowTemplate['category']>('all');
  const [filterByProject, setFilterByProject] = useState(true); // ⭐ 是否只显示当前项目的工作流
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | undefined>(undefined);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // ⭐ 获取当前项目
  const currentProject = useProjectStore((state) => state.currentProject);

  // ⭐⭐⭐ 使用 useCallback 包裹 loadWorkflows 防止无限循环
  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true);

      // ⭐⭐⭐ 从 Skills 加载工作流（按项目分组）
      const projectPath = filterByProject && currentProject?.path ? currentProject.path : undefined;

      const response = await window.electronAPI.invoke<{ skills: any[] }>(
        IPCChannels.SKILL_GET_ALL,
        { projectPath }
      );

      if (response?.skills) {
        // 按项目分组 Skills
        const projectSkillsMap = new Map<string, any[]>();

        response.skills.forEach((skill) => {
          // 只处理项目 Skills，跳过内置 Skills
          if (skill.source !== 'project' || !skill.projectPath || !skill.projectName) {
            return;
          }

          const key = skill.projectPath;
          if (!projectSkillsMap.has(key)) {
            projectSkillsMap.set(key, []);
          }
          projectSkillsMap.get(key)!.push(skill);
        });

        // 将每个项目转换为一个工作流
        const templates: WorkflowTemplate[] = Array.from(projectSkillsMap.entries()).map(([path, skills]) => {
          const firstSkill = skills[0];
          const projectName = firstSkill.projectName;

          // 统计各类别的 Skills
          const categories = skills.map(s => s.category);
          const primaryCategory = categories.find(c => c !== 'custom') || 'custom';

          return {
            id: `workflow-${projectName}-${simpleHash(path)}`,
            name: projectName,
            description: `包含 ${skills.length} 个技能：${skills.map(s => s.name).slice(0, 3).join('、')}${skills.length > 3 ? '等' : ''}`,
            category: primaryCategory as any,
            steps: skills.length,
            estimatedTime: `~${skills.length * 2} min`,
            isActive: false,
            // 存储项目路径用于后续加载
            definition: {
              projectPath: path,
              projectName: projectName,
              skillIds: skills.map(s => s.id),
            } as any,
          };
        });

        setWorkflows(templates);
        console.log(`[Workflow] 加载了 ${templates.length} 个项目工作流，共 ${response.skills.filter(s => s.source === 'project').length} 个 Skills`);
      }
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, filterByProject]); // ⭐ 添加依赖项

  // ⭐ 当项目或筛选条件变化时,重新加载工作流
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const toggleWorkflow = async (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;

    const updatedActive = !workflow.isActive;
    setWorkflows(workflows.map((w) => (w.id === id ? { ...w, isActive: updatedActive } : w)));

    // 可选: 持久化到数据库 (暂时先只更新UI)
  };

  const deleteWorkflow = async (id: string) => {
    try {
      await window.electronAPI.invoke(IPCChannels.WORKFLOW_DELETE, { id });
      setWorkflows(workflows.filter((w) => w.id !== id));
      if (selectedWorkflow === id) {
        setSelectedWorkflow(null);
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const filteredWorkflows =
    filterCategory === 'all'
      ? workflows
      : workflows.filter((w) => w.category === filterCategory);

  const selected = workflows.find((w) => w.id === selectedWorkflow);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'coding':
        return 'codicon-code';
      case 'writing':
        return 'codicon-edit';
      case 'analysis':
        return 'codicon-graph';
      case 'automation':
        return 'codicon-gear';
      default:
        return 'codicon-symbol-namespace';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'coding':
        return 'text-blue-400';
      case 'writing':
        return 'text-green-400';
      case 'analysis':
        return 'text-purple-400';
      case 'automation':
        return 'text-orange-400';
      default:
        return 'text-vscode-foreground-dim';
    }
  };

  // Handle creating new workflow
  const handleCreateNew = () => {
    setEditingWorkflow(undefined);
    setIsEditorOpen(true);
  };

  // Handle editing existing workflow (从项目的所有 Skills 生成工作流)
  const handleEditWorkflow = async (id: string) => {
    try {
      // 查找工作流定义
      const workflow = workflows.find(w => w.id === id);
      if (!workflow?.definition) {
        console.error('Workflow definition not found:', id);
        alert(`无法找到工作流定义 (ID: ${id})`);
        return;
      }

      const { projectPath, projectName, skillIds } = workflow.definition as any;

      // 获取该项目的所有 Skills
      const response = await window.electronAPI.invoke<{ skills: any[] }>(
        IPCChannels.SKILL_GET_ALL,
        { projectPath }
      );

      const projectSkills = response?.skills?.filter(s => skillIds.includes(s.id)) || [];

      if (projectSkills.length === 0) {
        console.error('No skills found for workflow:', id);
        alert(`无法找到该工作流的 Skills\n\n项目路径: ${projectPath}`);
        await loadWorkflows();
        return;
      }

      // 从项目的所有 Skills 生成工作流节点
      const nodes = projectSkills.map((skill, index) => ({
        id: `skill-${skill.id}`,
        type: 'skill',
        position: {
          x: 150 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 200
        },
        data: {
          label: skill.name,
          config: {
            type: 'skill',
            name: skill.name,
            prompt: skill.prompt || skill.description,
            outputVariable: `skill_${index}_result`,
          },
          status: 'idle',
        },
      }));

      const workflowDefinition: WorkflowDefinition = {
        id: workflow.id,
        name: projectName,
        description: `${projectName} 的完整工作流，包含 ${projectSkills.length} 个技能`,
        category: workflow.category,
        tags: ['project', projectName],
        nodes,
        edges: [],
        variables: {
          projectPath,
          projectName,
          skillCount: projectSkills.length,
        },
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectPath,
        projectName,
      };

      setEditingWorkflow(workflowDefinition);
      setIsEditorOpen(true);
    } catch (error) {
      console.error('Failed to load workflow for editing:', error);
      alert(`加载工作流失败: ${error}`);
    }
  };

  // ⭐ Handle running workflow
  const handleRunWorkflow = async (id: string) => {
    try {
      setIsExecuting(true);
      const result = await window.electronAPI.invoke(IPCChannels.WORKFLOW_EXECUTE, { id });

      if (result.status === 'completed') {
        console.log('Workflow completed successfully:', result);
        alert(`工作流执行成功!\n\n执行时间: ${(result.endTime - result.startTime) / 1000}秒\n已完成节点: ${result.nodeResults.length}个`);
      } else if (result.status === 'failed') {
        console.error('Workflow failed:', result.error);
        alert(`工作流执行失败:\n${result.error}`);
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert(`执行工作流时出错:\n${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle saving workflow
  const handleSaveWorkflow = async (definition: WorkflowDefinition) => {
    try {
      const existingIndex = workflows.findIndex(w => w.id === definition.id);

      if (existingIndex >= 0) {
        // 更新现有工作流
        await window.electronAPI.invoke(IPCChannels.WORKFLOW_UPDATE, {
          id: definition.id,
          updates: definition,
        });
      } else {
        // 创建新工作流
        await window.electronAPI.invoke(IPCChannels.WORKFLOW_CREATE, definition);
      }

      // 重新加载工作流列表
      await loadWorkflows();

      setIsEditorOpen(false);
      setEditingWorkflow(undefined);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  // Handle creating workflow from template
  const handleCreateFromTemplate = (templateKey: keyof typeof WORKFLOW_TEMPLATES) => {
    const createTemplate = WORKFLOW_TEMPLATES[templateKey];
    const workflowDefinition = createTemplate();
    setEditingWorkflow(workflowDefinition);
    setShowTemplateSelector(false);
    setIsEditorOpen(true);
  };

  // Show editor if open
  if (isEditorOpen) {
    return (
      <WorkflowEditor
        workflow={editingWorkflow}
        onSave={handleSaveWorkflow}
        onClose={() => setIsEditorOpen(false)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-vscode-editor-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-vscode-border bg-vscode-sidebar-bg">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <i className="codicon codicon-symbol-namespace text-vscode-accent text-2xl" />
            Workflow Manager
          </h1>
          <p className="text-xs text-vscode-foreground-dim mt-1">
            从 Skills 自动生成的工作流 • {workflows.length} 个可用
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCreateNew}
            className="vscode-button flex items-center gap-1.5 px-3 py-1.5"
            title="创建新的工作流"
          >
            <i className="codicon codicon-add" />
            新建工作流
          </button>
          <button
            onClick={() => setShowTemplateSelector(true)}
            className="vscode-button-secondary flex items-center gap-1.5 px-3 py-1.5"
            title="从模板创建工作流"
          >
            <i className="codicon codicon-library" />
            使用模板
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 border-b border-vscode-border bg-vscode-sidebar-bg/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                filterCategory === 'all'
                  ? 'bg-vscode-accent text-white'
                  : 'bg-vscode-input-bg hover:bg-vscode-input-border'
              }`}
            >
              All
            </button>
          <button
            onClick={() => setFilterCategory('coding')}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
              filterCategory === 'coding'
                ? 'bg-vscode-accent text-white'
                : 'bg-vscode-input-bg hover:bg-vscode-input-border'
            }`}
          >
            <i className="codicon codicon-code" />
            Coding
          </button>
          <button
            onClick={() => setFilterCategory('writing')}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
              filterCategory === 'writing'
                ? 'bg-vscode-accent text-white'
                : 'bg-vscode-input-bg hover:bg-vscode-input-border'
            }`}
          >
            <i className="codicon codicon-edit" />
            Writing
          </button>
          <button
            onClick={() => setFilterCategory('analysis')}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
              filterCategory === 'analysis'
                ? 'bg-vscode-accent text-white'
                : 'bg-vscode-input-bg hover:bg-vscode-input-border'
            }`}
          >
            <i className="codicon codicon-graph" />
            Analysis
          </button>
          </div>

          {/* ⭐ Project Filter Toggle */}
          <div className="flex items-center gap-2">
            {currentProject && (
              <span className="text-xs text-vscode-foreground-dim flex items-center gap-1">
                <i className="codicon codicon-folder" />
                {currentProject.name}
              </span>
            )}
            <button
              onClick={() => setFilterByProject(!filterByProject)}
              className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
                filterByProject
                  ? 'bg-vscode-accent text-white'
                  : 'bg-vscode-input-bg hover:bg-vscode-input-border'
              }`}
              title={filterByProject ? '当前仅显示此项目的工作流' : '显示所有项目的工作流'}
            >
              <i className={`codicon ${filterByProject ? 'codicon-filter-filled' : 'codicon-filter'}`} />
              {filterByProject ? '当前项目' : '所有项目'}
            </button>
          </div>
        </div>
      </div>

      {/* Content - Grid Layout */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
            <div className="text-center">
              <i className="codicon codicon-loading codicon-modifier-spin text-4xl mb-4 block" />
              <p className="text-sm">Loading workflows...</p>
            </div>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
            <div className="text-center">
              <i className="codicon codicon-symbol-namespace text-6xl opacity-30 mb-4 block" />
              <h2 className="text-xl font-semibold mb-2 text-vscode-foreground">No Workflows Found</h2>
              <p className="text-sm">Create a new workflow to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow.id)}
                className={`vscode-card cursor-pointer group ${
                  selectedWorkflow === workflow.id ? 'border-vscode-accent' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i
                      className={`codicon ${getCategoryIcon(workflow.category)} text-2xl ${getCategoryColor(
                        workflow.category
                      )}`}
                    />
                    <div>
                      <h3 className="font-semibold text-sm">{workflow.name}</h3>
                      <span className="text-xs text-vscode-foreground-dim capitalize">
                        {workflow.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-vscode-foreground-dim mb-3 line-clamp-2">
                  {workflow.description}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-3 pt-3 border-t border-vscode-border text-xs text-vscode-foreground-dim">
                  <span className="flex items-center gap-1">
                    <i className="codicon codicon-symbol-method" />
                    Skill
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="codicon codicon-clock" />
                    {workflow.estimatedTime}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Workflow Details Modal */}
      {selected && (
        <div className="fixed inset-x-4 bottom-4 max-w-2xl mx-auto vscode-panel p-4 shadow-2xl border-2 border-vscode-accent animate-slide-in">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <i
                className={`codicon ${getCategoryIcon(selected.category)} text-3xl ${getCategoryColor(
                  selected.category
                )}`}
              />
              <div>
                <h3 className="font-semibold text-lg">{selected.name}</h3>
                <p className="text-sm text-vscode-foreground-dim">{selected.description}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedWorkflow(null)}
              className="text-vscode-foreground-dim hover:text-vscode-foreground"
            >
              <i className="codicon codicon-close text-xl" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div>
              <div className="text-vscode-foreground-dim mb-1">Category</div>
              <div className="capitalize">{selected.category}</div>
            </div>
            <div>
              <div className="text-vscode-foreground-dim mb-1">Steps</div>
              <div>{selected.steps} steps</div>
            </div>
            <div>
              <div className="text-vscode-foreground-dim mb-1">Duration</div>
              <div>{selected.estimatedTime}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleEditWorkflow(selected.id)}
              className="vscode-button flex items-center gap-1"
            >
              <i className="codicon codicon-edit" />
              编辑工作流
            </button>
          </div>
        </div>
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="vscode-panel w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-vscode-border flex items-center justify-between sticky top-0 bg-vscode-panel-bg z-10">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <i className="codicon codicon-library text-vscode-accent" />
                  Workflow Templates
                </h2>
                <p className="text-xs text-vscode-foreground-dim mt-1">
                  Choose a pre-configured workflow template to get started quickly
                </p>
              </div>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="text-vscode-foreground-dim hover:text-vscode-foreground"
              >
                <i className="codicon codicon-close text-xl" />
              </button>
            </div>

            {/* Template Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATE_METADATA.map((template) => {
                const colorClasses = {
                  blue: 'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5',
                  green: 'border-green-500/30 hover:border-green-500/60 bg-green-500/5',
                  purple: 'border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5',
                  orange: 'border-orange-500/30 hover:border-orange-500/60 bg-orange-500/5',
                };
                const iconColors = {
                  blue: 'text-blue-400',
                  green: 'text-green-400',
                  purple: 'text-purple-400',
                  orange: 'text-orange-400',
                };

                return (
                  <button
                    key={template.key}
                    onClick={() => handleCreateFromTemplate(template.key as keyof typeof WORKFLOW_TEMPLATES)}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left
                      ${colorClasses[template.color as keyof typeof colorClasses]}
                    `}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <i
                        className={`codicon ${template.icon} text-3xl ${iconColors[template.color as keyof typeof iconColors]}`}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                        <span className="text-xs text-vscode-foreground-dim capitalize">
                          {template.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-vscode-foreground-dim leading-relaxed">
                      {template.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-vscode-border bg-vscode-sidebar-bg/30">
              <p className="text-xs text-vscode-foreground-dim flex items-center gap-1">
                <i className="codicon codicon-info" />
                These templates come with pre-configured nodes and connections. You can customize them after creation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
