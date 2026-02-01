import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/models/registry';
import {
  executeGetProject,
  executeSearchIssues,
  getProjectSchema,
  searchIssuesSchema,
} from '@/lib/mcp/gitlab-tools';

// Schema for file content fetching
const getFileContentSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or path'),
  filePath: z.string().describe('Path to file in repository (e.g., "README.md")'),
  ref: z.string().optional().describe('Branch or commit ref, defaults to default branch'),
});

// Fetch file content from GitLab
async function fetchFileContent(
  params: z.infer<typeof getFileContentSchema>,
  accessToken: string
): Promise<{ content: string; fileName: string } | { error: string }> {
  try {
    const projectPath = encodeURIComponent(String(params.projectId));
    const filePath = encodeURIComponent(params.filePath);
    const ref = params.ref ? `&ref=${encodeURIComponent(params.ref)}` : '';
    
    const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${projectPath}/repository/files/${filePath}?${ref}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { error: `File not found: ${params.filePath}` };
      }
      return { error: `Failed to fetch file: ${response.status}` };
    }

    const data = await response.json();
    // GitLab returns base64 encoded content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, fileName: data.file_name };
  } catch (error) {
    return { error: `Error fetching file: ${error}` };
  }
}

// Schema for listing repository tree
const listRepoFilesSchema = z.object({
  projectId: z.union([z.string(), z.number()]).describe('Project ID or path'),
  path: z.string().optional().describe('Path inside repository to list'),
  recursive: z.boolean().optional().describe('List files recursively'),
});

// List repository files
async function listRepoFiles(
  params: z.infer<typeof listRepoFilesSchema>,
  accessToken: string
): Promise<Array<{ name: string; path: string; type: string }> | { error: string }> {
  try {
    const projectPath = encodeURIComponent(String(params.projectId));
    const pathParam = params.path ? `&path=${encodeURIComponent(params.path)}` : '';
    const recursive = params.recursive ? '&recursive=true' : '';
    
    const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${projectPath}/repository/tree?per_page=50${pathParam}${recursive}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return { error: `Failed to list files: ${response.status}` };
    }

    const data = await response.json();
    return data.map((item: { name: string; path: string; type: string }) => ({
      name: item.name,
      path: item.path,
      type: item.type, // 'blob' for files, 'tree' for directories
    }));
  } catch (error) {
    return { error: `Error listing files: ${error}` };
  }
}

// Research result type
export interface ResearchResult {
  summary: string;
  projectInfo: {
    name: string;
    path: string;
    description: string | null;
    visibility: string;
    openIssuesCount: number;
  } | null;
  issues: Array<{
    iid: number;
    title: string;
    state: string;
    labels: string[];
  }>;
  readme: string | null;
  filesOverview: string[];
  researchNotes: string;
}

/**
 * Research Agent - A sub-agent that autonomously researches a GitLab project
 * 
 * This agent has its own context and makes tool calls independently to gather
 * comprehensive information about a project without overloading the main agent.
 */
export async function researchProject(
  projectId: string | number,
  accessToken: string,
  modelId?: string
): Promise<ResearchResult> {
  // Get the model for research (default to a capable model)
  const model = getModel(modelId || 'gemini-2.5-flash');
  
  // Create research-specific tools
  const researchTools = {
    get_project_details: tool({
      description: 'Get detailed information about the project including metadata, stats, and activity',
      inputSchema: getProjectSchema,
      execute: async ({ projectId: pid }) => executeGetProject({ projectId: pid }, accessToken),
    }),
    
    search_project_issues: tool({
      description: 'Search for issues in the project. Can filter by state (opened/closed/all)',
      inputSchema: searchIssuesSchema,
      execute: async (params) => executeSearchIssues(params, accessToken),
    }),
    
    get_file_content: tool({
      description: 'Read a file from the repository (e.g., README.md, package.json, etc.)',
      inputSchema: getFileContentSchema,
      execute: async (params) => fetchFileContent(params, accessToken),
    }),
    
    list_repository_files: tool({
      description: 'List files and directories in the repository to understand project structure',
      inputSchema: listRepoFilesSchema,
      execute: async (params) => listRepoFiles(params, accessToken),
    }),
  };

  // The research agent's system prompt
  const researchSystemPrompt = `You are a research agent tasked with gathering comprehensive information about a GitLab project.

Your goal is to understand the project thoroughly and provide a detailed summary. You should:
1. First get the project details to understand what it is
2. Look at the repository structure to understand the codebase
3. Read the README if it exists
4. Check open issues to understand current work and problems
5. Synthesize all information into a comprehensive summary

Be efficient with your tool calls. Focus on gathering the most useful information.
After gathering information, provide a final summary in JSON format with these fields:
- summary: A 2-3 sentence overview of what this project is
- researchNotes: Detailed notes about what you found (technologies used, project purpose, activity level, etc.)`;

  // Run the research agent
  const result = await generateText({
    model,
    system: researchSystemPrompt,
    prompt: `Research the GitLab project with ID: ${projectId}. Gather comprehensive information about it and provide a detailed summary.`,
    tools: researchTools,
    stopWhen: stepCountIs(8), // Allow up to 8 steps for thorough research
  });

  // Parse the research results
  let projectInfo = null;
  let issues: ResearchResult['issues'] = [];
  let readme: string | null = null;
  let filesOverview: string[] = [];
  let summary = '';
  let researchNotes = '';

  // Extract data from tool results
  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      if (toolResult.toolName === 'get_project_details' && 'output' in toolResult && toolResult.output) {
        const proj = toolResult.output as {
          name: string;
          path: string;
          description: string | null;
          visibility: string;
          openIssuesCount: number;
        };
        projectInfo = {
          name: proj.name,
          path: proj.path,
          description: proj.description,
          visibility: proj.visibility,
          openIssuesCount: proj.openIssuesCount,
        };
      }
      
      if (toolResult.toolName === 'search_project_issues' && 'output' in toolResult && Array.isArray(toolResult.output)) {
        issues = (toolResult.output as Array<{
          iid: number;
          title: string;
          state: string;
          labels: string[];
        }>).slice(0, 10).map(i => ({
          iid: i.iid,
          title: i.title,
          state: i.state,
          labels: i.labels,
        }));
      }
      
      if (toolResult.toolName === 'get_file_content' && 'output' in toolResult && toolResult.output) {
        const fileResult = toolResult.output as { content?: string; fileName?: string; error?: string };
        if (fileResult.content && fileResult.fileName?.toLowerCase().includes('readme')) {
          // Truncate README to avoid huge responses
          readme = fileResult.content.slice(0, 2000);
          if (fileResult.content.length > 2000) {
            readme += '\n\n... [truncated]';
          }
        }
      }
      
      if (toolResult.toolName === 'list_repository_files' && 'output' in toolResult && Array.isArray(toolResult.output)) {
        filesOverview = (toolResult.output as Array<{ path: string; type: string }>)
          .slice(0, 20)
          .map(f => `${f.type === 'tree' ? '📁' : '📄'} ${f.path}`);
      }
    }
  }

  // Extract summary from the agent's final response
  const text = result.text;
  try {
    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*"summary"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      summary = parsed.summary || '';
      researchNotes = parsed.researchNotes || '';
    } else {
      // Use the raw text as notes
      summary = projectInfo?.name ? `Research completed for ${projectInfo.name}` : 'Research completed';
      researchNotes = text;
    }
  } catch {
    summary = projectInfo?.name ? `Research completed for ${projectInfo.name}` : 'Research completed';
    researchNotes = text;
  }

  return {
    summary,
    projectInfo,
    issues,
    readme,
    filesOverview,
    researchNotes,
  };
}
