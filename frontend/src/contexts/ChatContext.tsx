import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import {
  ChatContext,
  type TicketData,
  type Conversation,
  type ChatContextType,
  type ChatMode,
} from '../hooks/useChat';

// Configure axios defaults - use relative URLs since Vite proxy handles routing
// axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Add request interceptor to include auth token
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login only if not already on login/register pages
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Check if we're already on login/register pages to avoid infinite redirects
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('ticket'); // Default to ticket mode

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
    aiModel?: string,
    messageMode?: ChatMode
  ) => {
    setLoading(true);
    const currentMode = messageMode || mode;

    try {
      const response = await axios.post('/api/protected/chat', {
        message,
        conversationId,
        aiModel,
        mode: currentMode,
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
          mode: currentMode,
        };

        // Add to the beginning of the list (most recent first)
        setConversations(prev => [newConversation, ...prev]);

        // Then reload to get accurate data from server (this will be fast since it's just a GET request)
        await loadConversations();
      } else {
        // For existing conversations, just update the updatedAt time locally
        setConversations(prev =>
          prev.map(conv =>
            conv.id === response.data.conversationId
              ? { ...conv, updatedAt: new Date().toISOString() }
              : conv
          )
        );
      }

      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
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
    } catch (error) {
      console.error('Failed to create tickets:', error);
      throw error;
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
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  };

  const deleteAllConversations = async () => {
    try {
      await axios.delete('/api/protected/conversations');
      // Clear local state
      setConversations([]);
      setCurrentConversation(null);
    } catch (error) {
      console.error('Failed to delete all conversations:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Only load conversations if there's a valid token (user is authenticated)
    const token = localStorage.getItem('token');
    if (token) {
      loadConversations();
    }
  }, []);

  const value: ChatContextType = {
    conversations,
    currentConversation,
    loading,
    conversationsLoading,
    mode,
    setMode,
    sendMessage,
    loadConversations,
    setCurrentConversation,
    createTickets,
    deleteConversation,
    deleteAllConversations,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
