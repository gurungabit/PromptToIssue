'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { getEnabledModels } from '@/lib/ai/models/config';

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const models = getEnabledModels();
  const selectedModel = models.find((m) => m.id === value);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Default to dark theme during SSR
  const isDark = resolvedTheme !== 'light';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 ${
          isDark 
            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
            : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{selectedModel?.displayName || value}</span>
        <ChevronDown className={`w-3 h-3 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute bottom-full mb-2 left-0 w-64 py-1 border rounded-lg shadow-xl z-50 ${
          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
        }`}>
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                model.id === value 
                  ? isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  : isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {model.displayName}
                </div>
                {model.description && (
                  <div className="text-xs text-zinc-500 truncate">{model.description}</div>
                )}
              </div>
              {model.id === value && (
                <Check className={`w-4 h-4 shrink-0 ${isDark ? 'text-white' : 'text-zinc-900'}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
