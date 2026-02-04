import { auth } from '@/lib/auth/auth';
import { ForkChatButton } from '@/components/chat/ForkChatButton';
import { db } from '@/lib/db/client';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  const session = await auth();
  
  // Get share info
  const share = await db.getPublicShare(id);
  if (!share) {
    notFound();
  }
  
  // Get chat and messages
  const chat = await db.getChat(share.chatId);
  const messages = await db.getChatMessages(share.chatId);
  
  if (!chat) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
              <span className="text-zinc-900 font-bold text-xs">P</span>
            </div>
            <span className="font-medium text-white">Prompt2Issue</span>
          </Link>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400 text-sm">Shared Chat</span>
        </div>
        
        <div className="flex items-center gap-3">
          {session?.user ? (
            <ForkChatButton shareId={id} />
          ) : (
            <Link
              href={`/api/auth/signin?callbackUrl=/share/${id}`}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign in to Fork
            </Link>
          )}
          
          <Link
            href="/chat/new"
            className="px-4 py-2 text-sm font-medium text-zinc-900 bg-white rounded-lg hover:bg-zinc-200 transition-colors"
          >
            New Chat
          </Link>
        </div>
      </header>
      
      {/* Chat title */}
      <div className="max-w-3xl mx-auto px-4 py-6 border-b border-zinc-800">
        <h1 className="text-xl font-medium text-white">{chat.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Shared on {new Date(share.createdAt || 0).toLocaleDateString()}
        </p>
      </div>
      
      {/* Messages */}
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role as 'user' | 'assistant'}
            content={message.content}
            isReadOnly={true}
          />
        ))}
      </div>
    </div>
  );
}
