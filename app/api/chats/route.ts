import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const chats = await db.getUserChats(session.user.id);
    
    return NextResponse.json(chats);
  } catch (error) {
    console.error('Failed to get chats:', error);
    return NextResponse.json(
      { error: 'Failed to get chats' },
      { status: 500 }
    );
  }
}
