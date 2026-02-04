import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Clear GitLab credentials
    await db.updateUserSettings(session.user.id, {
      gitlabAccessToken: undefined,
      gitlabRefreshToken: undefined,
      gitlabTokenExpiry: undefined,
      gitlabUsername: undefined,
      gitlabUserId: undefined,
      mcpEnabled: false,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GitLab disconnect error:', error);
    return new Response(JSON.stringify({ error: 'Failed to disconnect GitLab' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
