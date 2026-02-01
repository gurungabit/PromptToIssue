'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MessageSquare, Plus } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  chats: Array<{ id: string; title: string }>;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

export function CommandPalette({
  open,
  onClose,
  chats,
  onSelectChat,
  onNewChat,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Reset query when closed
  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleClose]);

  if (!open) return null;

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Command palette */}
      <div className="fixed left-1/2 top-1/4 -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <Search className="w-5 h-5 text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search chats or type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              onClick={handleClose}
              className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto py-2">
            {/* New Chat action */}
            <button
              onClick={() => {
                onNewChat();
                handleClose();
              }}
              className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-zinc-800 transition-colors"
            >
              <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">New Chat</div>
                <div className="text-xs text-zinc-500">Start a new conversation</div>
              </div>
            </button>

            {/* Divider */}
            {filteredChats.length > 0 && (
              <div className="my-2 mx-4 border-t border-zinc-800" />
            )}

            {/* Chat list */}
            {filteredChats.length > 0 ? (
              <>
                <div className="px-4 py-1 text-xs text-zinc-500 uppercase tracking-wider">
                  Recent Chats
                </div>
                {filteredChats.slice(0, 10).map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => {
                      onSelectChat(chat.id);
                      handleClose();
                    }}
                    className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-zinc-800 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="text-sm text-white truncate">{chat.title}</span>
                  </button>
                ))}
              </>
            ) : query ? (
              <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                No results found for &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-500">
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</kbd> to select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
