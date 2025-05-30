import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

// Configure axios defaults - use relative URLs since Vite proxy handles routing
// axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface TicketData {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: string[];
  labels: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: {
    tickets?: TicketData[];
    shouldSplit?: boolean;
    clarificationNeeded?: boolean;
  };
}

export interface Conversation {
  id: string;
  title: string;
  aiModel: 'openai' | 'anthropic' | 'google';
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loading: boolean;
  conversationsLoading: boolean;
  sendMessage: (message: string, conversationId?: string, aiModel?: string) => Promise<{
    conversationId: string;
    response: string;
    tickets?: TicketData[];
    shouldSplit?: boolean;
    clarificationNeeded?: boolean;
  }>;
  loadConversations: () => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  createTickets: (conversationId: string, tickets: TicketData[], platformId?: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  deleteAllConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const loadConversations = async () => {
    try {
      setConversationsLoading(true);
      console.log('Loading conversations...');
      const response = await axios.get('/api/protected/conversations');
      console.log('Conversations loaded:', response.data);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      // Don't throw here, just log the error
    } finally {
      setConversationsLoading(false);
    }
  };

  const sendMessage = async (
    message: string,
    conversationId?: string,
    aiModel?: string
  ) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/protected/chat', {
        message,
        conversationId,
        aiModel,
      });

      // Only reload conversations if this was a new conversation (no conversationId provided)
      // For existing conversations, the conversation list doesn't need to be updated
      if (!conversationId) {
        // For new conversations, add optimistically and then reload to get the full data
        const newConversation: Conversation = {
          id: response.data.conversationId,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          aiModel: (aiModel || 'openai') as 'openai' | 'anthropic' | 'google',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Add to the beginning of the list (most recent first)
        setConversations(prev => [newConversation, ...prev]);
        
        // Then reload to get accurate data from server (this will be fast since it's just a GET request)
        await loadConversations();
      } else {
        // For existing conversations, just update the updatedAt time locally
        setConversations(prev => prev.map(conv => 
          conv.id === response.data.conversationId 
            ? { ...conv, updatedAt: new Date().toISOString() }
            : conv
        ));
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const createTickets = async (
    conversationId: string,
    tickets: TicketData[],
    platformId?: string
  ) => {
    try {
      await axios.post('/api/protected/tickets', {
        conversationId,
        tickets,
        platformId,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create tickets');
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await axios.delete(`/api/protected/conversations/${conversationId}`);
      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      // Clear current conversation if it's the one being deleted
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete conversation');
    }
  };

  const deleteAllConversations = async () => {
    try {
      await axios.delete('/api/protected/conversations');
      // Clear local state
      setConversations([]);
      setCurrentConversation(null);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete all conversations');
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const value = {
    conversations,
    currentConversation,
    loading,
    conversationsLoading,
    sendMessage,
    loadConversations,
    setCurrentConversation,
    createTickets,
    deleteConversation,
    deleteAllConversations,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 