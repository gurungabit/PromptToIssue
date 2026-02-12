import { generateText, tool, stepCountIs } from 'ai';

import { getModel } from '@/lib/ai/models/registry';
import {
  executeGetProject,
  executeSearchIssues,
  executeGetFileContent,
  executeListRepoFiles,
  getProjectSchema,
  searchIssuesSchema,
  getFileContentSchema,
  listRepoFilesSchema,
} from '@/lib/mcp/gitlab-tools';

// File content and list repo files functions moved to gitlab-tools.ts

// Research step tracking for streaming and persistence
export interface ResearchStep {
  toolName: string;
  status: 'running' | 'completed' | 'error';
}

// Writer interface for streaming custom data parts (matches AI SDK's UIMessageStreamWriter)
interface StreamWriter {
  write: (part: {
    type: `data-${string}`;
    data: unknown;
    id?: string;
    transient?: boolean;
  }) => void;
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
  toolsUsed: ResearchStep[];
}

/**
 * Research Agent - A sub-agent that autonomously researches a GitLab project
 *
 * This agent has its own context and makes tool calls independently to gather
 * comprehensive information about a project without overloading the main agent.
 */
export async function researchProject(
  projectId: string | number,
  tokens: { accessToken: string; refreshToken?: string; userId?: string } | string,
  modelId?: string,
  writer?: StreamWriter,
): Promise<ResearchResult> {
  const tokenData = typeof tokens === 'string' ? { accessToken: tokens } : tokens;

  // Get the model for research (default to a capable model)
  const model = getModel(modelId || 'qwen3-8b');

  // Create research-specific tools
  const researchTools = {
    get_project_details: tool({
      description:
        'Get detailed information about the project including metadata, stats, and activity',
      inputSchema: getProjectSchema,
      execute: async ({ projectId: pid }) => executeGetProject({ projectId: pid }, tokenData),
    }),

    search_project_issues: tool({
      description: 'Search for issues in the project. Can filter by state (opened/closed/all)',
      inputSchema: searchIssuesSchema,
      execute: async (params) => executeSearchIssues(params, tokenData),
    }),

    get_file_content: tool({
      description: 'Read a file from the repository (e.g., README.md, package.json, etc.)',
      inputSchema: getFileContentSchema,
      execute: async (params) => executeGetFileContent(params, tokenData),
    }),

    list_repository_files: tool({
      description: 'List files and directories in the repository to understand project structure',
      inputSchema: listRepoFilesSchema,
      execute: async (params) => executeListRepoFiles(params, tokenData),
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

  // Track tools used for persistence
  const toolsUsed: ResearchStep[] = [];

  // Run the research agent
  const result = await generateText({
    model,
    system: researchSystemPrompt,
    prompt: `Research the GitLab project with ID: ${projectId}. Gather comprehensive information about it and provide a detailed summary.`,
    tools: researchTools,
    stopWhen: stepCountIs(20), // Allow up to 20 steps for thorough research
    onStepFinish: ({ toolCalls, toolResults }) => {
      // Stream running status for each tool call
      if (toolCalls) {
        for (const tc of toolCalls) {
          const step: ResearchStep = { toolName: tc.toolName, status: 'running' };
          toolsUsed.push(step);
          if (writer) {
            writer.write({
              type: 'data-research-step',
              data: step,
            });
          }
        }
      }
      // Stream completed status for each tool result
      if (toolResults) {
        for (const tr of toolResults) {
          // Update the existing step to completed
          const existing = toolsUsed.find(
            (s) => s.toolName === tr.toolName && s.status === 'running',
          );
          if (existing) {
            existing.status = 'completed';
          }
          if (writer) {
            writer.write({
              type: 'data-research-step',
              data: { toolName: tr.toolName, status: 'completed' },
            });
          }
        }
      }
    },
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
      if (
        toolResult.toolName === 'get_project_details' &&
        'output' in toolResult &&
        toolResult.output
      ) {
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

      if (
        toolResult.toolName === 'search_project_issues' &&
        'output' in toolResult &&
        Array.isArray(toolResult.output)
      ) {
        issues = (
          toolResult.output as Array<{
            iid: number;
            title: string;
            state: string;
            labels: string[];
          }>
        )
          .slice(0, 10)
          .map((i) => ({
            iid: i.iid,
            title: i.title,
            state: i.state,
            labels: i.labels,
          }));
      }

      if (
        toolResult.toolName === 'get_file_content' &&
        'output' in toolResult &&
        toolResult.output
      ) {
        const fileResult = toolResult.output as {
          content?: string;
          fileName?: string;
          error?: string;
        };
        if (fileResult.content && fileResult.fileName?.toLowerCase().includes('readme')) {
          // Truncate README to avoid huge responses
          readme = fileResult.content.slice(0, 2000);
          if (fileResult.content.length > 2000) {
            readme += '\n\n... [truncated]';
          }
        }
      }

      if (
        toolResult.toolName === 'list_repository_files' &&
        'output' in toolResult &&
        Array.isArray(toolResult.output)
      ) {
        filesOverview = (toolResult.output as Array<{ path: string; type: string }>)
          .slice(0, 20)
          .map((f) => `${f.type === 'tree' ? '📁' : '📄'} ${f.path}`);
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
      summary = projectInfo?.name
        ? `Research completed for ${projectInfo.name}`
        : 'Research completed';
      researchNotes = text;
    }
  } catch {
    summary = projectInfo?.name
      ? `Research completed for ${projectInfo.name}`
      : 'Research completed';
    researchNotes = text;
  }

  return {
    summary,
    projectInfo,
    issues,
    readme,
    filesOverview,
    researchNotes,
    toolsUsed,
  };
}
