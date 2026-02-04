'use client';

import { IssueWidget } from '@/components/widgets/IssueWidget';
import { ArtifactRenderer } from '@/components/chat/ArtifactRenderer';
import type { Ticket } from '@/lib/ai/schemas';

const MOCK_TICKET_OPEN: Ticket = {
  id: 'ticket-123',
  projectId: 'test/project',
  iid: 123,
  title: 'Implement Dark Mode Support',
  description:
    'The application needs to support system dark mode preference and a manual toggle. Colors should default to Zinc palette.',
  state: 'opened',
  priority: 'high',
  type: 'feature',
  estimatedHours: 8,
  acceptanceCriteria: [
    { id: 'ac-1', description: 'Respects system preference by default', completed: true },
    { id: 'ac-2', description: 'Manual toggle overrides system preference', completed: false },
    { id: 'ac-3', description: 'Persists preference across sessions', completed: false },
  ],
  tasks: [
    { id: 'task-1', description: 'Install next-themes', completed: true, estimatedHours: 1 },
    {
      id: 'task-2',
      description: 'Create ThemeToggle component',
      completed: false,
      estimatedHours: 2,
    },
    { id: 'task-3', description: 'Update Tailwind config', completed: false, estimatedHours: 1 },
  ],
  assignees: [
    { id: 1, username: 'jdoe', name: 'John Doe', avatarUrl: 'https://github.com/shadcn.png' },
  ],
  labels: ['feature', 'frontend', 'ui/ux'],
  webUrl: 'https://gitlab.com/org/project/issues/123',
};

const MOCK_TICKET_CLOSED: Ticket = {
  ...MOCK_TICKET_OPEN,
  id: 'ticket-120',
  iid: 120,
  title: 'Fix Login Bug on Safari',
  state: 'closed',
  description: 'Users report unable to login specifically on Safari 17.0.',
  type: 'bug',
  priority: 'critical',
  labels: ['bug', 'critical'],
  acceptanceCriteria: [],
  tasks: [],
};

const MOCK_TICKET_DRAFT: Ticket = {
  id: 'draft-1',
  title: 'Refactor Authentication Layer',
  description: 'Move from custom JWT to NextAuth.js for better security and provider support.',
  state: 'opened', // Drafts are technically open
  priority: 'medium',
  type: 'refactor',
  estimatedHours: 16,
  acceptanceCriteria: [{ id: 'ac-1', description: 'All existing tests pass', completed: false }],
  tasks: [],
  labels: ['tech-debt', 'backend'],
};

const MOCK_AI_RESPONSE = `
Here is the ticket for the authentication refactor:

\`\`\`json
{
  "type": "tickets",
  "tickets": [
    {
      "id": "generated-1",
      "title": "AI Generated Ticket: Auth Refactor",
      "description": "This ticket was parsed dynamically from a JSON block in the parsed content. It confirms the ArtifactRenderer is working.",
      "priority": "high",
      "type": "refactor",
      "state": "opened", 
      "acceptanceCriteria": [
        { "id": "ac1", "description": "Parsed correctly", "completed": true }
      ],
      "tasks": []
    }
  ],
  "reasoning": "I have created this ticket based on our conversation about security improvements."
}
\`\`\`

Please review the details above.
`;

export default function WidgetTestPage() {
  function handleUpdate(issue: Ticket) {
    console.log('Issue updated:', issue);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 space-y-12">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Ticket Widget Test (Advanced Schema)
        </h1>
        <p className="text-zinc-500">Manual verification of widget states and data types.</p>
      </div>

      {/* Existing Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pb-12 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-500">Open Ticket</h2>
          <IssueWidget issue={MOCK_TICKET_OPEN} onUpdate={handleUpdate} />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-500">Draft Ticket (Editable)</h2>
          <IssueWidget issue={MOCK_TICKET_DRAFT} status="draft" onUpdate={handleUpdate} />
        </div>
      </div>

      {/* Renderer Test */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Artifact Renderer Test</h2>
        <p className="text-zinc-500">Simulating AI response with embedded JSON block:</p>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm max-w-3xl">
          <ArtifactRenderer content={MOCK_AI_RESPONSE} />
        </div>
      </div>
    </div>
  );
}
