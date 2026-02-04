import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { executeListProjects } from "@/lib/mcp/gitlab-tools";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userSettings = await db.getUserSettings(session.user.id);
    if (!userSettings?.gitlabAccessToken) {
      return new Response(
        JSON.stringify({ error: "GitLab is not connected" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get search query from URL params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;

    const projects = await executeListProjects(
      { search, membership: true, perPage: 50 },
      {
        accessToken: userSettings.gitlabAccessToken,
        refreshToken: userSettings.gitlabRefreshToken,
        userId: session.user.id,
      },
    );

    return new Response(JSON.stringify(projects), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List Projects API Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list projects";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
