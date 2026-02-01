'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { useTheme } from 'next-themes';
import { Send } from 'lucide-react';
import { ModelSelector } from './ModelSelector';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  modelId: string;
  onModelChange: (id: string) => void;
}

export const ChatInput = memo(function ChatInput({
  onSend,
  disabled = false,
  modelId,
  onModelChange,
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
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className={`relative rounded-2xl transition-all ${
        isDark 
          ? 'bg-zinc-900 border border-zinc-700 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600' 
          : 'bg-white border border-zinc-300 shadow-sm focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400'
      }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
          disabled={disabled}
          rows={1}
          className={`w-full bg-transparent px-4 pt-4 pb-14 resize-none focus:outline-none disabled:opacity-50 min-h-[60px] max-h-[180px] ${
            isDark 
              ? 'text-white placeholder:text-zinc-500' 
              : 'text-zinc-900 placeholder:text-zinc-400'
          }`}
        />

        <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-t rounded-b-2xl ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
        }`}>
          <div className="flex items-center gap-1">
            <ModelSelector
              value={modelId}
              onChange={onModelChange}
              disabled={disabled}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={`w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              isDark 
                ? 'bg-white text-zinc-900 hover:bg-zinc-200' 
                : 'bg-zinc-900 text-white hover:bg-zinc-700'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
