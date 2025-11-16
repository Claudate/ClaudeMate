/**
 * Projects Module
 * Project management interface with VSCode-style UI
 */

import { useState } from 'react';

interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  lastOpened: number;
  isActive: boolean;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Example Project 1',
      path: 'C:\\Users\\Projects\\example1',
      description: 'Sample project with TypeScript and React',
      lastOpened: Date.now() - 1000 * 60 * 30, // 30 minutes ago
      isActive: true,
    },
    {
      id: '2',
      name: 'Example Project 2',
      path: 'C:\\Users\\Projects\\example2',
      description: 'Node.js backend service',
      lastOpened: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      isActive: false,
    },
  ]);

  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    path: '',
    description: '',
  });

  const handleAddProject = () => {
    if (newProject.name && newProject.path) {
      const project: Project = {
        id: Date.now().toString(),
        name: newProject.name,
        path: newProject.path,
        description: newProject.description,
        lastOpened: Date.now(),
        isActive: false,
      };
      setProjects([project, ...projects]);
      setNewProject({ name: '', path: '', description: '' });
      setShowNewProjectForm(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    setProjects(
      projects.map((p) => ({
        ...p,
        isActive: p.id === projectId,
        lastOpened: p.id === projectId ? Date.now() : p.lastOpened,
      }))
    );
  };

  const handleRemoveProject = (projectId: string) => {
    setProjects(projects.filter((p) => p.id !== projectId));
  };

  const formatLastOpened = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  return (
    <div className="h-full flex flex-col bg-vscode-editor-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-vscode-border bg-vscode-sidebar-bg">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <i className="codicon codicon-folder-library text-vscode-accent text-2xl" />
            Projects
          </h1>
          <p className="text-xs text-vscode-foreground-dim mt-1">
            Manage your Claude AI projects • {projects.length} total
          </p>
        </div>
        <button
          onClick={() => setShowNewProjectForm(!showNewProjectForm)}
          className="px-3 py-1.5 text-sm vscode-button flex items-center gap-1"
        >
          <i className="codicon codicon-add" />
          New Project
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* New Project Form */}
        {showNewProjectForm && (
          <div className="vscode-panel p-4 mb-4 animate-slide-in">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <i className="codicon codicon-new-folder" />
              Create New Project
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-vscode-foreground-dim mb-1 block">
                  Project Name*
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  className="vscode-input"
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="text-xs text-vscode-foreground-dim mb-1 block">
                  Project Path*
                </label>
                <input
                  type="text"
                  value={newProject.path}
                  onChange={(e) =>
                    setNewProject({ ...newProject, path: e.target.value })
                  }
                  className="vscode-input"
                  placeholder="C:\Users\Projects\my-project"
                />
              </div>
              <div>
                <label className="text-xs text-vscode-foreground-dim mb-1 block">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  className="vscode-input min-h-[60px]"
                  placeholder="Project description..."
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddProject} className="vscode-button">
                  <i className="codicon codicon-check" /> Create
                </button>
                <button
                  onClick={() => setShowNewProjectForm(false)}
                  className="vscode-button-secondary"
                >
                  <i className="codicon codicon-close" /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects List */}
        {projects.length === 0 ? (
          <div className="h-full flex items-center justify-center text-vscode-foreground-dim">
            <div className="text-center">
              <i className="codicon codicon-folder-library text-6xl opacity-30 mb-4 block" />
              <h2 className="text-xl font-semibold mb-2 text-vscode-foreground">
                No Projects Yet
              </h2>
              <p className="text-sm">
                Create your first project to get started
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`vscode-card group ${
                  project.isActive ? 'border-vscode-accent' : ''
                }`}
              >
                {/* Project Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <i
                      className={`codicon codicon-folder-opened text-2xl ${
                        project.isActive
                          ? 'text-vscode-accent'
                          : 'text-vscode-foreground-dim'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {project.name}
                      </h3>
                      {project.isActive && (
                        <span className="text-xs text-vscode-accent">
                          <i className="codicon codicon-circle-filled" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveProject(project.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-vscode-foreground-dim hover:text-red-400"
                    title="Remove project"
                  >
                    <i className="codicon codicon-trash" />
                  </button>
                </div>

                {/* Project Path */}
                <div className="text-xs text-vscode-foreground-dim mb-2 flex items-center gap-1">
                  <i className="codicon codicon-folder" />
                  <span className="truncate">{project.path}</span>
                </div>

                {/* Project Description */}
                {project.description && (
                  <p className="text-xs text-vscode-foreground-dim mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Project Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-vscode-border">
                  <span className="text-xs text-vscode-foreground-dim flex items-center gap-1">
                    <i className="codicon codicon-history" />
                    {formatLastOpened(project.lastOpened)}
                  </span>
                  <button
                    onClick={() => handleOpenProject(project.id)}
                    disabled={project.isActive}
                    className="text-xs px-2 py-1 bg-vscode-accent hover:bg-vscode-accent-hover text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <i className="codicon codicon-folder-opened" />
                    {project.isActive ? 'Active' : 'Open'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
