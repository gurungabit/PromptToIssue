'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Folder, Calendar, Check, Loader2 } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  path: string;
  description: string | null;
  webUrl: string;
}

interface Milestone {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  dueDate: string | null;
}

interface SelectedProject {
  project: Project;
  milestoneId?: number;
  milestoneName?: string;
}

interface ProjectSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onCreateTicket: (projectPath: string, projectName: string, milestoneId?: number) => Promise<void>;
  isCreating?: boolean;
}

export function ProjectSelectorModal({ 
  open, 
  onClose, 
  onCreateTicket,
  isCreating = false
}: ProjectSelectorModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Record<number, Milestone[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [loadingMilestones, setLoadingMilestones] = useState<number | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const url = searchQuery 
        ? `/api/gitlab/projects?search=${encodeURIComponent(searchQuery)}`
        : '/api/gitlab/projects';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open, fetchProjects]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) fetchProjects();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, open, fetchProjects]);

  const fetchMilestones = async (projectId: number) => {
    if (milestones[projectId]) return; // Already loaded
    
    setLoadingMilestones(projectId);
    try {
      const res = await fetch(`/api/gitlab/milestones?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setMilestones(prev => ({ ...prev, [projectId]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    } finally {
      setLoadingMilestones(null);
    }
  };

  const handleProjectSelect = (project: Project) => {
    if (selectedProject?.project.id === project.id) {
      // Deselect
      setSelectedProject(null);
      setExpandedProject(null);
    } else {
      setSelectedProject({ project });
      // Auto-expand to show milestones
      setExpandedProject(project.id);
      fetchMilestones(project.id);
    }
  };

  const handleMilestoneSelect = (milestone: Milestone | null) => {
    if (selectedProject) {
      setSelectedProject({
        ...selectedProject,
        milestoneId: milestone?.id,
        milestoneName: milestone?.title,
      });
    }
  };

  const handleCreateTicket = async () => {
    if (!selectedProject) return;
    await onCreateTicket(
      selectedProject.project.path,
      selectedProject.project.name,
      selectedProject.milestoneId
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col pointer-events-auto border border-zinc-200 dark:border-zinc-700">
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Create Ticket in Project
            </h2>
            <button 
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Project List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                No projects found
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map(project => {
                  const isSelected = selectedProject?.project.id === project.id;
                  const isExpanded = expandedProject === project.id;
                  const projectMilestones = milestones[project.id] || [];

                  return (
                    <div key={project.id}>
                      <div
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all
                          ${isSelected 
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'
                          }
                        `}
                        onClick={() => handleProjectSelect(project)}
                      >
                        {/* Selection indicator */}
                        <div className={`
                          w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                          ${isSelected 
                            ? 'bg-blue-500 border-blue-500 text-white' 
                            : 'border-zinc-300 dark:border-zinc-600'
                          }
                        `}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        
                        <Folder className="w-5 h-5 text-zinc-400 shrink-0" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                            {project.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {project.path}
                          </div>
                        </div>

                        {/* Show milestone indicator when selected */}
                        {isSelected && (
                          <div
                            className={`
                              flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                              ${selectedProject?.milestoneName 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                              }
                            `}
                          >
                            <Calendar className="w-3 h-3" />
                            {selectedProject?.milestoneName || 'No milestone'}
                          </div>
                        )}
                      </div>

                      {/* Milestones dropdown */}
                      {isExpanded && isSelected && (
                        <div className="ml-8 mt-1 mb-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-700">
                          {loadingMilestones === project.id ? (
                            <div className="flex items-center justify-center py-3">
                              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            </div>
                          ) : projectMilestones.length === 0 ? (
                            <div className="text-xs text-zinc-500 py-2 px-2">No active milestones</div>
                          ) : (
                            <div className="space-y-1">
                              <button
                                onClick={() => handleMilestoneSelect(null)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${
                                !selectedProject?.milestoneId 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                              }`}
                              >
                                No milestone
                              </button>
                              {projectMilestones.map(milestone => (
                                <button
                                  key={milestone.id}
                                  onClick={() => handleMilestoneSelect(milestone)}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm text-left ${
                                  selectedProject?.milestoneId === milestone.id 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                }`}
                                >
                                  <span className="truncate">{milestone.title}</span>
                                  {milestone.dueDate && (
                                    <span className="text-xs text-zinc-400 shrink-0 ml-2">
                                      {new Date(milestone.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <div className="text-sm text-zinc-500">
              {selectedProject ? (
                <span>Creating in <span className="font-medium text-zinc-700 dark:text-zinc-300">{selectedProject.project.name}</span></span>
              ) : (
                'Select a project'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!selectedProject || isCreating}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Ticket'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
