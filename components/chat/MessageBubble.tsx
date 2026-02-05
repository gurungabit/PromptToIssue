'use client';

import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState, memo, useMemo } from 'react';
import { ArtifactRenderer } from './ArtifactRenderer';
import { ToolCallsDisplay } from './ToolCall';
import { ToolInvocation } from './types';

interface MessageBubbleProps {
  id?: string;
  chatId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocation[];
  isStreaming?: boolean;
  onTicketCreated?: (ticketUrl: string, ticketTitle: string) => void;
  onBulkTicketsCreated?: (results: { ticket: string; webUrl?: string }[]) => void;
}

// Part type for tool invocations in AI SDK v6
interface ToolPart {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-streaming' | 'output-available';
  input?: Record<string, unknown>;
  output?: unknown;
}

// Helper to extract tool invocations from message parts
function getToolInvocationsFromParts(parts?: unknown[]): ToolInvocation[] {
  if (!parts || !Array.isArray(parts)) return [];
  const toolInvocations: ToolInvocation[] = [];

  for (const part of parts) {
    if (
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      typeof (part as { type: string }).type === 'string' &&
      (part as { type: string }).type.startsWith('tool-') &&
      'toolCallId' in part
    ) {
      const tp = part as ToolPart;
      const toolName = tp.type.replace(/^tool-/, ''); // Extract tool name from "tool-list_projects" -> "list_projects"

      // Map AI SDK state to our ToolInvocation state
      let state: 'call' | 'partial-call' | 'result' = 'call';
      if (tp.state === 'output-available' || tp.state === 'output-streaming') {
        state = 'result';
      } else if (tp.state === 'input-streaming') {
        state = 'partial-call';
      }

      toolInvocations.push({
        toolCallId: tp.toolCallId,
        toolName: toolName,
        args: tp.input || {},
        state: state,
        result: tp.output,
      });
    }
  }

  return toolInvocations;
}

// Memoize to prevent unnecessary re-renders during streaming
export const MessageBubble = memo(function MessageBubble({
  id,
  chatId,
  role,
  content,
  toolInvocations,
  parts,
  isStreaming = false,
  isReadOnly = false,
  onTicketCreated,
  onBulkTicketsCreated,
}: MessageBubbleProps & { isReadOnly?: boolean; parts?: unknown[] }) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  // Memoize tool parsing to prevent re-renders when other props (like streaming content) change
  // IF the parts array is referentially stable (which it is for history)
  // For streaming, useMemo will re-run but that's fine for the active message.
  // Crucially, for historical messages, 'parts' and 'toolInvocations' props will be stable, so 'displayTools' will be stable.
  const displayTools = useMemo(() => {
    if (toolInvocations && toolInvocations.length > 0) return toolInvocations;
    return getToolInvocationsFromParts(parts);
  }, [toolInvocations, parts]);

  // Check if content looks like a JSON error - simpler detection
  const looksLikeJsonError =
    content.includes('invalid_union') ||
    content.includes('invalid_type') ||
    content.includes('Invalid input') ||
    (content.includes('"code"') &&
      content.includes('"message"') &&
      content.trim().charAt(0) === '[');

  return (
    <div className={`group flex px-4 py-4 ${isUser ? 'justify-end' : ''}`}>
      <div className={`max-w-[80%]`}>
        {isUser ? (
          <div>
            <div className="px-4 py-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-2xl rounded-br-md text-zinc-900 dark:text-white text-[15px]">
              {content}
            </div>
            {/* Copy button under user message */}
            <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton content={content} />
            </div>
          </div>
        ) : looksLikeJsonError ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl max-w-md">
            <p className="text-red-400 font-medium mb-2">⚠️ Error from AI Model</p>
            <p className="text-red-400/80 text-sm mb-3">
              The model returned an invalid response. This can happen with free models.
            </p>
            <p className="text-red-400/60 text-xs">
              Try switching to a different model like Gemini.
            </p>
          </div>
        ) : (
          <div className="text-zinc-800 dark:text-zinc-200 text-[15px] leading-relaxed">
            {displayTools && displayTools.length > 0 && (
              <div className="mb-4">
                <ToolCallsDisplay
                  toolCalls={displayTools.map((inv: ToolInvocation) => ({
                    name: inv.toolName,
                    args: inv.args,
                    result: 'result' in inv ? inv.result : undefined,
                    status:
                      inv.state === 'result' ? 'success' : isStreaming ? 'pending' : 'incomplete',
                    error: undefined, // 'error' in inv ? inv.error : undefined (ToolInvocation type varies)
                  }))}
                />
              </div>
            )}
            <ArtifactRenderer
              content={content}
              chatId={chatId}
              messageId={id}
              isReadOnly={isReadOnly}
              onTicketCreated={onTicketCreated}
              onBulkTicketsCreated={onBulkTicketsCreated}
            />
            {isStreaming && <TypingIndicator />}
            {/* Action buttons for assistant messages */}
            {isAssistant && !isStreaming && content && (
              <MessageActions messageId={id || ''} chatId={chatId || ''} content={content} />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Simple copy button component
function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// Message action buttons for assistant
function MessageActions({
  messageId,
  chatId,
  content,
}: {
  messageId: string;
  chatId: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleFeedback(type: 'positive' | 'negative') {
    if (isSubmitting) return;

    const newFeedback = feedback === type ? null : type;

    setIsSubmitting(true);
    try {
      if (newFeedback && messageId && chatId) {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, chatId, type: newFeedback }),
        });
      }
      setFeedback(newFeedback);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
        title="Copy"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      <button
        onClick={() => handleFeedback('positive')}
        disabled={isSubmitting}
        className={`p-1.5 rounded transition-colors ${
          feedback === 'positive'
            ? 'text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-400/10'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
        } disabled:opacity-50`}
        title="Good response"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => handleFeedback('negative')}
        disabled={isSubmitting}
        className={`p-1.5 rounded transition-colors ${
          feedback === 'negative'
            ? 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-400/10'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
        } disabled:opacity-50`}
        title="Bad response"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex px-4 py-4">
      <div className="flex items-center gap-1 px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}
