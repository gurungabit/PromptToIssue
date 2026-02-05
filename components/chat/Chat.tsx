'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useChat, type UseChatOptions } from '@ai-sdk/react';
import { type UIMessage, DefaultChatTransport } from 'ai';
import { useTheme } from 'next-themes';
import { useChatContext } from '@/contexts/ChatContext';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { ChatInput } from './ChatInput';

import { SettingsPanel } from '../SettingsPanel';
import {
  Settings,
  X,
  AlertCircle,
  ChevronDown,
  Share2,
  Check,
  ListTodo,
  Search,
  Code,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { ToolInvocation } from './types';

interface ChatProps {
  chatId?: string;
  initialMessages?: UIMessage[];
}

const EXAMPLE_PROMPTS = [
  {
    icon: ListTodo,
    text: "Create issues to update 'nbus-aws' to use the latest node packages",
  },
  {
    icon: Search,
    text: "Analyze my GitLab repository 'nbus-aws' and explain its structure",
  },
  {
    icon: Code,
    text: 'Can you explain how binary search works with a Python example?',
  },
  {
    icon: BookOpen,
    text: 'How do I use the terraform-modules/terraform-aws-spa repository?',
  },
];

function ChatInner({
  chatId,
  initialMessages = [],
  transport,
}: ChatProps & { transport: DefaultChatTransport<UIMessage> }) {
  const [modelId, setModelId] = useState('qwen3-8b');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localMessages] = useState(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const prevMessageCountRef = useRef(0);
  const hasScrolledToNewMessageRef = useRef(true);

  // Use React Context for chat state management
  const { currentChatId, setCurrentChatId, registerResetCallback, mcpEnabled } = useChatContext();

  // Initialize currentChatId from prop
  useEffect(() => {
    if (chatId) {
      setCurrentChatId(chatId);
    }
  }, [chatId, setCurrentChatId]);

  // Use useChat with transport
  const { messages, status, error, sendMessage, setMessages, stop } = useChat({
    id: chatId || 'new-chat',
    messages: initialMessages,
    transport,
  } as UseChatOptions<UIMessage> & { transport?: DefaultChatTransport<UIMessage> });

  // Register reset callback with context
  useEffect(() => {
    registerResetCallback(() => {
      setMessages([]);
    });
  }, [registerResetCallback, setMessages]);

  // Check GitLab auth status on mount (triggers silent refresh if needed)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/gitlab/status');
        const data = await res.json();
        console.log('[Chat] GitLab Auth Status:', data);
      } catch (err) {
        console.error('[Chat] Failed to check auth status:', err);
      }
    };
    checkAuth();
  }, []);

  const isLoading = status === 'streaming' || status === 'submitted';
  const allMessages = messages.length > 0 ? messages : localMessages;
  const hasMessages = allMessages.length > 0;

  async function handleShare() {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentChatId }),
      });

      if (response.ok) {
        const data = await response.json();
        const url = `${window.location.origin}${data.shareUrl}`;
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to share chat:', error);
    } finally {
      setIsSharing(false);
    }
  }

  // Callback when a ticket is created from the widget
  const handleTicketCreated = useCallback(
    async (ticketUrl: string, ticketTitle: string) => {
      console.log('[Chat] handleTicketCreated called:', { ticketUrl, ticketTitle, currentChatId });

      // Create the message content
      const messageContent = `✅ **Ticket Created Successfully!**\n\n**${ticketTitle}**\n\n[View ticket on GitLab](${ticketUrl})`;

      // Build the new message with the structure expected by getMessageContent
      const createTicketMessage = (id: string) => ({
        id,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: messageContent }],
      });

      // Save to database if we have a chat ID
      if (currentChatId) {
        console.log('[Chat] Saving message to database for chat:', currentChatId);
        try {
          const response = await fetch(`/api/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              content: messageContent,
            }),
          });

          console.log('[Chat] API response status:', response.status);

          if (response.ok) {
            const savedMessage = await response.json();
            console.log('[Chat] Message saved, updating state with id:', savedMessage.id);
            setMessages((prev) => {
              if (prev.length === 0 && localMessages.length > 0) {
                return [...localMessages, createTicketMessage(savedMessage.id)] as typeof prev;
              }
              return [...prev, createTicketMessage(savedMessage.id)] as typeof prev;
            });
          } else {
            console.error('[Chat] API response not OK:', await response.text());
          }
        } catch (error) {
          console.error('[Chat] Failed to save ticket message:', error);
        }
      } else {
        // No chat ID yet, just update local state
        console.log('[Chat] No chat ID, updating local state only');
        setMessages((prev) => {
          if (prev.length === 0 && localMessages.length > 0) {
            return [
              ...localMessages,
              createTicketMessage(`ticket-created-${Date.now()}`),
            ] as typeof prev;
          }
          return [...prev, createTicketMessage(`ticket-created-${Date.now()}`)] as typeof prev;
        });
      }
    },
    [currentChatId, setMessages, localMessages],
  );

  // Callback when bulk tickets are created
  const handleBulkTicketsCreated = useCallback(
    async (results: { ticket: string; webUrl?: string }[]) => {
      console.log('[Chat] handleBulkTicketsCreated called with', results.length, 'results');
      const successfulTickets = results.filter((r) => r.webUrl);
      if (successfulTickets.length === 0) {
        console.log('[Chat] No successful tickets to report');
        return;
      }

      // Create message content with all ticket links
      const ticketLinks = successfulTickets.map((t) => `- [${t.ticket}](${t.webUrl})`).join('\n');
      const messageContent = `✅ **${successfulTickets.length} Ticket${successfulTickets.length > 1 ? 's' : ''} Created Successfully!**\n\n${ticketLinks}`;

      const createBulkMessage = (id: string) => ({
        id,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: messageContent }],
      });

      if (currentChatId) {
        console.log('[Chat] Saving bulk message to chat:', currentChatId);
        try {
          const response = await fetch(`/api/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              content: messageContent,
            }),
          });

          if (response.ok) {
            const savedMessage = await response.json();
            console.log('[Chat] Bulk message saved, updating state with ID:', savedMessage.id);
            // Use functional update to avoid stale closure
            setMessages((prev) => {
              if (prev.length === 0 && localMessages.length > 0) {
                console.log('[Chat] Merging local messages into empty useChat state');
                return [...localMessages, createBulkMessage(savedMessage.id)] as typeof prev;
              }
              return [...prev, createBulkMessage(savedMessage.id)] as typeof prev;
            });
          } else {
            console.error('[Chat] Failed to save bulk message:', await response.text());
          }
        } catch (error) {
          console.error('[Chat] Failed to save bulk ticket message:', error);
        }
      } else {
        console.log('[Chat] No chat ID, updating local state only');
        // Use functional update to avoid stale closure
        setMessages((prev) => {
          if (prev.length === 0 && localMessages.length > 0) {
            return [
              ...localMessages,
              createBulkMessage(`bulk-tickets-${Date.now()}`),
            ] as typeof prev;
          }
          return [...prev, createBulkMessage(`bulk-tickets-${Date.now()}`)] as typeof prev;
        });
      }
    },
    [currentChatId, setMessages, localMessages],
  );

  // Check if user has scrolled away from bottom
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const threshold = 100; // pixels from bottom to consider "at bottom"
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setShowScrollButton(!isNearBottom && hasMessages);
  }, [hasMessages]);

  // Track scroll events and content size changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);

    // Watch the content inside the container (first child) for size changes during streaming
    const resizeObserver = new ResizeObserver(() => {
      checkScrollPosition();
    });

    // Observe all children of the container to catch content growth
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      resizeObserver.observe(children[i]);
    }

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
      resizeObserver.disconnect();
    };
  }, [checkScrollPosition, allMessages]); // Re-run when messages change

  // When a new message is added, scroll to the START of that message (not the end)
  useEffect(() => {
    const currentCount = allMessages.length;
    const prevCount = prevMessageCountRef.current;

    // New message added - scroll to its start
    if (currentCount > prevCount && currentCount > 0) {
      hasScrolledToNewMessageRef.current = false;
      // Use requestAnimationFrame to scroll after render
      requestAnimationFrame(() => {
        if (!hasScrolledToNewMessageRef.current && lastMessageRef.current) {
          lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          hasScrolledToNewMessageRef.current = true;
        }
      });
    }

    prevMessageCountRef.current = currentCount;
  }, [allMessages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  }, []);

  function handleSend(content: string) {
    // Clear any dismissed error on new send
    setDismissedError(null);
    sendMessage(
      { text: content },
      {
        body: {
          modelId,
          chatId: currentChatId,
          mcpEnabled,
        },
      },
    );
  }

  function handleModelChange(newModelId: string) {
    setModelId(newModelId);
  }

  function getMessageContent(message: {
    parts?: Array<{ type: string; text?: string }>;
    content?: string;
  }): string {
    if (message.parts) {
      return message.parts
        .filter((part) => part.type === 'text' && part.text)
        .map((part) => part.text!)
        .join('');
    }
    return message.content || '';
  }

  const isDark = resolvedTheme !== 'light';

  return (
    <div className={`flex-1 flex flex-col h-screen ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <header
        className={`h-14 border-b flex items-center justify-between px-4 shrink-0 ${
          isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'
        }`}
      >
        <h1 className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          {hasMessages ? 'Chat' : 'New Chat'}
        </h1>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={handleShare}
              disabled={isSharing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showCopied
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : isDark
                    ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              {showCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 relative scroll-smooth"
      >
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center px-4 max-w-2xl mx-auto w-full">
            {/* Centered Empty State */}
            <div
              className={`mb-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 slide-in-from-bottom-4`}
            >
              <h1
                className={`text-4xl font-bold mb-4 tracking-tight text-center ${isDark ? 'text-white' : 'text-zinc-900'}`}
              >
                How can I help you today?
              </h1>
              <p className={`text-center max-w-md ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Turn ideas into GitLab issues, analyze code, or get development help.
              </p>
            </div>

            <div className="w-full animate-in fade-in zoom-in-95 duration-500 delay-100 slide-in-from-bottom-6">
              <div
                className={`text-center text-xs mb-3 space-y-1 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}
              >
                <p className="font-semibold">
                  Please observe all AI Assistant Expectations. Do not include:
                </p>
                <p className="opacity-90 max-w-2xl mx-auto">
                  Personal identifiers (customer name, claim#, policy#, contact info) • SSN, TIN,
                  SIN, driver&apos;s license numbers • Financial account numbers, credit/debit card
                  numbers • PHI, medical information • Usernames, passwords, or access keys
                </p>
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                modelId={modelId}
                onModelChange={handleModelChange}
                centered={true}
                onStop={stop}
                isLoading={isLoading}
              />
              <div
                className={`flex items-center justify-center gap-1.5 mt-3 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}
              >
                <AlertTriangle className="w-3 h-3" />
                <p className="text-[11px] font-medium">
                  Only the last 20 conversations are saved for history.
                </p>
              </div>
            </div>

            <div className="mt-8 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500 delay-200 slide-in-from-bottom-8">
              <p
                className={`text-center text-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
              >
                Try one of these to get started
              </p>
              <div className="grid grid-cols-2 gap-3">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    className={`text-sm text-left px-4 py-3.5 rounded-xl transition-all flex items-start gap-3 group ${
                      isDark
                        ? 'bg-zinc-900/40 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700'
                        : 'bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 border border-zinc-100 hover:border-zinc-200 shadow-sm hover:shadow'
                    }`}
                  >
                    <prompt.icon
                      className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-600'}`}
                    />
                    <span className="line-clamp-2">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User Guide */}
            <div className="mt-12 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500 delay-300 slide-in-from-bottom-10 space-y-8">
              <div>
                <h3
                  className={`text-sm font-semibold mb-3 uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                >
                  How it works
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900/20 border-zinc-800/50' : 'bg-white border-zinc-100'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 font-bold text-sm">
                      1
                    </div>
                    <h4
                      className={`font-medium mb-1 ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                    >
                      Connect GitLab
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      Link your account in Settings to access projects.
                    </p>
                  </div>
                  <div
                    className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900/20 border-zinc-800/50' : 'bg-white border-zinc-100'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3 font-bold text-sm">
                      2
                    </div>
                    <h4
                      className={`font-medium mb-1 ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                    >
                      Ask Questions
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      Chat about your codebase or plan new features.
                    </p>
                  </div>
                  <div
                    className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900/20 border-zinc-800/50' : 'bg-white border-zinc-100'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-3 font-bold text-sm">
                      3
                    </div>
                    <h4
                      className={`font-medium mb-1 ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                    >
                      Create Tickets
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      Turn conversations into issues with one click.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-8 px-4">
            {allMessages.map((message, index) => {
              // Extract tool invocations from parts (AI SDK v6 format)
              // Prefer existing toolInvocations if available (from ChatPage hydration)
              const existingTools = (message as unknown as { toolInvocations?: ToolInvocation[] })
                .toolInvocations;

              // We pass 'parts' to MessageBubble so it can compute tool invocations internally with useMemo
              // This prevents breaking React.memo on every render
              const parts = (message as unknown as { parts?: unknown[] }).parts;

              const isLastMessage = index === allMessages.length - 1;
              return (
                <div key={message.id} ref={isLastMessage ? lastMessageRef : undefined}>
                  <MessageBubble
                    id={message.id}
                    chatId={currentChatId}
                    role={message.role as 'user' | 'assistant'}
                    content={getMessageContent(message)}
                    toolInvocations={existingTools}
                    parts={parts}
                    isStreaming={isLoading && isLastMessage && message.role === 'assistant'}
                    onTicketCreated={handleTicketCreated}
                    onBulkTicketsCreated={handleBulkTicketsCreated}
                  />
                </div>
              );
            })}
            {isLoading && allMessages[allMessages.length - 1]?.role === 'user' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}

        {/* Scroll to bottom button - sticky inside scroll container */}
        {showScrollButton && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none z-10">
            <button
              onClick={scrollToBottom}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all hover:scale-105 ${
                isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700'
                  : 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <ChevronDown className="w-4 h-4" />
              <span className="text-sm font-medium">Scroll to bottom</span>
            </button>
          </div>
        )}
      </div>
      {error && error !== dismissedError && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-red-400 text-sm leading-relaxed">
              <p className="font-medium mb-1">Error Generating Response</p>
              <p className="text-red-400/80">
                {error.message || 'An error occurred. Please try again.'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setDismissedError(error)}
                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Only show bottom input when there are messages */}
      {hasMessages && (
        <div className={`shrink-0 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            modelId={modelId}
            onModelChange={handleModelChange}
            onStop={stop}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

export function Chat(props: ChatProps) {
  const [transport, setTransport] = useState<DefaultChatTransport<UIMessage> | null>(null);
  const { currentChatId, setCurrentChatId, onChatCreated } = useChatContext();

  // Refs for transport closure
  const currentChatIdRef = useRef(currentChatId);
  const onChatCreatedRef = useRef(onChatCreated);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);
  useEffect(() => {
    onChatCreatedRef.current = onChatCreated;
  }, [onChatCreated]);

  useEffect(() => {
    const t = new DefaultChatTransport({
      api: '/api/chat',
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await globalThis.fetch(input, init);

        // Capture chat ID from response header for new chats
        const newChatId = response.headers.get('X-Chat-Id');
        if (newChatId && !currentChatIdRef.current) {
          setCurrentChatId(newChatId);
          window.history.replaceState(null, '', `/chat/${newChatId}`);
          if (onChatCreatedRef.current) {
            onChatCreatedRef.current();
          }
        }

        return response;
      },
    });
    setTransport(t);
  }, [setCurrentChatId]);

  if (!transport) return null;

  return <ChatInner {...props} transport={transport} />;
}
