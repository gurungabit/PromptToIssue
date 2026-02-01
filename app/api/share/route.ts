import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { nanoid } from 'nanoid';

// POST - Create a public share link for a chat
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const { chatId } = await request.json();
    
    if (!chatId) {
      return new Response(
        JSON.stringify({ error: 'chatId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user owns this chat
    const chat = await db.getChat(chatId);
    if (!chat || chat.userId !== session.user.id) {
      return new Response(
        JSON.stringify({ error: 'Chat not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create public share ID
    const shareId = nanoid(10);
    
    await db.createPublicShare({
      id: shareId,
      chatId,
      userId: session.user.id,
    });
    
    return new Response(
      JSON.stringify({ shareId, shareUrl: `/share/${shareId}` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Share API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create share link' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
