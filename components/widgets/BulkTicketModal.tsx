'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Folder, Calendar, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Ticket } from '@/lib/ai/schemas';
import { createPortal } from 'react-dom';

interface Project {
  id: number;
  name: string;
  path: string;
  path_with_namespace?: string;
  description: string | null;
  namespace?: {
    name: string;
    path: string;
  };
}

interface Milestone {
  id: number;
  title: string;
  state: string;
  dueDate: string | null;
}

interface BulkTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  onCreateAll: (assignments: TicketAssignment[]) => Promise<void>;
  isCreating?: boolean;
}

export interface TicketAssignment {
  ticket: Ticket;
  projectPath: string;
  projectName: string;
  milestoneId?: number;
}

interface TicketSettings {
  project: Project | null;
  milestone: Milestone | null;
}

// Dropdown component that renders in a portal
function DropdownPortal({
  children,
  buttonRef,
  isOpen,
}: {
  children: React.ReactNode;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 256 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Leave 120px buffer for footer and padding
      const availableSpace = viewportHeight - rect.bottom - 120;
      const maxHeight = Math.max(100, Math.min(200, availableSpace));

      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    }
  }, [isOpen, buttonRef]);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[9999] bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

// Styled dropdown component for per-ticket selection
function TicketDropdown({
  children,
  placeholder,
  value,
  isOpen,
  onToggle,
  disabled = false,
}: {
  children: React.ReactNode;
  placeholder: string;
  value: { label: string; icon?: React.ReactNode } | null;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 192 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Leave 80px buffer for footer and padding
      const availableSpace = viewportHeight - rect.bottom - 80;
      const maxHeight = Math.max(120, Math.min(192, availableSpace));

      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onToggle();
        }}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-left hover:border-zinc-500 transition-colors text-sm disabled:opacity-50"
      >
        {value ? (
          <div className="flex items-center gap-2">
            {value.icon}
            <span className="text-white">{value.label}</span>
          </div>
        ) : (
          <span className="text-zinc-400">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[9999] bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl overflow-y-auto"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function BulkTicketModal({
  isOpen,
  onClose,
  tickets,
  onCreateAll,
  isCreating = false,
}: BulkTicketModalProps) {
  // Mode: 'single' = same project for all, 'multi' = per-ticket
  const [mode, setMode] = useState<'single' | 'multi'>('single');

  // Projects & Milestones data
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  // Single mode selections
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Multi mode: per-ticket settings
  const [ticketSettings, setTicketSettings] = useState<Map<string, TicketSettings>>(new Map());
  const [ticketMilestones, setTicketMilestones] = useState<Map<string, Milestone[]>>(new Map());
  const [loadingTicketMilestones, setLoadingTicketMilestones] = useState<Set<string>>(new Set());

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showMilestoneDropdown, setShowMilestoneDropdown] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [activeTicketDropdown, setActiveTicketDropdown] = useState<{
    id: string;
    type: 'project' | 'milestone';
  } | null>(null);

  // Refs for portal positioning
  const projectButtonRef = useRef<HTMLButtonElement>(null);
  const milestoneButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      setMode('single');
      setSelectedProject(null);
      setSelectedMilestone(null);
      setMilestones([]);
      setTicketSettings(new Map());
      setTicketMilestones(new Map());
      setExpandedTicket(null);
      setSearchQuery('');
      setShowProjectDropdown(false);
      setShowMilestoneDropdown(false);
    }
  }, [isOpen]);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/gitlab/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Fetch milestones for single mode
  const fetchMilestones = useCallback(async (projectId: number) => {
    setLoadingMilestones(true);
    setMilestones([]);
    try {
      const res = await fetch(`/api/gitlab/milestones?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setMilestones(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    } finally {
      setLoadingMilestones(false);
    }
  }, []);

  // Fetch milestones for multi mode (per ticket)
  const fetchTicketMilestones = useCallback(async (ticketKey: string, projectId: number) => {
    setLoadingTicketMilestones((prev) => new Set(prev).add(ticketKey));
    try {
      const res = await fetch(`/api/gitlab/milestones?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setTicketMilestones((prev) =>
          new Map(prev).set(ticketKey, Array.isArray(data) ? data : []),
        );
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    } finally {
      setLoadingTicketMilestones((prev) => {
        const next = new Set(prev);
        next.delete(ticketKey);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen, fetchProjects]);

  // When single mode project changes, fetch milestones
  useEffect(() => {
    if (selectedProject && mode === 'single') {
      fetchMilestones(selectedProject.id);
      setSelectedMilestone(null);
    }
  }, [selectedProject, mode, fetchMilestones]);

  const getTicketKey = (ticket: Ticket, index: number) => ticket.id || `ticket-${index}`;

  const handleSingleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setShowProjectDropdown(false);
  };

  const handleSingleMilestoneSelect = (milestone: Milestone | null) => {
    setSelectedMilestone(milestone);
    setShowMilestoneDropdown(false);
  };

  const handleTicketProjectSelect = (ticketKey: string, project: Project) => {
    setTicketSettings((prev) => {
      const next = new Map(prev);
      next.set(ticketKey, { project, milestone: null });
      return next;
    });
    setActiveTicketDropdown(null);
    fetchTicketMilestones(ticketKey, project.id);
  };

  const handleTicketMilestoneSelect = (ticketKey: string, milestone: Milestone | null) => {
    setTicketSettings((prev) => {
      const next = new Map(prev);
      const current = next.get(ticketKey);
      if (current) {
        next.set(ticketKey, { ...current, milestone });
      }
      return next;
    });
    setActiveTicketDropdown(null);
  };

  const handleCreateAll = async () => {
    const assignments: TicketAssignment[] = [];

    tickets.forEach((ticket, idx) => {
      const key = getTicketKey(ticket, idx);

      if (mode === 'single' && selectedProject) {
        assignments.push({
          ticket,
          projectPath: selectedProject.path_with_namespace || selectedProject.path,
          projectName: selectedProject.name,
          milestoneId: selectedMilestone?.id,
        });
      } else if (mode === 'multi') {
        const settings = ticketSettings.get(key);
        if (settings?.project) {
          assignments.push({
            ticket,
            projectPath: settings.project.path_with_namespace || settings.project.path,
            projectName: settings.project.name,
            milestoneId: settings.milestone?.id,
          });
        }
      }
    });

    if (assignments.length === tickets.length) {
      await onCreateAll(assignments);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const canCreate =
    mode === 'single'
      ? !!selectedProject
      : Array.from(ticketSettings.values()).filter((s) => s.project).length === tickets.length;

  const configuredCount =
    mode === 'single'
      ? selectedProject
        ? tickets.length
        : 0
      : Array.from(ticketSettings.values()).filter((s) => s.project).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => {
        setShowProjectDropdown(false);
        setShowMilestoneDropdown(false);
        setActiveTicketDropdown(null);
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] border border-zinc-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">
            Create {tickets.length} Ticket{tickets.length > 1 ? 's' : ''}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 pt-4">
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'single' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Same Project for All
            </button>
            <button
              onClick={() => setMode('multi')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'multi' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Different per Ticket
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* SINGLE MODE */}
          {mode === 'single' && (
            <>
              {/* Project Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Project</label>
                <div className="relative">
                  <button
                    ref={projectButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProjectDropdown(!showProjectDropdown);
                      setShowMilestoneDropdown(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-left hover:border-zinc-500 transition-colors"
                  >
                    {selectedProject ? (
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-amber-400" />
                        <span className="text-white">{selectedProject.name}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400">Select a project...</span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <DropdownPortal buttonRef={projectButtonRef} isOpen={showProjectDropdown}>
                    <div className="p-2 border-b border-zinc-700">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search projects..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-9 pr-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 50px)' }}>
                      {loadingProjects ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                        </div>
                      ) : filteredProjects.length === 0 ? (
                        <div className="py-4 text-center text-zinc-400 text-sm">
                          No projects found
                        </div>
                      ) : (
                        filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handleSingleProjectSelect(project)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 transition-colors text-left"
                          >
                            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-white truncate">{project.name}</div>
                              <div className="text-zinc-500 text-xs truncate">
                                {project.path_with_namespace || project.path}
                              </div>
                            </div>
                            {selectedProject?.id === project.id && (
                              <Check className="w-4 h-4 text-green-400 shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </DropdownPortal>
                </div>
              </div>

              {/* Milestone Dropdown */}
              {selectedProject && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    Milestone <span className="text-zinc-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <button
                      ref={milestoneButtonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMilestoneDropdown(!showMilestoneDropdown);
                        setShowProjectDropdown(false);
                      }}
                      disabled={loadingMilestones}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-left hover:border-zinc-500 transition-colors disabled:opacity-50"
                    >
                      {loadingMilestones ? (
                        <span className="text-zinc-400 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading...
                        </span>
                      ) : selectedMilestone ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span className="text-white">{selectedMilestone.title}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">No milestone</span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-400 transition-transform ${showMilestoneDropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <DropdownPortal
                      buttonRef={milestoneButtonRef}
                      isOpen={showMilestoneDropdown && !loadingMilestones}
                    >
                      <button
                        onClick={() => handleSingleMilestoneSelect(null)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left"
                      >
                        <span className="text-zinc-400">No milestone</span>
                        {!selectedMilestone && <Check className="w-4 h-4 text-green-400 ml-auto" />}
                      </button>
                      {milestones.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSingleMilestoneSelect(m)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left"
                        >
                          <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="text-white flex-1 truncate">{m.title}</span>
                          {selectedMilestone?.id === m.id && (
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                          )}
                        </button>
                      ))}
                      {milestones.length === 0 && (
                        <div className="py-3 text-center text-zinc-400 text-sm">No milestones</div>
                      )}
                    </DropdownPortal>
                  </div>
                </div>
              )}

              {/* Tickets Preview */}
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-zinc-300">Tickets to create</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tickets.map((ticket, idx) => (
                    <div
                      key={getTicketKey(ticket, idx)}
                      className="flex items-center gap-3 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg"
                    >
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="text-white text-sm truncate">{ticket.title}</span>
                      <span
                        className={`ml-auto px-2 py-0.5 rounded text-xs ${
                          ticket.type === 'bug'
                            ? 'bg-red-500/20 text-red-400'
                            : ticket.type === 'feature'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                        }`}
                      >
                        {ticket.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* MULTI MODE */}
          {mode === 'multi' && (
            <div className="space-y-2">
              {tickets.map((ticket, idx) => {
                const key = getTicketKey(ticket, idx);
                const settings = ticketSettings.get(key) || { project: null, milestone: null };
                const tMilestones = ticketMilestones.get(key) || [];
                const isLoading = loadingTicketMilestones.has(key);
                const isExpanded = expandedTicket === key;
                const isProjectDropdownOpen =
                  activeTicketDropdown?.id === key && activeTicketDropdown?.type === 'project';
                const isMilestoneDropdownOpen =
                  activeTicketDropdown?.id === key && activeTicketDropdown?.type === 'milestone';

                return (
                  <div key={key} className="bg-zinc-800/50 border border-zinc-700 rounded-lg">
                    <button
                      onClick={() => setExpandedTicket(isExpanded ? null : key)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 transition-colors"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          settings.project ? 'bg-green-500/20' : 'bg-zinc-600/50'
                        }`}
                      >
                        {settings.project ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <span className="text-xs text-zinc-400">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-white text-sm font-medium truncate">
                          {ticket.title}
                        </div>
                        {settings.project && (
                          <div className="text-xs text-zinc-500 truncate">
                            → {settings.project.name}
                            {settings.milestone && ` • ${settings.milestone.title}`}
                          </div>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-zinc-700/50 space-y-3">
                        {/* Project */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-400">Project</label>
                          <TicketDropdown
                            placeholder="Select project..."
                            value={
                              settings.project
                                ? {
                                    label: settings.project.name,
                                    icon: <Folder className="w-4 h-4 text-amber-400" />,
                                  }
                                : null
                            }
                            isOpen={isProjectDropdownOpen}
                            onToggle={() =>
                              setActiveTicketDropdown(
                                isProjectDropdownOpen ? null : { id: key, type: 'project' },
                              )
                            }
                          >
                            {projects.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleTicketProjectSelect(key, p)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left text-sm"
                              >
                                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-white flex-1 truncate">{p.name}</span>
                                {settings.project?.id === p.id && (
                                  <Check className="w-4 h-4 text-green-400" />
                                )}
                              </button>
                            ))}
                          </TicketDropdown>
                        </div>

                        {/* Milestone */}
                        {settings.project && (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-400">Milestone</label>
                            <TicketDropdown
                              placeholder={isLoading ? 'Loading...' : 'No milestone'}
                              value={
                                settings.milestone
                                  ? {
                                      label: settings.milestone.title,
                                      icon: <Calendar className="w-4 h-4 text-blue-400" />,
                                    }
                                  : null
                              }
                              isOpen={isMilestoneDropdownOpen}
                              onToggle={() =>
                                setActiveTicketDropdown(
                                  isMilestoneDropdownOpen ? null : { id: key, type: 'milestone' },
                                )
                              }
                              disabled={isLoading}
                            >
                              <button
                                onClick={() => handleTicketMilestoneSelect(key, null)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left text-sm"
                              >
                                <span className="text-zinc-400">No milestone</span>
                                {!settings.milestone && (
                                  <Check className="w-4 h-4 text-green-400 ml-auto" />
                                )}
                              </button>
                              {tMilestones.map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => handleTicketMilestoneSelect(key, m)}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left text-sm"
                                >
                                  <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                                  <span className="text-white flex-1 truncate">{m.title}</span>
                                  {settings.milestone?.id === m.id && (
                                    <Check className="w-4 h-4 text-green-400" />
                                  )}
                                </button>
                              ))}
                            </TicketDropdown>
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
        <div className="flex items-center justify-between p-4 border-t border-zinc-700 bg-zinc-800/50">
          <div className="text-sm text-zinc-400">
            {configuredCount} of {tickets.length} configured
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAll}
              disabled={!canCreate || isCreating}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create {tickets.length} Tickets</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
