'use client';

import { Wrench, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useState, memo } from 'react';

interface ToolCallProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error' | 'incomplete';
  error?: string;
}

// Display a single tool call with expandable details
export const ToolCall = memo(function ToolCall({ toolName, args, result, status, error }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
    incomplete: <HelpCircle className="w-4 h-4 text-zinc-500" />,
  }[status];

  const toolDisplayName = toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="my-2 rounded-lg border overflow-hidden border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 transition-colors text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      >
        <Wrench className="w-4 h-4 text-zinc-500" />
        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{toolDisplayName}</span>
        {statusIcon}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 py-2 border-t space-y-2 border-zinc-200 dark:border-zinc-800">
          {/* Arguments */}
          <div>
            <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Arguments</span>
            <pre className="mt-1 text-xs rounded p-2 overflow-x-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              {typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)}
            </pre>
          </div>

          {/* Result or Error */}
          {status === 'success' && (
            <div>
              <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Result</span>
              <pre className="mt-1 text-xs rounded p-2 overflow-x-auto max-h-48 overflow-y-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                {result !== undefined ? JSON.stringify(result as object, null, 2) : <span className="italic text-zinc-400 dark:text-zinc-600">No output</span>}
              </pre>
            </div>
          )}

          {status === 'error' && error && (
            <div>
              <span className="text-xs uppercase tracking-wide text-red-600 dark:text-red-400">Error</span>
              <pre className="mt-1 text-xs rounded p-2 overflow-x-auto bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400/80">
                {error}
              </pre>
            </div>
          )}

          {status === 'incomplete' && (
            <div>
              <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Status</span>
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
        />
      ))}
    </div>
  );
}
