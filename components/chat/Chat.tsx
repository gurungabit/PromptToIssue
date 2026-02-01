'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useChat, type UseChatOptions } from '@ai-sdk/react';
import { type UIMessage, DefaultChatTransport } from 'ai';
import { useTheme } from 'next-themes';
import { useChatContext } from '@/contexts/ChatContext';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SettingsPanel } from '../SettingsPanel';
import { Settings, X, AlertCircle, ChevronDown, Sparkles, Search, Edit3, Zap } from 'lucide-react';
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
  initialMessages?: UIMessage[];
}

const EXAMPLE_PROMPTS = [
  'Create a bug report for "Login page crash" with acceptance criteria',
  'Analyze open high-priority issues and suggest an action plan',
  'Draft a feature ticket for "Dark Mode" including 3 subtasks',
  'Summarize the current milestone status and list blockers',
];

function ChatInner({ chatId, initialMessages = [], transport }: ChatProps & { transport: DefaultChatTransport<UIMessage> }) {
  const [modelId, setModelId] = useState('qwen3-8b');
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
    registerResetCallback,
    mcpEnabled
  } = useChatContext();



  // Initialize currentChatId from prop
  useEffect(() => {
    if (chatId) {
      setCurrentChatId(chatId);
    }
  }, [chatId, setCurrentChatId]);



  // Use useChat with transport
  const { messages, status, error, sendMessage, setMessages } = useChat({
    id: chatId || 'new-chat',
    messages: initialMessages,
    transport,
  } as UseChatOptions<UIMessage> & { transport?: DefaultChatTransport<UIMessage> });

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
          <div className="h-full flex flex-col items-center justify-center px-4 pb-32 max-w-2xl mx-auto w-full">
            
            {/* Hero Section */}
            <div className="text-center mb-8 space-y-3">

              <h1 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Welcome to Prompt-to-Issue
            </h1>
              <p className={`text-base max-w-md mx-auto leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                I&apos;m here to help you manage your work on GitLab. No complicated forms needed—just talk to me!
              </p>
            </div>

            {/* Getting Started Guide */}
             <div className={`mb-8 w-full max-w-lg mx-auto rounded-lg p-5 border shadow-sm ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Getting Started:</h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className={`flex shrink-0 items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mt-0.5 ${isDark ? 'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700' : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200'}`}>1</div>
                        <div>
                           <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>Connect your account</p>
                           <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                             Open <button onClick={() => setSettingsOpen(true)} className="text-blue-500 hover:underline font-medium focus:outline-none">Settings</button> to link your GitLab.
                           </p>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <div className={`flex shrink-0 items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mt-0.5 ${isDark ? 'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700' : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200'}`}>2</div>
                        <div>
                           <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>Tell me what to do</p>
                           <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                             Type &quot;Analyze open issues&quot; or &quot;Create a bug report&quot;.
                           </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className={`flex shrink-0 items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mt-0.5 ${isDark ? 'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700' : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200'}`}>3</div>
                         <div>
                           <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>I handle the rest</p>
                           <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                             I&apos;ll create tickets, list milestones, and answer questions.
                           </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Example Prompts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-50 ${
                    isDark 
                      ? 'bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700 text-zinc-300' 
                      : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md text-zinc-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-md transition-colors ${
                      isDark ? 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200' : 'bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-700'
                    }`}>
                      {i === 0 ? <Search className="w-4 h-4" /> :
                       i === 1 ? <Edit3 className="w-4 h-4" /> :
                       i === 2 ? <Zap className="w-4 h-4" /> :
                       <Sparkles className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium leading-tight opacity-90 group-hover:opacity-100">
                  {prompt}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4">
            {allMessages.map((message, index) => {
              // Extract tool invocations from parts (AI SDK v6 format)
              // Prefer existing toolInvocations if available (from ChatPage hydration)
              const existingTools = (message as unknown as { toolInvocations?: ToolInvocation[] }).toolInvocations;
              const calculatedTools = getToolInvocationsFromParts(
                (message as unknown as { parts?: Array<{ type: string; [key: string]: unknown }> }).parts
              );
              const toolInvocations = (existingTools && existingTools.length > 0) ? existingTools : calculatedTools;
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

export function Chat(props: ChatProps) {
  const [transport, setTransport] = useState<DefaultChatTransport<UIMessage> | null>(null);
  const { currentChatId, setCurrentChatId, onChatCreated } = useChatContext();
  
  // Refs for transport closure
  const currentChatIdRef = useRef(currentChatId);
  const onChatCreatedRef = useRef(onChatCreated);
  
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);
  useEffect(() => { onChatCreatedRef.current = onChatCreated; }, [onChatCreated]);
  
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
