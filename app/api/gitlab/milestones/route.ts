import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';

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

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userSettings = await db.getUserSettings(session.user.id);
    if (!userSettings?.gitlabAccessToken) {
      return new Response(JSON.stringify({ error: 'GitLab is not connected' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch project milestones
    const projectMilestones = await fetch(
      `${GITLAB_URL}/api/v4/projects/${encodeURIComponent(projectId)}/milestones?state=active&per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${userSettings.gitlabAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let milestones: GitLabMilestone[] = [];
    
    if (projectMilestones.ok) {
      milestones = await projectMilestones.json();
    }

    // Also fetch the project to get its namespace/group hierarchy
    const projectResponse = await fetch(
      `${GITLAB_URL}/api/v4/projects/${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${userSettings.gitlabAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (projectResponse.ok) {
      const project = await projectResponse.json();
      
      // If project has a namespace (group), fetch group milestones
      if (project.namespace?.id && project.namespace?.kind === 'group') {
        // Fetch milestones from the immediate group and ancestors
        const groupMilestones = await fetch(
          `${GITLAB_URL}/api/v4/groups/${project.namespace.id}/milestones?state=active&include_ancestors=true&per_page=50`,
          {
            headers: {
              Authorization: `Bearer ${userSettings.gitlabAccessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (groupMilestones.ok) {
          const ancestorMilestones: GitLabMilestone[] = await groupMilestones.json();
          // Merge and deduplicate by id
          const existingIds = new Set(milestones.map(m => m.id));
          for (const gm of ancestorMilestones) {
            if (!existingIds.has(gm.id)) {
              milestones.push(gm);
            }
          }
        }
      }
    }
    
    const formattedMilestones = milestones.map(m => ({
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
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('List Milestones API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list milestones';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
