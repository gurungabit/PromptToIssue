import { z } from 'zod';

// Schema for a GitLab User (Assignee/Author)
export const gitlabUserSchema = z.object({
  id: z.number().optional(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  webUrl: z.string().optional(),
});

// Schema for a GitLab Label
export const gitlabLabelSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  color: z.string().optional(),
  description: z.string().optional(),
});

// Schema for Acceptance Criteria
export const acceptanceCriteriaSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
});

// Schema for Tasks
export const taskSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
  estimatedHours: z.number().optional(),
});

// Enums for Ticket properties
export const TicketPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const TicketTypeSchema = z.enum(['feature', 'bug', 'enhancement', 'documentation', 'refactor', 'testing']);

// Schema for a Ticket (Enhanced Issue)
export const ticketSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(), // GitLab Project ID or Path
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  acceptanceCriteria: z.array(acceptanceCriteriaSchema).default([]),
  tasks: z.array(taskSchema).default([]),
  labels: z.array(z.string()).default([]),
  priority: TicketPrioritySchema.default('medium'),
  type: TicketTypeSchema.default('feature'),
  estimatedHours: z.number().optional(),
  
  // Keep original GitLab fields for backward compatibility/linking
  iid: z.number().optional(),
  state: z.enum(['opened', 'closed', 'all']).default('opened'),
  webUrl: z.string().optional(),
  assignees: z.array(gitlabUserSchema).optional(),
});

// Schema for the full AI response
export const ticketResponseSchema = z.object({
  type: z.literal('tickets'),
  tickets: z.array(ticketSchema),
  reasoning: z.string().optional(),
  needsClarification: z.boolean().default(false),
  clarificationQuestions: z.array(z.string()).default([]),
});

export type AcceptanceCriteria = z.infer<typeof acceptanceCriteriaSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;
export type TicketType = z.infer<typeof TicketTypeSchema>;

export type GitLabUser = z.infer<typeof gitlabUserSchema>;
export type GitLabLabel = z.infer<typeof gitlabLabelSchema>;
