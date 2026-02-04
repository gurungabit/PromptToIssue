'use client';

import { Loader2, Wrench, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

interface ToolDisplayProps {
  toolCalls: ToolCall[];
}

export function ToolDisplay({ toolCalls }: ToolDisplayProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-2 my-3">
      {toolCalls.map((tool) => (
        <ToolCallItem key={tool.toolCallId} tool={tool} />
      ))}
    </div>
  );
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 className="h-4 w-4 animate-spin text-zinc-500 dark:text-zinc-400" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />,
    completed: <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" />,
  }[tool.status];

  return (
    <div
      className="
        border rounded-lg overflow-hidden
        border-zinc-300 bg-white
        dark:border-zinc-700 dark:bg-zinc-800
      "
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="
          w-full px-3 py-2
          flex items-center gap-2
          transition-colors
          text-left
          hover:bg-zinc-100 dark:hover:bg-zinc-700
        "
      >
        {statusIcon}
        <Wrench className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <span className="font-mono text-sm font-medium flex-1 text-zinc-800 dark:text-zinc-100">
          {tool.toolName}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 p-3 space-y-3">
          {/* Arguments */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">
              Arguments
            </h4>
            <pre className="text-xs rounded p-2 overflow-x-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {tool.status === 'completed' && tool.result !== undefined && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">
                Result
              </h4>
              <pre className="text-xs rounded p-2 overflow-x-auto max-h-40 bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {tool.status === 'error' && tool.error && (
            <div>
              <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-1 uppercase tracking-wide">
                Error
              </h4>
              <pre className="text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded p-2">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for inline display
export function ToolCallBadge({
  name,
  status,
}: {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}) {
  const statusColor = {
    pending: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400',
    running: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    completed: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    error: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  }[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2 py-0.5
        rounded-full
        text-xs font-medium
        ${statusColor}
      `}
    >
      {status === 'running' || status === 'pending' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Wrench className="h-3 w-3" />
      )}
      {name}
    </span>
  );
}
