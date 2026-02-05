'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { useTheme } from 'next-themes';
import { Send, Square } from 'lucide-react';
import { ModelSelector } from './ModelSelector';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  modelId: string;
  onModelChange: (id: string) => void;
  centered?: boolean;
  onStop?: () => void;
  isLoading?: boolean;
}

export const ChatInput = memo(function ChatInput({
  onSend,
  disabled = false,
  modelId,
  onModelChange,
  centered = false,
  onStop,
  isLoading = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    }
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Default to dark theme during SSR
  const isDark = resolvedTheme !== 'light';

  return (
    <div
      className={`w-full mx-auto transition-all duration-300 ${centered ? 'max-w-2xl px-4' : 'max-w-3xl px-4 pb-4'}`}
    >
      <div className="relative transition-all duration-300">
        <div
          className={`rounded-3xl border transition-colors ${
            centered ? 'shadow-lg' : 'shadow-sm'
          } ${
            isDark
              ? 'bg-zinc-900/50 backdrop-blur-xl border-zinc-700/50 focus-within:border-zinc-500/50 focus-within:ring-1 focus-within:ring-zinc-500/20'
              : 'bg-white/80 backdrop-blur-xl border-zinc-200 focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-200'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={centered ? 'What can I help you build today?' : 'Type your message...'}
            disabled={disabled && !isLoading} // Allow typing if loading only if we want to queue, but typically we disable input. Let's keep input disabled if desired, but button active. Actually user usually wants to stop.
            // Requirement said "cancel/stop/abort chat from ui".
            // If isLoading is true, we should probably allow clicking the stop button.
            // But 'disabled' prop passed from parent (isLoading) disables everything.
            // We'll need to handle 'disabled' carefully in the parent or here.
            // For now, let's assume 'disabled' disables INPUT, but we want button enabled if it's a stop button.
            rows={1}
            className={`w-full bg-transparent px-6 py-4 resize-none focus:outline-none disabled:opacity-50 min-h-[60px] max-h-[180px] ${
              isDark
                ? 'text-white placeholder:text-zinc-500'
                : 'text-zinc-900 placeholder:text-zinc-400'
            } ${centered ? 'text-lg' : 'text-base'}`}
          />

          <div className={`flex items-center justify-between px-4 pb-3 rounded-b-3xl`}>
            <div className="flex items-center gap-2">
              <ModelSelector
                value={modelId}
                onChange={onModelChange}
                disabled={disabled}
                openUpwards={!centered}
              />
            </div>

            {isLoading && onStop ? (
              <button
                onClick={onStop}
                className={`p-2 rounded-xl transition-all ${
                  isDark
                    ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-500 hover:text-red-500 hover:bg-zinc-200'
                }`}
                title="Stop generating"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className={`p-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                  value.trim()
                    ? isDark
                      ? 'bg-white text-zinc-900 hover:bg-zinc-200 scale-100' // Active state dark mode
                      : 'bg-zinc-900 text-white hover:bg-zinc-700 scale-100' // Active state light mode
                    : isDark
                      ? 'bg-zinc-800 text-zinc-500' // Inactive state dark mode
                      : 'bg-zinc-100 text-zinc-400' // Inactive state light mode
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
