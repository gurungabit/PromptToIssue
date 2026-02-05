import { auth } from '@/lib/auth/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('gitlab_access_token');
  const refreshToken = cookieStore.get('gitlab_refresh_token');
  const expiry = cookieStore.get('gitlab_expiry');

  // helper to clear cookies
  const clearCookies = () => {
    cookieStore.delete('gitlab_access_token');
    cookieStore.delete('gitlab_refresh_token');
    cookieStore.delete('gitlab_expiry');
  };

  // 1. If we have a valid access token and it's not expired (or we don't know expiry), we're good
  if (accessToken && expiry) {
    const expiryDate = new Date(expiry.value);
    // Refresh if expiring in less than 5 minutes
    if (expiryDate.getTime() - Date.now() > 5 * 60 * 1000) {
      return NextResponse.json({ authenticated: true, status: 'valid' });
    }
  }

  // 2. If no access token or it's expired/expiring, try refresh
  if (refreshToken) {
    console.log('[GitLab Status] Token missing or expiring, attempting refresh...');
    try {
      const payload = {
        client_id: process.env.GITLAB_CLIENT_ID || process.env.GITLAB_APP_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET || process.env.GITLAB_APP_SECRET,
        refresh_token: refreshToken.value,
        grant_type: 'refresh_token',
        redirect_uri:
          process.env.GITLAB_REDIRECT_URI || process.env.NEXTAUTH_URL + '/api/gitlab/callback',
      };

      const refreshResponse = await fetch(`${GITLAB_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (refreshResponse.ok) {
        const newTokens = await refreshResponse.json();

        // Update cookies
        cookieStore.set('gitlab_access_token', newTokens.access_token, {
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: newTokens.expires_in,
        });

        if (newTokens.refresh_token) {
          cookieStore.set('gitlab_refresh_token', newTokens.refresh_token, {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
          });
        }

        cookieStore.set(
          'gitlab_expiry',
          new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          {
            secure: true,
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
            maxAge: newTokens.expires_in,
          },
        );

        return NextResponse.json({ authenticated: true, status: 'refreshed' });
      } else {
        console.error('[GitLab Status] Refresh failed:', await refreshResponse.text());
        clearCookies();
        return NextResponse.json(
          { authenticated: false, error: 'refresh_failed' },
          { status: 401 },
        );
      }
    } catch (error) {
      console.error('[GitLab Status] Refresh error:', error);
      return NextResponse.json({ authenticated: false, error: 'refresh_error' }, { status: 500 });
    }
  }

  // 3. If cookies are missing, check DB (migration path for existing users)
  if (!accessToken && !refreshToken) {
    const { db } = await import('@/lib/db/client');
    const userSettings = await db.getUserSettings(session.user.id);

    if (userSettings?.gitlabAccessToken) {
      console.log('[GitLab Status] Migrating tokens from DB to cookies');

      // Set cookies from DB
      cookieStore.set('gitlab_access_token', userSettings.gitlabAccessToken, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: userSettings.gitlabTokenExpiry
          ? (new Date(userSettings.gitlabTokenExpiry).getTime() - Date.now()) / 1000
          : 7200, // Default to 2 hours if unknown
      });

      if (userSettings.gitlabRefreshToken) {
        cookieStore.set('gitlab_refresh_token', userSettings.gitlabRefreshToken, {
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }

      if (userSettings.gitlabTokenExpiry) {
        cookieStore.set('gitlab_expiry', userSettings.gitlabTokenExpiry, {
          secure: true,
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: (new Date(userSettings.gitlabTokenExpiry).getTime() - Date.now()) / 1000,
        });
      }

      return NextResponse.json({ authenticated: true, status: 'migrated' });
    }
  }

  // 4. No refresh token and no DB token = completely unauthenticated
  return NextResponse.json({ authenticated: false, reason: 'no_tokens' }, { status: 401 });
}
