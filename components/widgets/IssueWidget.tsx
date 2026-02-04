'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink,
  Plus,
  X,
  Trash2
} from 'lucide-react';
import type { Ticket, Task } from '@/lib/ai/schemas';
import { useToast } from '@/components/ui/Toast';
import { ProjectSelectorModal } from './ProjectSelectorModal';

interface IssueWidgetProps {
  issue: Ticket;
  status?: 'draft' | 'created' | 'preview';
  className?: string;
  isReadOnly?: boolean;
  onUpdate?: (issue: Ticket) => void;
  onTicketCreated?: (ticketUrl: string, ticketTitle: string) => void;
}

export function IssueWidget({ issue, status = 'preview', className = '', isReadOnly = false, onUpdate, onTicketCreated }: IssueWidgetProps) {
  // State for edit mode
  const [isEditing, setIsEditing] = useState(false);
  // We initialize editedIssue with default values for arrays to avoid null access
  const [editedIssue, setEditedIssue] = useState<Ticket>({
    ...issue,
    labels: issue.labels || [],
    acceptanceCriteria: issue.acceptanceCriteria || [],
    tasks: issue.tasks || []
  });

  // Sync editedIssue when the issue prop changes (e.g., from parent's editedTickets Map)
  // Only sync if NOT currently editing to avoid overwriting user's unsaved changes
  useEffect(() => {
    if (!isEditing) {
      console.log('[IssueWidget] useEffect syncing from prop, labels:', issue.labels);
      setEditedIssue({
        ...issue,
        labels: issue.labels || [],
        acceptanceCriteria: issue.acceptanceCriteria || [],
        tasks: issue.tasks || []
      });
    }
  }, [issue, isEditing]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const { showToast } = useToast();

  const stateColor = editedIssue.state === 'closed' ? 'text-blue-500' : 'text-green-500';
  const StateIcon = editedIssue.state === 'closed' ? CheckCircle2 : AlertCircle;

  function handleSave() {
    console.log('[IssueWidget] handleSave called, labels:', editedIssue.labels);
    setIsEditing(false);
    onUpdate?.(editedIssue);
  }

  async function handleCreate() {
    // Always show project selector modal - user should pick the project
    setShowProjectSelector(true);
  }

  async function createTicketWithProject(projectPath: string, milestoneId?: number) {
    setIsSubmitting(true);
    try {
        const ticketData = { ...editedIssue, projectId: projectPath };
        console.log('[IssueWidget] Creating ticket with data:', { 
          title: ticketData.title, 
          labels: ticketData.labels,
          projectId: ticketData.projectId 
        });
        
        const res = await fetch('/api/gitlab/issues/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...ticketData, milestoneId })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            // If project not found, show the project selector modal
            if (res.status === 500 && data.error?.includes('404')) {
                showToast('Project not found. Please select a valid project.', 'warning');
                setShowProjectSelector(true);
                return;
            }
            throw new Error(data.error || 'Failed to create issue');
        }
        
        // Success - update state
        const newIssue = { ...ticketData, ...data, state: 'opened' };
        setEditedIssue(newIssue);
        if (onUpdate) onUpdate(newIssue);
        
        // Close modal
        setShowProjectSelector(false);
        
        // Notify parent about created ticket for assistant message
        console.log('[IssueWidget] Ticket created:', { webUrl: data.webUrl, title: ticketData.title, hasCallback: !!onTicketCreated });
        if (data.webUrl && onTicketCreated) {
            console.log('[IssueWidget] Calling onTicketCreated callback');
            onTicketCreated(data.webUrl, ticketData.title);
        }
        
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'An error occurred';
        // Also handle 404 in error message
        if (errorMsg.includes('404') || errorMsg.includes('Project Not Found')) {
            showToast('Project not found. Please select a valid project.', 'warning');
            setShowProjectSelector(true);
        } else {
            showToast(errorMsg, 'error');
        }
    } finally {
        setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setEditedIssue({
        ...issue,
        labels: issue.labels || [],
        acceptanceCriteria: issue.acceptanceCriteria || [],
        tasks: issue.tasks || []
    });
    setIsEditing(false);
  }

  function addAcceptanceCriteria() {
    setEditedIssue({
      ...editedIssue,
      acceptanceCriteria: [
        ...editedIssue.acceptanceCriteria,
        { id: crypto.randomUUID(), description: '', completed: false }
      ]
    });
  }

  function updateAcceptanceCriteria(id: string, description: string) {
    setEditedIssue({
      ...editedIssue,
      acceptanceCriteria: editedIssue.acceptanceCriteria.map(ac => 
        ac.id === id ? { ...ac, description } : ac
      )
    });
  }

  function removeAcceptanceCriteria(id: string) {
    setEditedIssue({
      ...editedIssue,
      acceptanceCriteria: editedIssue.acceptanceCriteria.filter(ac => ac.id !== id)
    });
  }

  function addTask() {
    setEditedIssue({
      ...editedIssue,
      tasks: [
        ...editedIssue.tasks,
        { id: crypto.randomUUID(), description: '', completed: false }
      ]
    });
  }

  function updateTask<K extends keyof Task>(id: string, field: K, value: Task[K]) {
    setEditedIssue({
      ...editedIssue,
      tasks: editedIssue.tasks.map(t => 
        t.id === id ? { ...t, [field]: value } : t
      )
    });
  }

  function removeTask(id: string) {
    setEditedIssue({
      ...editedIssue,
      tasks: editedIssue.tasks.filter(t => t.id !== id)
    });
  }

  function addLabel(label: string) {
    console.log('[IssueWidget] addLabel called with:', label, 'current labels:', editedIssue.labels);
    if (label && !editedIssue.labels.includes(label)) {
      const newLabels = [...editedIssue.labels, label];
      console.log('[IssueWidget] Adding label, new labels:', newLabels);
      setEditedIssue({
        ...editedIssue,
        labels: newLabels
      });
    }
  }

  function removeLabel(label: string) {
    setEditedIssue({
      ...editedIssue,
      labels: editedIssue.labels.filter(l => l !== label)
    });
  }

  return (
    <>
    <div className={`
      w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-700 
      bg-white dark:bg-zinc-800 shadow-sm overflow-hidden ${className}
    `}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-700/50 flex items-start justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-800/50">
        <div className="flex items-start gap-3 overflow-hidden flex-1">
          <StateIcon className={`w-5 h-5 mt-0.5 shrink-0 ${stateColor}`} />
          <div className="flex flex-col min-w-0 flex-1 space-y-2">
            {isEditing ? (
              <div className="space-y-3">
                 <input
                  type="text"
                  value={editedIssue.title}
                  onChange={(e) => setEditedIssue({ ...editedIssue, title: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Ticket Title"
                />
                
                {/* Project ID Input Removed */}

                <div className="flex gap-3">
                    <select
                        value={editedIssue.type}
                        onChange={(e) => setEditedIssue({ ...editedIssue, type: e.target.value as Ticket['type'] })}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-xs"
                    >
                        <option value="feature">Feature</option>
                        <option value="bug">Bug</option>
                        <option value="enhancement">Enhancement</option>
                        <option value="documentation">Documentation</option>
                        <option value="refactor">Refactor</option>
                    </select>
                    <select
                        value={editedIssue.priority}
                        onChange={(e) => setEditedIssue({ ...editedIssue, priority: e.target.value as Ticket['priority'] })}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-xs"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                     <input
                        type="number"
                        value={editedIssue.estimatedHours || ''}
                        onChange={(e) => setEditedIssue({ ...editedIssue, estimatedHours: parseFloat(e.target.value) || undefined })}
                        className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-xs"
                        placeholder="Hours"
                    />
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg leading-tight">
                  {editedIssue.title}
                </h3>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1.5">
                    <span className="font-mono bg-zinc-100 dark:bg-zinc-700/50 px-1.5 py-0.5 rounded">#{editedIssue.iid || editedIssue.id.slice(0,8)}</span>
                    <span className={`capitalize px-1.5 py-0.5 rounded-full ${
                        editedIssue.priority === 'critical' || editedIssue.priority === 'high' 
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' 
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700/50'
                    }`}>{editedIssue.priority}</span>
                     <span className="capitalize bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{editedIssue.type}</span>
                     {editedIssue.estimatedHours && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {editedIssue.estimatedHours}h
                        </span>
                     )}
                     {editedIssue.projectId && (
                        <span className="text-zinc-400">
                            in <span className="text-blue-500 font-medium">{selectedProjectName || editedIssue.projectId}</span>
                        </span>
                     )}
                  </div>
              </div>
            )
            }
          </div>
        </div>
        
        {issue.webUrl && !isEditing && (
          <a 
            href={issue.webUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            title="Open in GitLab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-6">
        {/* Description */}
        <div className="space-y-2">
             <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
            {isEditing ? (
            <textarea
                value={editedIssue.description || ''}
                onChange={(e) => setEditedIssue({ ...editedIssue, description: e.target.value })}
                className="w-full min-h-[120px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                placeholder="Detailed description..."
            />
            ) : (
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {editedIssue.description || <span className="text-zinc-400 italic">No description provided</span>}
                </p>
            )}
        </div>

        {/* Acceptance Criteria */}
        {(isEditing || (editedIssue.acceptanceCriteria && editedIssue.acceptanceCriteria.length > 0)) && (
            <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Acceptance Criteria</label>
                    {isEditing && (
                        <button onClick={addAcceptanceCriteria} className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1 font-medium">
                            <Plus className="w-3 h-3" /> Add Criteria
                        </button>
                    )}
                 </div>
                 <div className="space-y-2">
                    {editedIssue.acceptanceCriteria.length === 0 && !isEditing && (
                         <p className="text-sm text-zinc-400 italic">No acceptance criteria defined.</p>
                    )}
                    {editedIssue.acceptanceCriteria.map((ac) => (
                        <div key={ac.id} className="flex items-start gap-2 group">
                             <div className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                 ac.completed 
                                 ? 'bg-green-500 border-green-500 text-white' 
                                 : 'border-zinc-300 dark:border-zinc-600'
                             }`}>
                                 {ac.completed && <CheckCircle2 className="w-3 h-3" />}
                             </div>
                             {isEditing ? (
                                 <div className="flex-1 flex gap-2">
                                     <input 
                                        type="text" 
                                        value={ac.description}
                                        onChange={(e) => updateAcceptanceCriteria(ac.id, e.target.value)}
                                        className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="Criteria description"
                                     />
                                     <button onClick={() => removeAcceptanceCriteria(ac.id)} className="text-zinc-400 hover:text-red-500 p-1">
                                         <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                 </div>
                             ) : (
                                 <span className={`text-sm ${ac.completed ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                     {ac.description}
                                 </span>
                             )}
                        </div>
                    ))}
                 </div>
            </div>
        )}

        {/* Tasks */}
        {(isEditing || (editedIssue.tasks && editedIssue.tasks.length > 0)) && (
             <div className="space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tasks</label>
                {isEditing && (
                    <button onClick={addTask} className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1 font-medium">
                        <Plus className="w-3 h-3" /> Add Task
                    </button>
                )}
             </div>
             <div className="space-y-2">
                {editedIssue.tasks.length === 0 && !isEditing && (
                     <p className="text-sm text-zinc-400 italic">No tasks defined.</p>
                )}
                {editedIssue.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                          {isEditing ? (
                             <div className="flex-1 space-y-2">
                                 <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={task.description}
                                        onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="Task description"
                                    />
                                    <button onClick={() => removeTask(task.id)} className="text-zinc-400 hover:text-red-500 p-1">
                                         <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <input 
                                        type="number"
                                        value={task.estimatedHours || ''}
                                        onChange={(e) => updateTask(task.id, 'estimatedHours', parseFloat(e.target.value) || undefined)}
                                        className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs"
                                        placeholder="Hours"
                                     />
                                     <span className="text-xs text-zinc-500">hours</span>
                                 </div>
                             </div>
                         ) : (
                             <div className="flex-1">
                                 <div className="flex items-center justify-between">
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{task.description}</span>
                                    {task.estimatedHours && (
                                        <span className="text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">{task.estimatedHours}h</span>
                                    )}
                                 </div>
                             </div>
                         )}
                    </div>
                ))}
             </div>
        </div>
        )}

        {/* Labels */}
        {(isEditing || (editedIssue.labels && editedIssue.labels.length > 0)) && (
            <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Labels</label>
                <div className="flex flex-wrap gap-2">
                    {(editedIssue.labels).map((label) => (
                    <span 
                        key={label}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600"
                    >
                        {label}
                        {isEditing && (
                            <button onClick={() => removeLabel(label)} className="ml-1.5 hover:text-red-500">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </span>
                    ))}
                    {isEditing && (
                        <input
                            type="text"
                            placeholder="+ Add label"
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-transparent border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 focus:outline-none focus:border-blue-500 focus:text-zinc-900 dark:focus:text-zinc-100 w-24 focus:w-auto transition-all"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const value = e.currentTarget.value.trim();
                                    if (value) {
                                        addLabel(value);
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                const value = e.currentTarget.value.trim();
                                if (value) {
                                    addLabel(value);
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Footer / Actions for Draft */}
      {status === 'draft' && !isReadOnly && (
        <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-700 flex justify-end gap-3 transition-all duration-200">
          {isEditing ? (
            <>
              <button 
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
              >
                Edit Ticket
              </button>
              <button 
                onClick={handleCreate}
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg hover:opacity-90 shadow-sm transition-all ${isSubmitting ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isSubmitting ? (
                    <>Creating...</>
                ) : (
                    <>Create Ticket</>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>

    {/* Project Selector Modal */}
    <ProjectSelectorModal
      open={showProjectSelector}
      onClose={() => setShowProjectSelector(false)}
      isCreating={isSubmitting}
      onCreateTicket={async (projectPath, projectName, milestoneId) => {
        setSelectedProjectName(projectName);
        await createTicketWithProject(projectPath, milestoneId);
      }}
    />
  </>
  );
}
