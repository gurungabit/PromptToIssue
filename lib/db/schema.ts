import { z } from 'zod';

// =============================================================================
// Single Table Design Schema
// =============================================================================
// PK patterns:
//   USER#{userId}        - User entities
//   CHAT#{chatId}        - Chat entities
//   PUBLIC#{shareId}     - Public share mappings
//
// SK patterns:
//   PROFILE              - User profile
//   SETTINGS             - User/Chat settings
//   META                 - Chat metadata
//   MESSAGE#{timestamp}  - Messages in a chat
//   FEEDBACK#{messageId} - Feedback entries
//
// GSI1 (GSI1PK, GSI1SK):
//   USERS / {email}      - User lookup by email
//   USER#{userId} / CHAT#{timestamp} - User's chats
//
// GSI2 (GSI2PK, GSI2SK):
//   PUBLIC / {shareId}   - Public chat lookup
// =============================================================================

// User Schema
export const UserSchema = z.object({
  PK: z.string(), // USER#{userId}
  SK: z.literal('PROFILE'),
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  hashedPassword: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  GSI1PK: z.literal('USERS'),
  GSI1SK: z.string(), // email for lookup
});

export type User = z.infer<typeof UserSchema>;
export type UserInput = Omit<User, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'createdAt' | 'updatedAt'>;

// User Settings Schema
export const UserSettingsSchema = z.object({
  PK: z.string(), // USER#{userId}
  SK: z.literal('SETTINGS'),
  userId: z.string(),
  mcpEnabled: z.boolean().default(false),
  gitlabAccessToken: z.string().optional(),
  gitlabRefreshToken: z.string().optional(),
  gitlabTokenExpiry: z.string().optional(),
  gitlabUsername: z.string().optional(),
  gitlabUserId: z.string().optional(),
  preferredModelId: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  updatedAt: z.string(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

// Chat Schema
export const ChatSchema = z.object({
  PK: z.string(), // CHAT#{chatId}
  SK: z.literal('META'),
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  modelId: z.string(),
  isPublic: z.boolean().default(false),
  shareId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  GSI1PK: z.string(), // USER#{userId}
  GSI1SK: z.string(), // CHAT#{createdAt}
});

export type Chat = z.infer<typeof ChatSchema>;
export type ChatInput = Omit<Chat, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'createdAt' | 'updatedAt' | 'isPublic' | 'shareId'>;

// Message Part schemas for tool calls
export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
});

export const ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
});

export const MessagePartSchema = z.union([
  TextPartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema,
]);

export type MessagePart = z.infer<typeof MessagePartSchema>;

// Message Schema
export const MessageSchema = z.object({
  PK: z.string(), // CHAT#{chatId}
  SK: z.string(), // MESSAGE#{timestamp}#{id}
  id: z.string(),
  chatId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(), // Plain text content
  parts: z.array(MessagePartSchema).optional(), // For tool calls/structured content
  regeneratedFrom: z.string().optional(), // ID of original message if regenerated
  createdAt: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;
export type MessageInput = Omit<Message, 'PK' | 'SK' | 'createdAt'>;

// Feedback Schema
export const FeedbackSchema = z.object({
  PK: z.string(), // CHAT#{chatId}
  SK: z.string(), // FEEDBACK#{messageId}
  messageId: z.string(),
  chatId: z.string(),
  userId: z.string(),
  rating: z.enum(['up', 'down']),
  comment: z.string().optional(),
  createdAt: z.string(),
});

export type Feedback = z.infer<typeof FeedbackSchema>;
export type FeedbackInput = Omit<Feedback, 'PK' | 'SK' | 'createdAt'>;

// Public Share Mapping Schema
export const PublicShareSchema = z.object({
  PK: z.string(), // PUBLIC#{shareId}
  SK: z.literal('MAPPING'),
  shareId: z.string(),
  chatId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
});

export type PublicShare = z.infer<typeof PublicShareSchema>;
