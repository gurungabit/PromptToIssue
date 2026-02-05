import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';
import type {
  User,
  UserInput,
  UserSettings,
  Chat,
  ChatInput,
  Message,
  MessageInput,
  Feedback,
  FeedbackInput,
  PublicShare,
} from './schema';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
  },
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'prompttoissue';

// =============================================================================
// User Operations
// =============================================================================

export async function createUser(input: UserInput): Promise<User> {
  const now = new Date().toISOString();
  const user: User = {
    PK: `USER#${input.id}`,
    SK: 'PROFILE',
    id: input.id,
    email: input.email,
    name: input.name,
    hashedPassword: input.hashedPassword,
    createdAt: now,
    updatedAt: now,
    GSI1PK: 'USERS',
    GSI1SK: input.email,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );

  return user;
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    }),
  );

  return (result.Item as User) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'USERS',
        ':sk': email,
      },
      Limit: 1,
    }),
  );

  return (result.Items?.[0] as User) ?? null;
}

// =============================================================================
// User Settings Operations
// =============================================================================

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'SETTINGS',
      },
    }),
  );

  return (result.Item as UserSettings) ?? null;
}

export async function updateUserSettings(
  userId: string,
  settings: Partial<{
    [K in keyof Omit<UserSettings, 'PK' | 'SK' | 'userId' | 'updatedAt'>]: UserSettings[K] | null;
  }>,
): Promise<UserSettings> {
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateParts: string[] = ['#updatedAt = :updatedAt'];
  const removeParts: string[] = [];
  const expressionNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const expressionValues: Record<string, unknown> = { ':updatedAt': now };

  for (const [key, value] of Object.entries(settings)) {
    if (value === null) {
      // If value is explicitly null, we want to remove the attribute
      removeParts.push(`#${key}`);
      expressionNames[`#${key}`] = key;
    } else if (value !== undefined) {
      // If value is defined (and not null), update it
      updateParts.push(`#${key} = :${key}`);
      expressionNames[`#${key}`] = key;
      expressionValues[`:${key}`] = value;
    }
  }

  let updateExpression = `SET ${updateParts.join(', ')}`;
  if (removeParts.length > 0) {
    updateExpression += ` REMOVE ${removeParts.join(', ')}`;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'SETTINGS',
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    }),
  );

  return result.Attributes as UserSettings;
}

// =============================================================================
// Chat Operations
// =============================================================================

export async function createChat(input: ChatInput): Promise<Chat> {
  const now = new Date().toISOString();

  // Enforce Max 20 Conversations
  const existingChats = await getUserChats(input.userId, 100); // Fetch more to be safe
  const MAX_CHATS = 20;

  // If we're at or above the limit, delete oldest chats until we have room for one more
  if (existingChats.length >= MAX_CHATS) {
    // Sort by createdAt ascending (oldest first) just to be sure, though getUserChats returns newest first.
    // existingChats is newest first, so oldest are at the end.
    const sortedChats = [...existingChats].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // We need to remove enough chats so that (existing - removed) + 1 <= MAX_CHATS
    // i.e., removed >= existing + 1 - MAX_CHATS
    const countToRemove = existingChats.length + 1 - MAX_CHATS;

    const chatsToDelete = sortedChats.slice(0, countToRemove);

    console.log(
      `[db] Enforcing limit: Deleting ${chatsToDelete.length} old chat(s) for user ${input.userId}`,
    );

    for (const chat of chatsToDelete) {
      await deleteChat(chat.id);
    }
  }

  const chat: Chat = {
    PK: `CHAT#${input.id}`,
    SK: 'META',
    id: input.id,
    userId: input.userId,
    title: input.title,
    modelId: input.modelId,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    GSI1PK: `USER#${input.userId}`,
    GSI1SK: `CHAT#${now}`,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: chat,
    }),
  );

  return chat;
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHAT#${chatId}`,
        SK: 'META',
      },
    }),
  );

  return (result.Item as Chat) ?? null;
}

export async function getUserChats(userId: string, limit = 50): Promise<Chat[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CHAT#',
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    }),
  );

  return (result.Items as Chat[]) ?? [];
}

export async function updateChatTitle(chatId: string, title: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHAT#${chatId}`,
        SK: 'META',
      },
      UpdateExpression: 'SET #title = :title, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#title': 'title',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':title': title,
        ':updatedAt': new Date().toISOString(),
      },
    }),
  );
}

export async function deleteChat(chatId: string): Promise<void> {
  // First, get all messages for this chat to delete them
  const messages = await getMessages(chatId);

  // Delete all messages
  for (const message of messages) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CHAT#${chatId}`,
          SK: `MSG#${message.createdAt}#${message.id}`,
        },
      }),
    );
  }

  // Delete the chat metadata
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHAT#${chatId}`,
        SK: 'META',
      },
    }),
  );
}

export async function makeChatPublic(chatId: string, userId: string): Promise<string> {
  const shareId = nanoid(12);
  const now = new Date().toISOString();

  // Update chat to be public
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHAT#${chatId}`,
        SK: 'META',
      },
      UpdateExpression: 'SET #isPublic = :isPublic, #shareId = :shareId, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#isPublic': 'isPublic',
        '#shareId': 'shareId',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':isPublic': true,
        ':shareId': shareId,
        ':updatedAt': now,
      },
    }),
  );

  // Create public share mapping
  const share: PublicShare = {
    PK: `PUBLIC#${shareId}`,
    SK: 'MAPPING',
    shareId,
    chatId,
    userId,
    createdAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: share,
    }),
  );

  return shareId;
}

export async function getChatByShareId(shareId: string): Promise<Chat | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PUBLIC#${shareId}`,
        SK: 'MAPPING',
      },
    }),
  );

  if (!result.Item) return null;

  const share = result.Item as PublicShare;
  return getChat(share.chatId);
}

// =============================================================================
// Message Operations
// =============================================================================

export async function addMessage(input: MessageInput): Promise<Message> {
  const now = new Date().toISOString();
  const message: Message = {
    PK: `CHAT#${input.chatId}`,
    SK: `MESSAGE#${now}#${input.id}`,
    id: input.id,
    chatId: input.chatId,
    role: input.role,
    content: input.content,
    parts: input.parts,
    regeneratedFrom: input.regeneratedFrom,
    createdAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: message,
    }),
  );

  // Update chat's updatedAt
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHAT#${input.chatId}`,
        SK: 'META',
      },
      UpdateExpression: 'SET #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':updatedAt': now },
    }),
  );

  return message;
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CHAT#${chatId}`,
        ':sk': 'MESSAGE#',
      },
      ScanIndexForward: true, // Oldest first
    }),
  );

  return (result.Items as Message[]) ?? [];
}

export async function deleteMessagesAfter(chatId: string, messageId: string): Promise<void> {
  // First get all messages after the specified one
  const messages = await getMessages(chatId);
  const targetIndex = messages.findIndex((m) => m.id === messageId);

  if (targetIndex === -1) return;

  const messagesToDelete = messages.slice(targetIndex + 1);

  // Delete each message
  for (const msg of messagesToDelete) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: msg.PK,
          SK: msg.SK,
        },
      }),
    );
  }
}

export async function updateMessageContent(
  chatId: string,
  messageId: string,
  content: string,
): Promise<Message | null> {
  // First, find the message to get its full SK (which includes createdAt)
  const messages = await getMessages(chatId);
  const message = messages.find((m) => m.id === messageId);

  if (!message) {
    console.error('[db] Message not found:', { chatId, messageId });
    return null;
  }

  // Update the message content
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: message.PK,
        SK: message.SK,
      },
      UpdateExpression: 'SET #content = :content',
      ExpressionAttributeNames: {
        '#content': 'content',
      },
      ExpressionAttributeValues: {
        ':content': content,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );

  return (result.Attributes as Message) ?? null;
}

// =============================================================================
// Feedback Operations
// =============================================================================

export async function addFeedback(input: FeedbackInput): Promise<Feedback> {
  const now = new Date().toISOString();
  const feedback: Feedback = {
    PK: `CHAT#${input.chatId}`,
    SK: `FEEDBACK#${input.messageId}`,
    messageId: input.messageId,
    chatId: input.chatId,
    userId: input.userId,
    rating: input.rating,
    comment: input.comment,
    createdAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: feedback,
    }),
  );

  return feedback;
}

export async function getFeedback(chatId: string, messageId: string): Promise<Feedback | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHAT#${chatId}`,
        SK: `FEEDBACK#${messageId}`,
      },
    }),
  );

  return (result.Item as Feedback) ?? null;
}

// ... existing code ...

export async function forkChat(originalChatId: string, newUserId: string): Promise<string> {
  const originalChat = await getChat(originalChatId);
  if (!originalChat) {
    throw new Error('Original chat not found');
  }

  const newChatId = nanoid();

  // Create the new chat
  await createChat({
    id: newChatId,
    userId: newUserId,
    title: `${originalChat.title} (Fork)`,
    modelId: originalChat.modelId,
  });

  // Get original messages
  const messages = await getMessages(originalChatId);

  // Copy messages to new chat
  for (const msg of messages) {
    await addMessage({
      id: nanoid(),
      chatId: newChatId,
      role: msg.role,
      content: msg.content,
      parts: msg.parts,
    });
  }

  return newChatId;
}

// Export all functions as a db object for convenience
export const db = {
  // Users
  createUser,
  getUserById,
  getUserByEmail,
  getUserSettings,
  updateUserSettings,
  // Chats
  createChat,
  getChat,
  getUserChats,
  updateChatTitle,
  deleteChat,
  makeChatPublic,
  getChatByShareId,
  forkChat,
  // Messages
  addMessage,
  getMessages,
  getChatMessages: getMessages, // Alias
  deleteMessagesAfter,
  updateMessageContent,
  // Feedback
  addFeedback,
  saveFeedback: async (input: {
    id: string;
    messageId: string;
    chatId: string;
    userId: string;
    type: 'positive' | 'negative';
    comment?: string;
  }) => {
    return addFeedback({
      ...input,
      rating: input.type === 'positive' ? 'up' : 'down',
    });
  },
  getFeedback,
  // Public Sharing
  createPublicShare: async (input: { id: string; chatId: string; userId: string }) => {
    const now = new Date().toISOString();
    const share: PublicShare = {
      PK: `PUBLIC#${input.id}`,
      SK: 'MAPPING',
      shareId: input.id,
      chatId: input.chatId,
      userId: input.userId,
      createdAt: now,
    };
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: share,
      }),
    );
    return share;
  },
  getPublicShare: async (shareId: string): Promise<PublicShare | null> => {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PUBLIC#${shareId}`,
          SK: 'MAPPING',
        },
      }),
    );
    return (result.Item as PublicShare) ?? null;
  },
};
