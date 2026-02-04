import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { redirect } from "next/navigation";

const GITLAB_URL = process.env.GITLAB_URL || "https://gitlab.com";
const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID;
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET;
const GITLAB_REDIRECT_URI =
  process.env.GITLAB_REDIRECT_URI ||
  "http://localhost:3000/api/gitlab/callback";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return redirect("/login?error=unauthorized");
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("GitLab OAuth error:", error);
    return redirect("/chat/new?error=gitlab_auth_failed");
  }

  if (!code) {
    return redirect("/chat/new?error=no_code");
  }

  if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
    return redirect("/chat/new?error=not_configured");
  }

  let success = false;

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`${GITLAB_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITLAB_CLIENT_ID,
        client_secret: GITLAB_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: GITLAB_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("GitLab token exchange failed:", errorText);
      return redirect("/chat/new?error=token_exchange_failed");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get GitLab user info
    const userResponse = await fetch(`${GITLAB_URL}/api/v4/user`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      return redirect("/chat/new?error=user_fetch_failed");
    }

    const gitlabUser = await userResponse.json();

    // Store GitLab credentials in user settings
    await db.updateUserSettings(session.user.id, {
      gitlabAccessToken: access_token,
      gitlabRefreshToken: refresh_token,
      gitlabTokenExpiry: new Date(Date.now() + expires_in * 1000).toISOString(),
      gitlabUsername: gitlabUser.username,
      gitlabUserId: String(gitlabUser.id),
    });

    success = true;
  } catch (error) {
    console.error("GitLab OAuth callback error:", error);
    return redirect("/chat/new?error=unknown");
  }

  // Redirect outside try-catch to prevent NEXT_REDIRECT from being caught
  if (success) {
    return redirect("/chat/new?success=gitlab_connected");
  }
}
