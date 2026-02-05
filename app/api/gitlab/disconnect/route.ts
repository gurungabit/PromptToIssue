import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Clear GitLab credentials
    await db.updateUserSettings(session.user.id, {
      gitlabAccessToken: null,
      gitlabRefreshToken: null,
      gitlabTokenExpiry: null,
      gitlabUsername: null,
      gitlabUserId: null,
      mcpEnabled: false,
    });

    const cookieStore = await cookies();
    cookieStore.delete('gitlab_access_token');
    cookieStore.delete('gitlab_refresh_token');
    cookieStore.delete('gitlab_expiry');

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
