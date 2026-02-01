'use client';

import { useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import { getEnabledModels } from '@/lib/ai/models/config';

interface ModelPickerProps {
  currentModel: string;
  onSelect: (id: string, name: string) => void;
  onClose: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  google: 'bg-blue-600',
  openai: 'bg-emerald-600',
  anthropic: 'bg-orange-600',
};

export function ModelPicker({ currentModel, onSelect, onClose }: ModelPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const models = getEnabledModels();

  const filteredModels = models.filter(
    (model) =>
      model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="font-semibold text-lg text-white">Select Model</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 pl-10 pr-4 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Model Grid */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {filteredModels.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No models found</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredModels.map((model) => {
                const isSelected = model.id === currentModel;
                const providerColor = PROVIDER_COLORS[model.provider] || 'bg-zinc-600';

                return (
                  <button
                    key={model.id}
                    onClick={() => onSelect(model.id, model.displayName)}
                    className={`relative p-4 bg-zinc-950 border rounded-xl text-left transition-all hover:border-zinc-500 ${
                      isSelected ? 'border-white ring-1 ring-white' : 'border-zinc-700'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-zinc-900" />
                        </div>
                      </div>
                    )}

                    <div className={`w-10 h-10 ${providerColor} rounded-lg flex items-center justify-center text-white font-bold text-lg mb-3`}>
                      {model.provider === 'google' ? '✦' : model.provider[0].toUpperCase()}
                    </div>

                    <div className="font-medium text-white mb-0.5">{model.displayName}</div>
                    {model.description && (
                      <div className="text-xs text-zinc-500 line-clamp-2">{model.description}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {models.length} model{models.length !== 1 ? 's' : ''} available
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
