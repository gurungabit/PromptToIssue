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
    pending: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    completed: <CheckCircle className="h-4 w-4 text-success" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
  }[tool.status];

  return (
    <div
      className="
        border border-border rounded-[var(--radius)]
        bg-surface
        overflow-hidden
      "
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="
          w-full px-3 py-2
          flex items-center gap-2
          hover:bg-surface-hover
          transition-colors
          text-left
        "
      >
        {statusIcon}
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-sm font-medium flex-1">
          {tool.toolName}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Arguments */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              Arguments
            </h4>
            <pre className="text-xs bg-surface-hover rounded-[var(--radius-sm)] p-2 overflow-x-auto">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {tool.status === 'completed' && tool.result !== undefined && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                Result
              </h4>
              <pre className="text-xs bg-surface-hover rounded-[var(--radius-sm)] p-2 overflow-x-auto max-h-40">
                {typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {tool.status === 'error' && tool.error && (
            <div>
              <h4 className="text-xs font-medium text-destructive mb-1">
                Error
              </h4>
              <pre className="text-xs bg-destructive/10 text-destructive rounded-[var(--radius-sm)] p-2">
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
    pending: 'bg-muted-foreground/20 text-muted-foreground',
    running: 'bg-primary/20 text-primary',
    completed: 'bg-success/20 text-success',
    error: 'bg-destructive/20 text-destructive',
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
