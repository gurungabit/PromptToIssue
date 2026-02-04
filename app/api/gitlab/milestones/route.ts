import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { gitlabFetch } from "@/lib/mcp/gitlab-tools";

interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  due_date: string | null;
  start_date: string | null;
  web_url: string;
}

interface GitLabProject {
  id: number;
  namespace?: {
    id: number;
    kind: string;
  };
}

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

    const tokens = {
      accessToken: userSettings.gitlabAccessToken,
      refreshToken: userSettings.gitlabRefreshToken,
      userId: session.user.id,
    };

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch project milestones using gitlabFetch for automatic token refresh
    let milestones: GitLabMilestone[] = [];

    try {
      milestones = await gitlabFetch<GitLabMilestone[]>(
        `/projects/${encodeURIComponent(projectId)}/milestones?state=active&per_page=50`,
        tokens,
      );
    } catch (error) {
      console.error("Failed to fetch project milestones:", error);
    }

    // Fetch the project to get its namespace/group hierarchy
    try {
      const project = await gitlabFetch<GitLabProject>(
        `/projects/${encodeURIComponent(projectId)}`,
        tokens,
      );

      // If project has a namespace (group), fetch group milestones
      if (project.namespace?.id && project.namespace?.kind === "group") {
        try {
          const ancestorMilestones = await gitlabFetch<GitLabMilestone[]>(
            `/groups/${project.namespace.id}/milestones?state=active&include_ancestors=true&per_page=50`,
            tokens,
          );

          // Merge and deduplicate by id
          const existingIds = new Set(milestones.map((m) => m.id));
          for (const gm of ancestorMilestones) {
            if (!existingIds.has(gm.id)) {
              milestones.push(gm);
            }
          }
        } catch (error) {
          console.error("Failed to fetch group milestones:", error);
        }
      }
    } catch (error) {
      console.error("Failed to fetch project details:", error);
    }

    const formattedMilestones = milestones.map((m) => ({
      id: m.id,
      iid: m.iid,
      title: m.title,
      description: m.description,
      state: m.state,
      dueDate: m.due_date,
      startDate: m.start_date,
      webUrl: m.web_url,
    }));

    return new Response(JSON.stringify(formattedMilestones), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List Milestones API Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list milestones";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
