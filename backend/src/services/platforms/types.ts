export interface PlatformTicket {
  title: string;
  description: string;
  labels: string[];
  assignee?: string;
  milestone?: string;
  dueDate?: Date;
}

export interface CreatedTicket {
  id: string;
  url: string;
  title: string;
  number: number;
}

export interface PlatformClient {
  name: string;
  createTicket(projectId: string, ticket: PlatformTicket): Promise<CreatedTicket>;
  updateTicket(
    projectId: string,
    ticketId: string,
    ticket: Partial<PlatformTicket>
  ): Promise<CreatedTicket>;
  getProjects(): Promise<{ id: string; name: string; url: string }[]>;
  testConnection(): Promise<boolean>;
}

export type PlatformType = 'gitlab' | 'github';
