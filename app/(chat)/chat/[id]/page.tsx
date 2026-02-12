import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { Chat } from '@/components/chat/Chat';
import type { UIMessage } from 'ai';

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const session = await auth();

  if (!session?.user) {
    return notFound();
  }

  const { id } = await params;
  const chat = await db.getChat(id);

  if (!chat || chat.userId !== session.user.id) {
    return notFound();
  }

  const messages = await db.getMessages(id);

  // Transform messages to the format expected by Chat component
  // Transform messages to the format expected by Chat component
  // Transform messages to the format expected by Chat component
  const initialMessages = messages.map((msg) => {
    // Reconstruct tool invocations from parts
    let toolInvocations;

    if (msg.parts && msg.parts.length > 0) {
      const toolCalls = msg.parts.filter(
        (
          p,
        ): p is {
          type: 'tool-call';
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
        } => p.type === 'tool-call',
      );
      const toolResults = msg.parts.filter(
        (p): p is { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown } =>
          p.type === 'tool-result',
      );

      if (toolCalls.length > 0) {
        toolInvocations = toolCalls.map((call) => {
          const result = toolResults.find((r) => r.toolCallId === call.toolCallId);
          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.args,
            state: (result ? 'result' : 'call') as 'result' | 'call',
            result: result?.result,
          };
        });
      }
    }

    return {
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      toolInvocations,
      // Pass persisted parts so MessageBubble can extract research-steps for display
      parts: msg.parts,
    } as unknown as UIMessage;
  });

  return <Chat chatId={id} initialMessages={initialMessages} />;
}
