import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { z } from 'zod';

const feedbackSchema = z.object({
  messageId: z.string(),
  chatId: z.string(),
  type: z.enum(['positive', 'negative']),
  comment: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { messageId, chatId, type, comment } = parsed.data;
    
    await db.saveFeedback({
      id: `${messageId}-${Date.now()}`,
      messageId,
      chatId,
      userId: session.user.id,
      type,
      comment,
    });
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Feedback API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save feedback' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
