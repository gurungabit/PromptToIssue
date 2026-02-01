import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { executeCreateIssue } from '@/lib/mcp/gitlab-tools';
import { ticketSchema } from '@/lib/ai/schemas';
import { z } from 'zod';

// Schema for bulk create request
const bulkCreateSchema = z.object({
  tickets: z.array(z.object({
    ticket: ticketSchema,
    projectPath: z.string(),
    projectName: z.string(),
    milestoneId: z.number().optional(),
  })),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const result = bulkCreateSchema.safeParse(body);
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid request data', details: result.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { tickets } = result.data;

    // Get Access Token
    const userSettings = await db.getUserSettings(session.user.id);
    if (!userSettings?.gitlabAccessToken) {
      return new Response(JSON.stringify({ error: 'GitLab is not connected' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create all tickets in parallel
    const createPromises = tickets.map(async ({ ticket, projectPath, milestoneId }) => {
      try {
        // Transform Ticket to GitLab Issue format
        const descriptionParts = [ticket.description || ''];

        if (ticket.acceptanceCriteria && ticket.acceptanceCriteria.length > 0) {
          descriptionParts.push('\n## Acceptance Criteria');
          ticket.acceptanceCriteria.forEach((ac) => {
            descriptionParts.push(`- [${ac.completed ? 'x' : ' '}] ${ac.description}`);
          });
        }

        if (ticket.tasks && ticket.tasks.length > 0) {
          descriptionParts.push('\n## Tasks');
          ticket.tasks.forEach((task) => {
            const time = task.estimatedHours ? ` (${task.estimatedHours}h)` : '';
            descriptionParts.push(`- [${task.completed ? 'x' : ' '}] ${task.description}${time}`);
          });
        }

        if (ticket.estimatedHours) {
          descriptionParts.push(`\n/estimate ${ticket.estimatedHours}h`);
        }

        const fullDescription = descriptionParts.join('\n');

        // Construct Labels
        const labels = new Set(ticket.labels || []);
        // Removed automatic priority/type to label conversion per user request
        // if (ticket.priority) labels.add(`priority::${ticket.priority}`);
        // if (ticket.type) labels.add(`type::${ticket.type}`);
        const labelsString = Array.from(labels).join(',');

        // Create the issue
        const createdIssue = await executeCreateIssue({
          projectId: projectPath,
          title: ticket.title,
          description: fullDescription,
          labels: labelsString,
          milestoneId: milestoneId,
        }, userSettings.gitlabAccessToken!);

        return {
          success: true,
          ticket: ticket.title,
          webUrl: createdIssue.webUrl,
          iid: createdIssue.iid,
        };
      } catch (error) {
        return {
          success: false,
          ticket: ticket.title,
          error: error instanceof Error ? error.message : 'Failed to create',
        };
      }
    });

    const results = await Promise.all(createPromises);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return new Response(JSON.stringify({
      total: tickets.length,
      successful: successful.length,
      failed: failed.length,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Bulk Create Issues API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create issues';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
