import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const chat = await db.getChat(id);

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Check ownership
    if (chat.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await db.getMessages(id);

    return NextResponse.json({
      chat,
      messages,
    });
  } catch (error) {
    console.error('Failed to get chat:', error);
    return NextResponse.json({ error: 'Failed to get chat' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const chat = await db.getChat(id);

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Check ownership
    if (chat.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.deleteChat(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
