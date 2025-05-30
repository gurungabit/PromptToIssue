import { useContext, createContext } from 'react';

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

export interface ChatContextType {
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

export { ChatContext };

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 