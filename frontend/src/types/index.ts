export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata?: string | object;
  isLoading?: boolean;
}

export interface Platform {
  id: string;
  name: string;
  url?: string;
}

export interface Project {
  id: string;
  name: string;
  url?: string;
  description?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  type?: string;
  groupName?: string;
}

export interface PlatformTicket {
  title: string;
  url: string;
  number: number;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export interface TicketCreationResponse {
  platformTickets: PlatformTicket[];
  message: string;
}

export type TicketFieldValue = string | string[] | number | 'low' | 'medium' | 'high' | 'critical';
