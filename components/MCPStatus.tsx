'use client';

import { useTheme } from 'next-themes';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

// GitLab icon component
function GitlabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2 .43.43 0 0 1 19.18 2a.42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
    </svg>
  );
}

interface MCPStatusProps {
  connected: boolean;
  loading?: boolean;
  username?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function MCPStatus({ connected, loading, username, onConnect, onDisconnect }: MCPStatusProps) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== 'light';

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
        <span className="text-sm text-zinc-500">Connecting...</span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <div className="flex items-center gap-2">
          <GitlabIcon className="w-4 h-4 text-orange-500" />
          <CheckCircle className="w-3 h-3 text-green-500" />
        </div>
        <div className="flex-1">
          <span className={`text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>GitLab Connected</span>
          {username && (
            <span className="text-xs text-zinc-500 ml-2">@{username}</span>
          )}
        </div>
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className={`text-xs transition-colors ${
              isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Disconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    }`}>
      <div className="flex items-center gap-2">
        <GitlabIcon className="w-4 h-4 text-zinc-400" />
        <XCircle className="w-3 h-3 text-zinc-400" />
      </div>
      <span className="flex-1 text-sm text-zinc-500">GitLab Not Connected</span>
      {onConnect && (
        <button
          onClick={onConnect}
          className="px-3 py-1 text-xs font-medium text-white bg-orange-500 hover:bg-orange-400 rounded-md transition-colors"
        >
          Connect
        </button>
      )}
    </div>
  );
}

// Compact version for sidebar or header
export function MCPStatusBadge({ connected, onClick }: { connected: boolean; onClick?: () => void }) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
        connected
          ? isDark 
            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            : 'bg-green-100 text-green-600 hover:bg-green-200'
          : isDark
            ? 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
      }`}
      title={connected ? 'GitLab connected' : 'GitLab not connected'}
    >
      <GitlabIcon className="w-3 h-3" />
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
    </button>
  );
}
