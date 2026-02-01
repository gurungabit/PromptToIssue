'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useTheme } from 'next-themes';
import { useChatContext } from '@/contexts/ChatContext';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SettingsPanel } from '../SettingsPanel';
import { Settings, X, AlertCircle, ChevronDown } from 'lucide-react';
import { ToolInvocation } from './types';

// Part type for tool invocations in AI SDK v6
// Tool parts have type: "tool-{toolName}" with input/output properties
interface ToolPart {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-streaming' | 'output-available';
  input?: Record<string, unknown>;
  output?: unknown;
}

// Helper to extract tool invocations from message parts
// AI SDK v6 uses "tool-{toolName}" as the type (e.g., "tool-list_projects")
function getToolInvocationsFromParts(parts?: unknown[]): ToolInvocation[] {
  if (!parts || !Array.isArray(parts)) return [];
  const toolInvocations: ToolInvocation[] = [];
  
  for (const part of parts) {
    if (
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      typeof (part as { type: string }).type === 'string' &&
      (part as { type: string }).type.startsWith('tool-') &&
      'toolCallId' in part
    ) {
      const tp = part as ToolPart;
      const toolName = tp.type.replace(/^tool-/, ''); // Extract tool name from "tool-list_projects" -> "list_projects"
      
      // Map AI SDK state to our ToolInvocation state
      let state: 'call' | 'partial-call' | 'result' = 'call';
      if (tp.state === 'output-available' || tp.state === 'output-streaming') {
        state = 'result';
      } else if (tp.state === 'input-streaming') {
        state = 'partial-call';
      }
      
      toolInvocations.push({
        toolCallId: tp.toolCallId,
        toolName: toolName,
        args: tp.input || {},
        state: state,
        result: tp.output,
      });
    }
  }
  
  return toolInvocations;
}

interface ChatProps {
  chatId?: string;
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
}

const EXAMPLE_PROMPTS = [
  'What is the meaning of life?',
  'How can I improve my productivity?',
  'Write a short poem about technology',
];

export function Chat({ chatId, initialMessages = [] }: ChatProps) {
  const [modelId, setModelId] = useState('gemini-3-flash');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localMessages] = useState(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const prevMessageCountRef = useRef(0);
  const hasScrolledToNewMessageRef = useRef(true);
  
  // Use React Context for chat state management
  const { 
    currentChatId, 
    setCurrentChatId, 
    onChatCreated,
    registerResetCallback,
    mcpEnabled
  } = useChatContext();

  // Use refs to avoid stale closures in transport
  const currentChatIdRef = useRef(currentChatId);
  const onChatCreatedRef = useRef(onChatCreated);
  
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);
  
  useEffect(() => {
    onChatCreatedRef.current = onChatCreated;
  }, [onChatCreated]);

  // Initialize currentChatId from prop
  useEffect(() => {
    if (chatId) {
      setCurrentChatId(chatId);
    }
  }, [chatId, setCurrentChatId]);

  // Transport with simple API configuration
  const [transport] = useState(() => new DefaultChatTransport({
    api: '/api/chat',
    fetch: async (input, init) => {
      const response = await globalThis.fetch(input, init);
      
      // Capture chat ID from response header for new chats
      const newChatId = response.headers.get('X-Chat-Id');
      if (newChatId && !currentChatIdRef.current) {
        setCurrentChatId(newChatId);
        window.history.replaceState(null, '', `/chat/${newChatId}`);
        onChatCreatedRef.current();
      }
      
      return response;
    },
  }));

  // Prepare options with any cast to avoid TS issues with initialMessages
  const useChatOptions: any = {
    id: chatId || 'new-chat',
    initialMessages,
    transport,
  };

  const { messages, status, error, sendMessage, setMessages } = useChat(useChatOptions);

  // Reset dismissed error when a new error occurs is handled by the render logic (error !== dismissedError)
  // We don't need a useEffect here to avoid "setState during render" warning.
  // When 'error' changes to a new object, it will strictly not equal the old 'dismissedError'.

  // Register reset callback with context
  useEffect(() => {
    registerResetCallback(() => {
      setMessages([]);
    });
  }, [registerResetCallback, setMessages]);

  const isLoading = status === 'streaming' || status === 'submitted';
  // Use messages from useChat - once messages has been populated (either by useChat or by setMessages),
  // use it. Only fall back to localMessages if messages is completely empty (initial render before hydration).
  const allMessages = messages.length > 0 ? messages : localMessages;
  const hasMessages = allMessages.length > 0;

  // Callback when a ticket is created from the widget
  const handleTicketCreated = useCallback(async (ticketUrl: string, ticketTitle: string) => {
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
          setMessages(prev => {
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
      setMessages(prev => {
        if (prev.length === 0 && localMessages.length > 0) {
           return [...localMessages, createTicketMessage(`ticket-created-${Date.now()}`)] as typeof prev;
        }
        return [...prev, createTicketMessage(`ticket-created-${Date.now()}`)] as typeof prev;
      });
    }
  }, [currentChatId, setMessages, localMessages]);

  // Callback when bulk tickets are created
  const handleBulkTicketsCreated = useCallback(async (results: { ticket: string; webUrl?: string }[]) => {
    console.log('[Chat] handleBulkTicketsCreated called with', results.length, 'results');
    const successfulTickets = results.filter(r => r.webUrl);
    if (successfulTickets.length === 0) {
      console.log('[Chat] No successful tickets to report');
      return;
    }
    
    // Create message content with all ticket links
    const ticketLinks = successfulTickets
      .map(t => `- [${t.ticket}](${t.webUrl})`)
      .join('\n');
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
          setMessages(prev => {
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
      setMessages(prev => {
        if (prev.length === 0 && localMessages.length > 0) {
           return [...localMessages, createBulkMessage(`bulk-tickets-${Date.now()}`)] as typeof prev;
        }
        return [...prev, createBulkMessage(`bulk-tickets-${Date.now()}`)] as typeof prev;
      });
    }
  }, [currentChatId, setMessages, localMessages]);

  // Check if user has scrolled away from bottom
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const threshold = 100; // pixels from bottom to consider "at bottom"
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
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
      }
    );
  }

  function handleModelChange(newModelId: string) {
    setModelId(newModelId);
  }

  function getMessageContent(message: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
    if (message.parts) {
      return message.parts
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text!)
        .join('');
    }
    return message.content || '';
  }

  const isDark = resolvedTheme !== 'light';

  return (
    <div className={`flex-1 flex flex-col h-screen ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <header className={`h-14 border-b flex items-center justify-between px-4 shrink-0 ${
        isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'
      }`}>
        <h1 className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          {hasMessages ? 'Chat' : 'Prompt2Issue'}
        </h1>
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
      </header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 relative">
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
            <h1 className={`text-3xl font-semibold mb-8 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              How can I help you?
            </h1>
            <div className="max-w-xl w-full space-y-1">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-50 ${
                    isDark 
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' 
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4">
            {allMessages.map((message, index) => {
              // Extract tool invocations from parts (AI SDK v6 format)
              const toolInvocations = getToolInvocationsFromParts(
                (message as unknown as { parts?: Array<{ type: string; [key: string]: unknown }> }).parts
              );
              const isLastMessage = index === allMessages.length - 1;
              return (
                <div key={message.id} ref={isLastMessage ? lastMessageRef : undefined}>
                  <MessageBubble
                    id={message.id}
                    chatId={currentChatId}
                    role={message.role as 'user' | 'assistant'}
                    content={getMessageContent(message)}
                    toolInvocations={toolInvocations.length > 0 ? toolInvocations : undefined}
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
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Scroll to bottom button - sticky inside scroll container */}
        {showScrollButton && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
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
              <p className="text-red-400/80">{error.message || 'An error occurred. Please try again.'}</p>
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

      <div className={`shrink-0 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          modelId={modelId}
          onModelChange={handleModelChange}
        />
      </div>
    </div>
  );
}
