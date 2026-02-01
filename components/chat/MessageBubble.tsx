'use client';

import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState, memo } from 'react';
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

// Memoize to prevent unnecessary re-renders during streaming
export const MessageBubble = memo(function MessageBubble({ 
  id,
  chatId,
  role, 
  content, 
  toolInvocations,
  isStreaming = false,
  onTicketCreated,
  onBulkTicketsCreated
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  // Check if content looks like a JSON error - simpler detection
  const looksLikeJsonError = content.includes('invalid_union') || 
    content.includes('invalid_type') ||
    content.includes('Invalid input') ||
    (content.includes('"code"') && content.includes('"message"') && content.trim().charAt(0) === '[');

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
            <p className="text-red-400/80 text-sm mb-3">The model returned an invalid response. This can happen with free models.</p>
            <p className="text-red-400/60 text-xs">Try switching to a different model like Gemini.</p>
          </div>
        ) : (
          <div className="text-zinc-800 dark:text-zinc-200 text-[15px] leading-relaxed">
            {toolInvocations && toolInvocations.length > 0 && (
              <div className="mb-4">
                <ToolCallsDisplay toolCalls={toolInvocations.map(inv => ({
                  name: inv.toolName,
                  args: inv.args,
                  result: 'result' in inv ? inv.result : undefined,
                  status: 'result' in inv ? 'success' : 'pending',
                  error: undefined // 'error' in inv ? inv.error : undefined (ToolInvocation type varies)
                }))} />
              </div>
            )}
            <ArtifactRenderer content={content} onTicketCreated={onTicketCreated} onBulkTicketsCreated={onBulkTicketsCreated} />
            {isStreaming && (
              <span className="inline-flex ml-1 items-center gap-0.5 relative top-0.5" aria-label="Typing">
                <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse" />
                <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse [animation-delay:300ms]" />
              </span>
            )}
            {/* Action buttons for assistant messages */}
            {isAssistant && !isStreaming && content && (
              <MessageActions 
                messageId={id || ''} 
                chatId={chatId || ''} 
                content={content} 
              />
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
      {copied ? <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Message action buttons for assistant
function MessageActions({ messageId, chatId, content }: { messageId: string; chatId: string; content: string }) {
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
        {copied ? <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
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
