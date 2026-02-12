'use client';

import {
  Wrench,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Microscope,
} from 'lucide-react';
import { useState, memo } from 'react';

interface ResearchStep {
  toolName: string;
  status: 'running' | 'completed' | 'error';
}

interface ToolCallProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error' | 'incomplete';
  error?: string;
  researchSteps?: ResearchStep[];
}

// Display nested research sub-agent steps
function ResearchStepsDisplay({ steps }: { steps: ResearchStep[] }) {
  // Deduplicate: keep only the latest status per toolName
  const uniqueSteps = steps.reduce<ResearchStep[]>((acc, step) => {
    const idx = acc.findIndex((s) => s.toolName === step.toolName);
    if (idx >= 0) {
      acc[idx] = step;
    } else {
      acc.push(step);
    }
    return acc;
  }, []);

  return (
    <div className="mt-2 space-y-1">
      <span className="text-xs uppercase tracking-wide flex items-center gap-1 text-zinc-500 dark:text-zinc-500">
        <Microscope className="w-3 h-3" />
        Sub-agent Steps
      </span>
      <div className="space-y-0.5">
        {uniqueSteps.map((step, index) => {
          const displayName = step.toolName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <div
              key={`${step.toolName}-${index}`}
              className="flex items-center gap-2 py-1 px-2 rounded text-xs bg-zinc-50 dark:bg-zinc-800/30"
            >
              {step.status === 'running' ? (
                <Loader2 className="w-3 h-3 text-blue-500 dark:text-blue-400 animate-spin shrink-0" />
              ) : step.status === 'completed' ? (
                <CheckCircle className="w-3 h-3 text-green-500 dark:text-green-400 shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500 dark:text-red-400 shrink-0" />
              )}
              <span className="text-zinc-600 dark:text-zinc-400">{displayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Display a single tool call with expandable details
export const ToolCall = memo(function ToolCall({
  toolName,
  args,
  result,
  status,
  error,
  researchSteps,
}: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
    incomplete: <HelpCircle className="w-4 h-4 text-zinc-500" />,
  }[status];

  const toolDisplayName = toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Show research steps inline when the tool is pending (streaming) or when expanded
  const hasResearchSteps = researchSteps && researchSteps.length > 0;

  return (
    <div className="my-2 rounded-lg border overflow-hidden border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 transition-colors text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      >
        <Wrench className="w-4 h-4 text-zinc-500" />
        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {toolDisplayName}
        </span>
        {statusIcon}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {/* Research steps shown inline when pending (streaming in real-time) */}
      {hasResearchSteps && status === 'pending' && !expanded && (
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
          <ResearchStepsDisplay steps={researchSteps} />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 py-2 border-t space-y-2 border-zinc-200 dark:border-zinc-800">
          {/* Research steps when expanded */}
          {hasResearchSteps && <ResearchStepsDisplay steps={researchSteps} />}

          {/* Arguments */}
          <div>
            <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Arguments
            </span>
            <pre className="mt-1 text-xs rounded p-2 overflow-x-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              {typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)}
            </pre>
          </div>

          {/* Result or Error */}
          {status === 'success' && (
            <div>
              <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Result
              </span>
              <pre className="mt-1 text-xs rounded p-2 overflow-x-auto max-h-48 overflow-y-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                {result !== undefined ? (
                  JSON.stringify(result as object, null, 2)
                ) : (
                  <span className="italic text-zinc-400 dark:text-zinc-600">No output</span>
                )}
              </pre>
            </div>
          )}

          {status === 'error' && error && (
            <div>
              <span className="text-xs uppercase tracking-wide text-red-600 dark:text-red-400">
                Error
              </span>
              <pre className="mt-1 text-xs rounded p-2 overflow-x-auto bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400/80">
                {error}
              </pre>
            </div>
          )}

          {status === 'incomplete' && (
            <div>
              <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Status
              </span>
              <div className="mt-1 text-xs rounded p-2 bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                Tool call incomplete (no result captured)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Display multiple tool calls in a message
interface ToolCallsDisplayProps {
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    status: 'pending' | 'success' | 'error' | 'incomplete';
    error?: string;
    researchSteps?: ResearchStep[];
  }>;
}

export function ToolCallsDisplay({ toolCalls }: ToolCallsDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="my-3">
      <span className="text-xs flex items-center gap-1 mb-2 text-zinc-500 dark:text-zinc-500">
        <Wrench className="w-3 h-3" />
        Tool Usage
      </span>
      {toolCalls.map((call, index) => (
        <ToolCall
          key={index}
          toolName={call.name}
          args={call.args}
          result={call.result}
          status={call.status}
          error={call.error}
          researchSteps={call.researchSteps}
        />
      ))}
    </div>
  );
}

