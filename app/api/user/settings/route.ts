import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const settings = await db.getUserSettings(session.user.id);

    if (!settings) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return safe subset of settings (no tokens)
    return new Response(
      JSON.stringify({
        theme: settings.theme,
        mcpEnabled: settings.mcpEnabled,
        preferredModelId: settings.preferredModelId,
        gitlabUsername: settings.gitlabUsername,
        gitlabConnected: !!settings.gitlabAccessToken,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('User settings API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();

    // Only allow updating safe fields
    const { theme, mcpEnabled, preferredModelId } = body;

    await db.updateUserSettings(session.user.id, {
      ...(theme && { theme }),
      ...(mcpEnabled !== undefined && { mcpEnabled }),
      ...(preferredModelId && { preferredModelId }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('User settings update error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
