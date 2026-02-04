'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface ChatContextValue {
  // Current chat state
  currentChatId: string | undefined;
  setCurrentChatId: (id: string | undefined) => void;

  // Callbacks for sidebar
  onChatCreated: () => void;
  registerChatCreatedCallback: (callback: () => void) => void;

  // Reset for new chat
  resetChat: () => void;
  onResetChat: () => void;
  registerResetCallback: (callback: () => void) => void;

  // Tool settings
  mcpEnabled: boolean;
  setMcpEnabled: (enabled: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();
  const [chatCreatedCallback, setChatCreatedCallback] = useState<(() => void) | null>(null);
  const [resetCallback, setResetCallback] = useState<(() => void) | null>(null);

  // Initialize from localStorage if available, default to true
  const [mcpEnabled, setMcpEnabledState] = useState(true);

  // Load initial state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mcpEnabled');
      if (saved !== null) {
        setMcpEnabledState(saved === 'true');
      }
    }
  }, []);

  const setMcpEnabled = useCallback((enabled: boolean) => {
    setMcpEnabledState(enabled);
    localStorage.setItem('mcpEnabled', String(enabled));
  }, []);

  const registerChatCreatedCallback = useCallback((callback: () => void) => {
    setChatCreatedCallback(() => callback);
  }, []);

  const onChatCreated = useCallback(() => {
    chatCreatedCallback?.();
  }, [chatCreatedCallback]);

  const registerResetCallback = useCallback((callback: () => void) => {
    setResetCallback(() => callback);
  }, []);

  const onResetChat = useCallback(() => {
    resetCallback?.();
  }, [resetCallback]);

  const resetChat = useCallback(() => {
    setCurrentChatId(undefined);
    onResetChat();
  }, [onResetChat]);

  return (
    <ChatContext.Provider
      value={{
        currentChatId,
        setCurrentChatId,
        onChatCreated,
        registerChatCreatedCallback,
        resetChat,
        onResetChat,
        registerResetCallback,
        mcpEnabled,
        setMcpEnabled,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
