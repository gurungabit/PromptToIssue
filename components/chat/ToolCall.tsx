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
    pending: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    incomplete: <HelpCircle className="w-4 h-4 text-zinc-500" />,
  }[status];

  const toolDisplayName = toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="my-2 rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <Wrench className="w-4 h-4 text-zinc-500" />
        <span className="flex-1 text-sm text-zinc-300 font-medium">{toolDisplayName}</span>
        {statusIcon}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 py-2 border-t border-zinc-800 space-y-2">
          {/* Arguments */}
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Arguments</span>
            <pre className="mt-1 text-xs text-zinc-400 bg-zinc-800/50 rounded p-2 overflow-x-auto">
              {typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)}
            </pre>
          </div>

          {/* Result or Error */}
          {status === 'success' && (
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Result</span>
              <pre className="mt-1 text-xs text-zinc-400 bg-zinc-800/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {result !== undefined ? JSON.stringify(result as object, null, 2) : <span className="italic text-zinc-600">No output</span>}
              </pre>
            </div>
          )}

          {status === 'error' && error && (
            <div>
              <span className="text-xs text-red-400 uppercase tracking-wide">Error</span>
              <pre className="mt-1 text-xs text-red-400/80 bg-red-500/10 rounded p-2 overflow-x-auto">
                {error}
              </pre>
            </div>
          )}

          {status === 'incomplete' && (
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Status</span>
              <div className="mt-1 text-xs text-zinc-400 bg-zinc-800/50 rounded p-2">
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
      <span className="text-xs text-zinc-500 flex items-center gap-1 mb-2">
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
