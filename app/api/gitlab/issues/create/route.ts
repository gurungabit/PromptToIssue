import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { executeCreateIssue } from '@/lib/mcp/gitlab-tools';
import { ticketSchema } from '@/lib/ai/schemas';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body against Ticket schema
    // We treat the body as the ticket object itself
    const result = ticketSchema.safeParse(body);
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid ticket data', details: result.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ticket = result.data;
    // Extract milestoneId from the request body (passed separately from modal)
    const milestoneId = body.milestoneId as number | undefined;

    // Check for Project ID (required for creation, even if optional in schema for draft)
    if (!ticket.projectId) {
      return new Response(JSON.stringify({ error: 'Project ID is required to create an issue' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Access Token
    const userSettings = await db.getUserSettings(session.user.id);
    if (!userSettings?.gitlabAccessToken) {
      return new Response(JSON.stringify({ error: 'GitLab is not connected' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Transform Ticket to GitLab Issue format
    // 1. Construct Description with ACs and Tasks
    const descriptionParts = [
      ticket.description || '',
    ];

    if (ticket.acceptanceCriteria && ticket.acceptanceCriteria.length > 0) {
      descriptionParts.push('\n### Acceptance Criteria');
      ticket.acceptanceCriteria.forEach((ac: { completed: boolean; description: string }) => {
        descriptionParts.push(`- [${ac.completed ? 'x' : ' '}] ${ac.description}`);
      });
    }

    if (ticket.tasks && ticket.tasks.length > 0) {
      descriptionParts.push('\n### Tasks');
      ticket.tasks.forEach((task: { completed: boolean; description: string; estimatedHours?: number }) => {
        const time = task.estimatedHours ? ` (${task.estimatedHours}h)` : '';
        descriptionParts.push(`- [${task.completed ? 'x' : ' '}] ${task.description}${time}`);
      });
    }
    
    // Add estimates footer if present
    if (ticket.estimatedHours) {
        descriptionParts.push(`\n/estimate ${ticket.estimatedHours}h`);
    }

    const fullDescription = descriptionParts.join('\n');

    // 2. Construct Labels (include explicit labels only)
    const labels = new Set(ticket.labels || []);
    // Removed automatic priority/type to label conversion per user request
    // if (ticket.priority) labels.add(`priority::${ticket.priority}`);
    // if (ticket.type) labels.add(`type::${ticket.type}`);
    
    const labelsString = Array.from(labels).join(',');

    // 3. Map Assignees
    const assigneeIds = ticket.assignees?.map(a => a.id).filter(Boolean) as number[] ?? [];

    // Execute GitLab Tool
    const createdIssue = await executeCreateIssue({
      projectId: ticket.projectId,
      title: ticket.title,
      description: fullDescription,
      labels: labelsString,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      milestoneId: milestoneId,
    }, userSettings.gitlabAccessToken);

    return new Response(JSON.stringify(createdIssue), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create Issue API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create issue';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
