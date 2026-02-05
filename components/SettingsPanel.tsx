'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { X, GitBranch, Moon, Sun, Monitor } from 'lucide-react';
import { MCPStatus } from './MCPStatus';
import { getEnabledModels } from '@/lib/ai/models/config';
import { useChatContext } from '@/contexts/ChatContext';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface UserSettings {
  defaultModel: string;
  gitlabConnected: boolean;
  gitlabUsername?: string;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { mcpEnabled, setMcpEnabled } = useChatContext();
  const [settings, setSettings] = useState<UserSettings>({
    defaultModel: 'qwen3-8b',
    gitlabConnected: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      async function loadSettings() {
        setLoading(true);
        try {
          const savedModel = localStorage.getItem('defaultModel');
          // mcpEnabled is loaded by ChatContext

          const response = await fetch('/api/user/settings');
          const userSettings = response.ok ? await response.json() : null;

          setSettings({
            defaultModel: savedModel || 'qwen3-8b',
            gitlabConnected: !!userSettings?.gitlabUsername,
            gitlabUsername: userSettings?.gitlabUsername,
          });
        } catch {
          // Use defaults
        } finally {
          setLoading(false);
        }
      }
      loadSettings();
    }
  }, [open, mcpEnabled]);

  function handleModelChange(model: string) {
    setSettings((s) => ({ ...s, defaultModel: model }));
    localStorage.setItem('defaultModel', model);
  }

  function handleMCPToggle() {
    setMcpEnabled(!mcpEnabled);
  }

  function handleGitLabConnect() {
    window.location.href = '/api/gitlab';
  }

  async function handleGitLabDisconnect() {
    try {
      await fetch('/api/gitlab/disconnect', { method: 'POST' });
      setSettings((s) => ({ ...s, gitlabConnected: false, gitlabUsername: undefined }));
    } catch (error) {
      console.error('Failed to disconnect GitLab:', error);
    }
  }

  if (!open) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l shadow-2xl ${
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
        }`}
      >
        {/* Header */}
        <div
          className={`h-14 flex items-center justify-between px-6 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-200'
          }`}
        >
          <h2 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className={`p-6 space-y-8 overflow-y-auto h-[calc(100vh-56px)] ${
            isDark ? 'bg-zinc-950' : 'bg-zinc-50'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className={`w-6 h-6 border-2 rounded-full animate-spin ${
                  isDark ? 'border-zinc-600 border-t-white' : 'border-zinc-300 border-t-zinc-900'
                }`}
              />
            </div>
          ) : (
            <>
              {/* Theme Section */}
              <div>
                <h3
                  className={`text-sm font-medium mb-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  Theme
                </h3>
                {mounted && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                        theme === 'light'
                          ? isDark
                            ? 'border-white bg-white/10 text-white'
                            : 'border-zinc-900 bg-zinc-100 text-zinc-900'
                          : isDark
                            ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white'
                            : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      Light
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                        theme === 'dark'
                          ? isDark
                            ? 'border-white bg-white/10 text-white'
                            : 'border-zinc-900 bg-zinc-100 text-zinc-900'
                          : isDark
                            ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white'
                            : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                        theme === 'system'
                          ? isDark
                            ? 'border-white bg-white/10 text-white'
                            : 'border-zinc-900 bg-zinc-100 text-zinc-900'
                          : isDark
                            ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white'
                            : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      System
                    </button>
                  </div>
                )}
              </div>

              {/* GitLab Integration */}
              <div>
                <h3
                  className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  <GitBranch className="w-4 h-4 text-orange-500" />
                  GitLab Integration
                </h3>
                <MCPStatus
                  connected={settings.gitlabConnected}
                  username={settings.gitlabUsername}
                  onConnect={handleGitLabConnect}
                  onDisconnect={handleGitLabDisconnect}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Connect GitLab to create issues, search projects, and manage your work directly
                  from chat.
                </p>

                {/* MCP Toggle */}
                <div
                  className={`mt-4 flex items-center justify-between py-3 px-4 rounded-lg border ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                  }`}
                >
                  <div>
                    <span className={`text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      Enable MCP Tools
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">Allow AI to use GitLab tools</p>
                  </div>
                  <button
                    onClick={handleMCPToggle}
                    disabled={!settings.gitlabConnected}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      mcpEnabled && settings.gitlabConnected
                        ? 'bg-orange-500'
                        : isDark
                          ? 'bg-zinc-700'
                          : 'bg-zinc-300'
                    } ${!settings.gitlabConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        mcpEnabled && settings.gitlabConnected ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Default Model */}
              <div>
                <h3
                  className={`text-sm font-medium mb-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  Default Model
                </h3>
                <select
                  value={settings.defaultModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className={`w-full py-3 px-4 rounded-lg border focus:outline-none focus:ring-1 ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-700 text-white focus:ring-zinc-600'
                      : 'bg-white border-zinc-200 text-zinc-900 focus:ring-zinc-400'
                  }`}
                >
                  {getEnabledModels().map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-zinc-500">
                  This model will be used for new conversations
                </p>
              </div>

              {/* About */}
              <div className={`pt-8 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <h3
                  className={`text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  About
                </h3>
                <p className="text-sm text-zinc-500">
                  PromptToIssue - AI-powered chat with GitLab integration
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Version 1.0.0
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
