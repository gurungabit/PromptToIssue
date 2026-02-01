import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { Chat } from '@/components/chat/Chat';

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
  const initialMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  return (
    <Chat
      chatId={id}
      initialMessages={initialMessages}
    />
  );
}
