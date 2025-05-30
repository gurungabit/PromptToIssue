export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TicketData {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: string[];
  labels: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AIResponse {
  content: string;
  tickets?: TicketData[];
  shouldSplit?: boolean;
  clarificationNeeded?: boolean;
}

// Structured AI Response Schema for JSON responses
export interface StructuredAIResponse {
  message: string;
  tickets?: TicketData[];
  shouldSplit?: boolean;
  clarificationNeeded?: boolean;
}

export interface AIProvider {
  name: string;
  generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
  parseTickets(input: string): Promise<TicketData[]>;
}

export type AIProviderType = 'openai' | 'anthropic' | 'google';
