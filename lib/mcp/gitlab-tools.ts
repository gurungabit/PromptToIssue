import { tool } from 'ai';
import { z } from 'zod';

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';

// Types for GitLab API responses
interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  visibility: string;
  forks_count: number;
  star_count: number;
  open_issues_count: number;
  created_at: string;
  last_activity_at: string;
}

interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  web_url: string;
  author: { username: string } | null;
  assignees: Array<{ username: string }>;
  milestone: { title: string } | null;
  weight: number | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

// Helper to make authenticated GitLab API requests
async function gitlabFetch<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${GITLAB_URL}/api/v4${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitLab API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool parameter schemas
export const listProjectsSchema = z.object({
  search: z.string().optional().describe('Search query to filter projects'),
  owned: z.boolean().optional().describe('Only show projects owned by the user'),
  membership: z.boolean().optional().describe('Only show projects where user is a member'),
  perPage: z.number().optional().default(20).describe('Number of results per page'),
});

export const getProjectSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('REQUIRED: Project ID (number like 67612828) or URL-encoded path (like "necrokings/mcp")'),
});

export const searchIssuesSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or URL-encoded path'),
  search: z.string().optional().describe('Search query for issue title/description'),
  state: z.enum(['opened', 'closed', 'all']).optional().default('opened'),
  labels: z.string().optional().describe('Comma-separated list of labels'),
  assigneeId: z.number().optional().describe('Assignee user ID'),
  perPage: z.number().optional().default(20),
});

export const getIssueSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or URL-encoded path'),
  issueIid: z.number().describe('Issue IID (not ID)'),
});

export const createIssueSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or URL-encoded path'),
  title: z.string().describe('Issue title'),
  description: z.string().optional().describe('Issue description (Markdown supported)'),
  labels: z.string().optional().describe('Comma-separated list of labels'),
  assigneeIds: z.array(z.number()).optional().describe('Array of assignee user IDs'),
  milestoneId: z.number().optional().describe('Milestone ID'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
});

export const updateIssueSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or URL-encoded path'),
  issueIid: z.number().describe('Issue IID'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  labels: z.string().optional().describe('New labels (comma-separated)'),
  stateEvent: z.enum(['close', 'reopen']).optional().describe('State change event'),
});

export const addIssueCommentSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or URL-encoded path'),
  issueIid: z.number().describe('Issue IID'),
  body: z.string().describe('Comment text (Markdown supported)'),
});

// Tool executor functions
export async function executeListProjects(
  params: z.infer<typeof listProjectsSchema>,
  accessToken: string
) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.owned) searchParams.set('owned', 'true');
  // Default to membership=true to only show projects user has access to
  // unless explicitly set to false
  const showMembership = params.membership !== false;
  if (showMembership) searchParams.set('membership', 'true');
  searchParams.set('per_page', String(params.perPage || 20));

  const projects = await gitlabFetch<GitLabProject[]>(`/projects?${searchParams}`, accessToken);
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    path: p.path_with_namespace,
    description: p.description,
    webUrl: p.web_url,
    defaultBranch: p.default_branch,
    visibility: p.visibility,
    lastActivity: p.last_activity_at,
  }));
}

export async function executeGetProject(
  params: z.infer<typeof getProjectSchema>,
  accessToken: string
) {
  const project = await gitlabFetch<GitLabProject>(
    `/projects/${encodeURIComponent(String(params.projectId))}`,
    accessToken
  );
  return {
    id: project.id,
    name: project.name,
    path: project.path_with_namespace,
    description: project.description,
    webUrl: project.web_url,
    defaultBranch: project.default_branch,
    visibility: project.visibility,
    forksCount: project.forks_count,
    starsCount: project.star_count,
    openIssuesCount: project.open_issues_count,
    createdAt: project.created_at,
    lastActivity: project.last_activity_at,
  };
}

export async function executeSearchIssues(
  params: z.infer<typeof searchIssuesSchema>,
  accessToken: string
) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.state) searchParams.set('state', params.state);
  if (params.labels) searchParams.set('labels', params.labels);
  if (params.assigneeId) searchParams.set('assignee_id', String(params.assigneeId));
  searchParams.set('per_page', String(params.perPage || 20));

  const issues = await gitlabFetch<GitLabIssue[]>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues?${searchParams}`,
    accessToken
  );
  return issues.map((i) => ({
    id: i.id,
    iid: i.iid,
    title: i.title,
    description: i.description,
    state: i.state,
    labels: i.labels,
    webUrl: i.web_url,
    author: i.author?.username,
    assignees: i.assignees?.map((a) => a.username),
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  }));
}

export async function executeGetIssue(
  params: z.infer<typeof getIssueSchema>,
  accessToken: string
) {
  const issue = await gitlabFetch<GitLabIssue>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues/${params.issueIid}`,
    accessToken
  );
  return {
    id: issue.id,
    iid: issue.iid,
    title: issue.title,
    description: issue.description,
    state: issue.state,
    labels: issue.labels,
    webUrl: issue.web_url,
    author: issue.author?.username,
    assignees: issue.assignees?.map((a) => a.username),
    milestone: issue.milestone?.title,
    weight: issue.weight,
    dueDate: issue.due_date,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
  };
}

export async function executeCreateIssue(
  params: z.infer<typeof createIssueSchema>,
  accessToken: string
) {
  const issue = await gitlabFetch<GitLabIssue>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        labels: params.labels,
        assignee_ids: params.assigneeIds,
        milestone_id: params.milestoneId,
        due_date: params.dueDate,
      }),
    }
  );
  return {
    id: issue.id,
    iid: issue.iid,
    title: issue.title,
    webUrl: issue.web_url,
    state: issue.state,
  };
}

export async function executeUpdateIssue(
  params: z.infer<typeof updateIssueSchema>,
  accessToken: string
) {
  const issue = await gitlabFetch<GitLabIssue>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues/${params.issueIid}`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        labels: params.labels,
        state_event: params.stateEvent,
      }),
    }
  );
  return {
    id: issue.id,
    iid: issue.iid,
    title: issue.title,
    state: issue.state,
    webUrl: issue.web_url,
  };
}

export async function executeAddIssueComment(
  params: z.infer<typeof addIssueCommentSchema>,
  accessToken: string
) {
  const note = await gitlabFetch<{ id: number; body: string; author: { username: string }; created_at: string }>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues/${params.issueIid}/notes`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ body: params.body }),
    }
  );
  return {
    id: note.id,
    body: note.body,
    author: note.author?.username,
    createdAt: note.created_at,
  };
}

// Factory function to create AI SDK v6 compatible tools
export function createGitLabTools(accessToken: string, modelId?: string) {
  return {
    list_projects: tool({
      description: 'List GitLab projects the user has access to',
      inputSchema: listProjectsSchema,
      execute: async ({ search, owned, membership, perPage }) => 
        executeListProjects({ search, owned, membership, perPage }, accessToken),
    }),
    get_project: tool({
      description: 'Get detailed information about a specific GitLab project. You MUST provide the projectId parameter - either the numeric ID (e.g., 67612828) or the URL-encoded path (e.g., "necrokings/mcp"). Use list_projects first to find project IDs.',
      inputSchema: getProjectSchema,
      execute: async ({ projectId }) => 
        executeGetProject({ projectId }, accessToken),
    }),
    search_issues: tool({
      description: 'Search for issues in a GitLab project. You MUST provide the projectId parameter.',
      inputSchema: searchIssuesSchema,
      execute: async ({ projectId, search, state, labels, assigneeId, perPage }) => 
        executeSearchIssues({ projectId, search, state, labels, assigneeId, perPage }, accessToken),
    }),
    get_issue: tool({
      description: 'Get detailed information about a specific issue. You MUST provide both projectId and issueIid.',
      inputSchema: getIssueSchema,
      execute: async ({ projectId, issueIid }) => 
        executeGetIssue({ projectId, issueIid }, accessToken),
    }),
    // NOTE: create_issue tool removed - ticket creation uses JSON widget + API route instead
    update_issue: tool({
      description: 'Update an existing issue. You MUST provide projectId and issueIid.',
      inputSchema: updateIssueSchema,
      execute: async ({ projectId, issueIid, title, description, labels, stateEvent }) => 
        executeUpdateIssue({ projectId, issueIid, title, description, labels, stateEvent }, accessToken),
    }),
    add_issue_comment: tool({
      description: 'Add a comment/note to an issue. You MUST provide projectId, issueIid, and body.',
      inputSchema: addIssueCommentSchema,
      execute: async ({ projectId, issueIid, body }) => 
        executeAddIssueComment({ projectId, issueIid, body }, accessToken),
    }),
    research_project: tool({
      description: 'Perform comprehensive research on a GitLab project. This tool spawns a research sub-agent that gathers detailed information including project metadata, open issues, README content, and repository structure. Use this when you need thorough understanding of a project. You MUST provide the projectId.',
      inputSchema: z.object({
        projectId: z.union([z.string(), z.number()]).describe('Project ID (number) or URL-encoded path'),
      }),
      execute: async ({ projectId }) => {
        // Dynamically import to avoid circular dependencies
        const { researchProject } = await import('@/lib/ai/agents/research-agent');
        return researchProject(projectId, accessToken, modelId);
      },
    }),
  };
}
