'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';

interface MessageActionsProps {
  messageId: string;
  chatId: string;
  content: string;
}

export function MessageActions({ messageId, chatId, content }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleFeedback(type: 'positive' | 'negative') {
    if (feedback || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, chatId, type }),
      });

      if (res.ok) {
        setFeedback(type);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
        title="Copy"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      <button
        onClick={() => handleFeedback('positive')}
        disabled={!!feedback || isSubmitting}
        className={`p-1.5 rounded transition-colors ${
          feedback === 'positive'
            ? 'text-green-400 bg-green-400/10'
            : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
        } disabled:opacity-50`}
        title="Good response"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => handleFeedback('negative')}
        disabled={!!feedback || isSubmitting}
        className={`p-1.5 rounded transition-colors ${
          feedback === 'negative'
            ? 'text-red-400 bg-red-400/10'
            : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
        } disabled:opacity-50`}
        title="Bad response"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
