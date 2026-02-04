import { tool } from "ai";
import { z } from "zod";
import { updateUserSettings } from "@/lib/db/client";

const GITLAB_URL = process.env.GITLAB_URL || "https://gitlab.com";

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

interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  web_url: string;
  author: { username: string } | null;
  created_at: string;
}

// Helper to make authenticated GitLab API requests
// Helper to make authenticated GitLab API requests with retry
export async function gitlabFetch<T>(
  endpoint: string,
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
  options: RequestInit = {},
): Promise<T> {
  const makeRequest = (token: string) =>
    fetch(`${GITLAB_URL}/api/v4${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

  let response = await makeRequest(tokens.accessToken);

  // Handle 401 Unauthorized by attempting refresh
  if (response.status === 401) {
    console.log(
      "[GitLab] Received 401. Refresh Token present?",
      !!tokens.refreshToken,
      "UserId present?",
      !!tokens.userId,
    );

    if (tokens.refreshToken && tokens.userId) {
      console.log("[GitLab] Attempting token refresh...");
      try {
        const payload = {
          client_id: process.env.GITLAB_CLIENT_ID || process.env.GITLAB_APP_ID,
          client_secret:
            process.env.GITLAB_CLIENT_SECRET || process.env.GITLAB_APP_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
          redirect_uri:
            process.env.GITLAB_REDIRECT_URI ||
            (process.env.NEXTAUTH_URL || "http://localhost:3000") +
              "/api/gitlab/callback",
        };
        console.log(
          "[GitLab] Refresh payload redirect_uri:",
          payload.redirect_uri,
        );

        const refreshResponse = await fetch(`${GITLAB_URL}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        console.log(
          "[GitLab] Refresh response status:",
          refreshResponse.status,
        );

        if (refreshResponse.ok) {
          const newTokens = await refreshResponse.json();
          console.log("[GitLab] Token refreshed successfully");

          // Update DB
          await updateUserSettings(tokens.userId, {
            gitlabAccessToken: newTokens.access_token,
            gitlabRefreshToken: newTokens.refresh_token,
            gitlabTokenExpiry: new Date(
              Date.now() + newTokens.expires_in * 1000,
            ).toISOString(),
          });

          // Retry with new token
          response = await makeRequest(newTokens.access_token);
        } else {
          console.error(
            "[GitLab] Refresh failed with status:",
            refreshResponse.status,
          );
          console.error(
            "[GitLab] Refresh error body:",
            await refreshResponse.text(),
          );
        }
      } catch (error) {
        console.error("[GitLab] Refresh execution error:", error);
      }
    } else {
      console.warn("[GitLab] Cannot refresh: Missing refresh token or userId");
    }
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitLab API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool parameter schemas
export const listProjectsSchema = z.object({
  search: z.string().optional().describe("Search query to filter projects"),
  owned: z
    .boolean()
    .optional()
    .describe("Only show projects owned by the user"),
  membership: z
    .boolean()
    .optional()
    .describe("Only show projects where user is a member"),
  perPage: z
    .number()
    .optional()
    .default(20)
    .describe("Number of results per page"),
});

export const getProjectSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe(
      'REQUIRED: Project ID (number like 67612828) or URL-encoded path (like "necrokings/mcp")',
    ),
});

export const searchIssuesSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe("Project ID or URL-encoded path"),
  search: z
    .string()
    .optional()
    .describe("Search query for issue title/description"),
  state: z.enum(["opened", "closed", "all"]).optional().default("opened"),
  labels: z.string().optional().describe("Comma-separated list of labels"),
  assigneeId: z.number().optional().describe("Assignee user ID"),
  perPage: z.number().optional().default(20),
});

export const getIssueSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe("Project ID or URL-encoded path"),
  issueIid: z.number().describe("Issue IID (not ID)"),
});

export const createIssueSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe("Project ID or URL-encoded path"),
  title: z.string().describe("Issue title"),
  description: z
    .string()
    .optional()
    .describe("Issue description (Markdown supported)"),
  labels: z.string().optional().describe("Comma-separated list of labels"),
  assigneeIds: z
    .array(z.number())
    .optional()
    .describe("Array of assignee user IDs"),
  milestoneId: z.number().optional().describe("Milestone ID"),
  dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
});

export const updateIssueSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe("Project ID or URL-encoded path"),
  issueIid: z.number().describe("Issue IID"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  labels: z.string().optional().describe("New labels (comma-separated)"),
  stateEvent: z
    .enum(["close", "reopen"])
    .optional()
    .describe("State change event"),
});

export const addIssueCommentSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe("Project ID or URL-encoded path"),
  issueIid: z.number().describe("Issue IID"),
  body: z.string().describe("Comment text (Markdown supported)"),
});

export const searchGitLabSchema = z.object({
  query: z.string().describe("Search term"),
  type: z
    .enum(["projects", "issues", "merge_requests"])
    .default("projects")
    .describe("Type of resource to search"),
});

export const getFileContentSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID or path"),
  filePath: z
    .string()
    .describe('Path to file in repository (e.g., "README.md")'),
  ref: z
    .string()
    .optional()
    .describe("Branch or commit ref, defaults to default branch"),
});

export const listRepoFilesSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID or path"),
  path: z.string().optional().describe("Path inside repository to list"),
  recursive: z.boolean().optional().describe("List files recursively"),
});

export const searchCodeSchema = z.object({
  projectId: z
    .union([z.string(), z.number()])
    .describe("Project ID or URL-encoded path"),
  search: z.string().describe("The code term to search for"),
});

// Tool executor functions
export async function executeListProjects(
  params: z.infer<typeof listProjectsSchema>,
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.owned) searchParams.set("owned", "true");
  // Default to membership=true to only show projects user has access to
  // unless explicitly set to false
  const showMembership = params.membership !== false;
  if (showMembership) searchParams.set("membership", "true");
  searchParams.set("per_page", String(params.perPage || 20));

  const projects = await gitlabFetch<GitLabProject[]>(
    `/projects?${searchParams}`,
    tokens,
  );
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
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const project = await gitlabFetch<GitLabProject>(
    `/projects/${encodeURIComponent(String(params.projectId))}`,
    tokens,
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
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.state) searchParams.set("state", params.state);
  if (params.labels) searchParams.set("labels", params.labels);
  if (params.assigneeId)
    searchParams.set("assignee_id", String(params.assigneeId));
  searchParams.set("per_page", String(params.perPage || 20));

  const issues = await gitlabFetch<GitLabIssue[]>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues?${searchParams}`,
    tokens,
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
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const issue = await gitlabFetch<GitLabIssue>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues/${params.issueIid}`,
    tokens,
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
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const issue = await gitlabFetch<GitLabIssue>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues`,
    tokens,
    {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        labels: params.labels,
        assignee_ids: params.assigneeIds,
        milestone_id: params.milestoneId,
        due_date: params.dueDate,
      }),
    },
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
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const issue = await gitlabFetch<GitLabIssue>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues/${params.issueIid}`,
    tokens,
    {
      method: "PUT",
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        labels: params.labels,
        state_event: params.stateEvent,
      }),
    },
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
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const note = await gitlabFetch<{
    id: number;
    body: string;
    author: { username: string };
    created_at: string;
  }>(
    `/projects/${encodeURIComponent(String(params.projectId))}/issues/${params.issueIid}/notes`,
    tokens,
    {
      method: "POST",
      body: JSON.stringify({ body: params.body }),
    },
  );
  return {
    id: note.id,
    body: note.body,
    author: note.author?.username,
    createdAt: note.created_at,
  };
}

export async function executeSearchGitLab(
  params: z.infer<typeof searchGitLabSchema>,
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  const searchParams = new URLSearchParams();
  searchParams.set("search", params.query);
  searchParams.set("per_page", "20");

  if (params.type === "projects") {
    searchParams.set("membership", "true"); // Default to visible projects
    const projects = await gitlabFetch<GitLabProject[]>(
      `/projects?${searchParams}`,
      tokens,
    );
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path_with_namespace,
      webUrl: p.web_url,
      description: p.description,
    }));
  } else if (params.type === "issues") {
    searchParams.set("scope", "all"); // Search all accessible issues
    const issues = await gitlabFetch<GitLabIssue[]>(
      `/issues?${searchParams}`,
      tokens,
    );
    return issues.map((i) => ({
      id: i.id,
      iid: i.iid,
      title: i.title,
      state: i.state,
      webUrl: i.web_url,
      author: i.author?.username,
    }));
  } else if (params.type === "merge_requests") {
    searchParams.set("scope", "all");
    const mrs = await gitlabFetch<GitLabMergeRequest[]>(
      `/merge_requests?${searchParams}`,
      tokens,
    );
    return mrs.map((mr) => ({
      id: mr.id,
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      webUrl: mr.web_url,
      author: mr.author?.username,
    }));
  }
  return [];
}

export async function executeGetFileContent(
  params: z.infer<typeof getFileContentSchema>,
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  try {
    const projectPath = encodeURIComponent(String(params.projectId));
    const filePath = encodeURIComponent(params.filePath);
    const ref = params.ref ? `&ref=${encodeURIComponent(params.ref)}` : "";

    const data = await gitlabFetch<{ content: string; file_name: string }>(
      `/projects/${projectPath}/repository/files/${filePath}?${ref}`,
      tokens,
    );

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { content, fileName: data.file_name };
  } catch (error) {
    return { error: `Error fetching file: ${error}` };
  }
}

export async function executeListRepoFiles(
  params: z.infer<typeof listRepoFilesSchema>,
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  try {
    const projectPath = encodeURIComponent(String(params.projectId));
    const pathParam = params.path
      ? `&path=${encodeURIComponent(params.path)}`
      : "";
    const recursive = params.recursive ? "&recursive=true" : "";

    const data = await gitlabFetch<
      Array<{ name: string; path: string; type: string }>
    >(
      `/projects/${projectPath}/repository/tree?per_page=50${pathParam}${recursive}`,
      tokens,
    );

    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type, // 'blob' for files, 'tree' for directories
    }));
  } catch (error) {
    return { error: `Error listing files: ${error}` };
  }
}

export async function executeSearchCode(
  params: z.infer<typeof searchCodeSchema>,
  tokens: { accessToken: string; refreshToken?: string; userId?: string },
) {
  try {
    const projectPath = encodeURIComponent(String(params.projectId));
    const searchParams = new URLSearchParams();
    searchParams.set("scope", "blobs");
    searchParams.set("search", params.search);

    // Per page limit
    searchParams.set("per_page", "10");

    const data = await gitlabFetch<
      Array<{
        basename: string;
        data: string;
        path: string;
        filename: string;
        ref: string;
        startline: number;
      }>
    >(`/projects/${projectPath}/search?${searchParams}`, tokens);

    return data.map((item) => ({
      filename: item.filename || item.path,
      path: item.path,
      ref: item.ref,
      startLine: item.startline,
      // Note: API returns 'data' which is the matching line or blob
      content: item.data,
    }));
  } catch (error) {
    return { error: `Error searching code: ${error}` };
  }
}

// Factory function to create AI SDK v6 compatible tools
export function createGitLabTools(
  tokens:
    | { accessToken: string; refreshToken?: string; userId?: string }
    | string,
  modelId?: string,
) {
  const tokenData =
    typeof tokens === "string" ? { accessToken: tokens } : tokens;

  return {
    list_projects: tool({
      description: "List GitLab projects the user has access to",
      inputSchema: listProjectsSchema,
      execute: async ({ search, owned, membership, perPage }) =>
        executeListProjects({ search, owned, membership, perPage }, tokenData),
    }),
    search_gitlab: tool({
      description:
        "Global search across all GitLab projects. Can search for projects, issues, or merge requests.",
      inputSchema: searchGitLabSchema,
      execute: async ({ query, type }) =>
        executeSearchGitLab({ query, type }, tokenData),
    }),
    get_project: tool({
      description:
        'Get detailed information about a specific GitLab project. You MUST provide the projectId parameter - either the numeric ID (e.g., 67612828) or the URL-encoded path (e.g., "necrokings/mcp"). Use list_projects first to find project IDs.',
      inputSchema: getProjectSchema,
      execute: async ({ projectId }) =>
        executeGetProject({ projectId }, tokenData),
    }),
    search_issues: tool({
      description:
        "Search for issues in a GitLab project. You MUST provide the projectId parameter.",
      inputSchema: searchIssuesSchema,
      execute: async ({
        projectId,
        search,
        state,
        labels,
        assigneeId,
        perPage,
      }) =>
        executeSearchIssues(
          { projectId, search, state, labels, assigneeId, perPage },
          tokenData,
        ),
    }),
    get_issue: tool({
      description:
        "Get detailed information about a specific issue. You MUST provide both projectId and issueIid.",
      inputSchema: getIssueSchema,
      execute: async ({ projectId, issueIid }) =>
        executeGetIssue({ projectId, issueIid }, tokenData),
    }),
    // NOTE: create_issue tool removed - ticket creation uses JSON widget + API route instead
    update_issue: tool({
      description:
        "Update an existing issue. You MUST provide projectId and issueIid.",
      inputSchema: updateIssueSchema,
      execute: async ({
        projectId,
        issueIid,
        title,
        description,
        labels,
        stateEvent,
      }) =>
        executeUpdateIssue(
          { projectId, issueIid, title, description, labels, stateEvent },
          tokenData,
        ),
    }),
    add_issue_comment: tool({
      description:
        "Add a comment/note to an issue. You MUST provide projectId, issueIid, and body.",
      inputSchema: addIssueCommentSchema,
      execute: async ({ projectId, issueIid, body }) =>
        executeAddIssueComment({ projectId, issueIid, body }, tokenData),
    }),
    get_file_content: tool({
      description:
        "Read a file from the repository (e.g., README.md, package.json, etc.)",
      inputSchema: getFileContentSchema,
      execute: async (params) => executeGetFileContent(params, tokenData),
    }),
    list_repository_files: tool({
      description:
        "List files and directories in the repository to understand project structure",
      inputSchema: listRepoFilesSchema,
      execute: async (params) => executeListRepoFiles(params, tokenData),
    }),
    search_code: tool({
      description:
        "Search for code blobs within a specific project. Useful for finding usages, definitions, or specific text in code.",
      inputSchema: searchCodeSchema,
      execute: async (params) => executeSearchCode(params, tokenData),
    }),
    research_project: tool({
      description:
        "Perform comprehensive research on a GitLab project. This tool spawns a research sub-agent that gathers detailed information including project metadata, open issues, README content, and repository structure. IMPORTANT: If you do not have a specific projectId, use the search_gitlab tool first to resolve the project name to an ID. Use this when you need thorough understanding of a project. You MUST provide the projectId.",
      inputSchema: z.object({
        projectId: z
          .union([z.string(), z.number()])
          .describe("Project ID (number) or URL-encoded path"),
      }),
      execute: async ({ projectId }) => {
        // Dynamically import to avoid circular dependencies
        const { researchProject } =
          await import("@/lib/ai/agents/research-agent");
        return researchProject(projectId, tokenData.accessToken, modelId);
      },
    }),
  };
}
