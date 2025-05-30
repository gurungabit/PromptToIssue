import { z } from 'zod';

// Ticket data schema
export const TicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  acceptanceCriteria: z.array(z.string()),
  tasks: z.array(z.string()),
  labels: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

// Structured AI response schema
export const StructuredAIResponseSchema = z.object({
  message: z.string().min(1),
  tickets: z.array(TicketSchema).optional(),
  shouldSplit: z.boolean().optional().default(false),
  clarificationNeeded: z.boolean().optional().default(false),
});

export type ValidatedTicket = z.infer<typeof TicketSchema>;
export type ValidatedStructuredResponse = z.infer<typeof StructuredAIResponseSchema>;
