'use client';

import { useMemo, useState, useCallback } from 'react';
import { IssueWidget } from '@/components/widgets/IssueWidget';
import { BulkTicketModal, type TicketAssignment } from '@/components/widgets/BulkTicketModal';
import { ticketResponseSchema, type Ticket } from '@/lib/ai/schemas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { Check, Copy, Layers } from 'lucide-react';

interface ArtifactRendererProps {
  content: string;
  chatId?: string;
  messageId?: string;
  isReadOnly?: boolean;
  onTicketCreated?: (ticketUrl: string, ticketTitle: string) => void;
  onBulkTicketsCreated?: (results: { ticket: string; webUrl?: string }[]) => void;
}

export function ArtifactRenderer({
  content,
  chatId,
  messageId,
  isReadOnly = false,
  onTicketCreated,
  onBulkTicketsCreated,
}: ArtifactRendererProps) {
  const parts = useMemo(() => parseContent(content), [content]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTickets, setBulkTickets] = useState<Ticket[]>([]);
  const [isCreatingBulk, setIsCreatingBulk] = useState(false);

  // Track edited tickets - key is ticket id or index, value is the updated ticket
  const [editedTickets, setEditedTickets] = useState<Map<string, Ticket>>(new Map());

  // Handle ticket update from IssueWidget
  const handleTicketUpdate = useCallback(
    async (ticketKey: string, updatedTicket: Ticket) => {
      console.log(
        '[ArtifactRenderer] handleTicketUpdate called, key:',
        ticketKey,
        'labels:',
        updatedTicket.labels,
      );

      // Update local state immediately
      setEditedTickets((prev) => {
        const next = new Map(prev);
        next.set(ticketKey, updatedTicket);
        return next;
      });

      // Persist to database if we have chatId and messageId
      if (chatId && messageId) {
        try {
          // Reconstruct the full message content with updated ticket
          // We need to update the JSON block in the message content
          const updatedContent = updateContentWithTicket(content, ticketKey, updatedTicket);

          const response = await fetch('/api/messages/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, messageId, content: updatedContent }),
          });

          if (response.ok) {
            console.log('[ArtifactRenderer] Ticket edit persisted to database');
          } else {
            console.error(
              '[ArtifactRenderer] Failed to persist ticket edit:',
              await response.text(),
            );
          }
        } catch (error) {
          console.error('[ArtifactRenderer] Error persisting ticket edit:', error);
        }
      }
    },
    [chatId, messageId, content],
  );

  const handleOpenBulkModal = useCallback(
    (tickets: Ticket[]) => {
      // Use edited versions of tickets if available
      const ticketsWithEdits = tickets.map((ticket, i) => {
        const ticketKey = ticket.id || `ticket-${i}`;
        return editedTickets.get(ticketKey) || ticket;
      });
      setBulkTickets(ticketsWithEdits);
      setShowBulkModal(true);
    },
    [editedTickets],
  );

  const handleBulkCreate = useCallback(
    async (assignments: TicketAssignment[]) => {
      setIsCreatingBulk(true);
      console.log('[ArtifactRenderer] Starting bulk create with', assignments.length, 'tickets');
      try {
        const response = await fetch('/api/gitlab/issues/bulk-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickets: assignments }),
        });

        console.log('[ArtifactRenderer] Bulk create response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[ArtifactRenderer] Bulk create response data:', data);
          setShowBulkModal(false);

          // Notify parent about created tickets
          if (onBulkTicketsCreated && data.results) {
            const successResults = data.results.filter((r: { success: boolean }) => r.success);
            console.log(
              '[ArtifactRenderer] Calling onBulkTicketsCreated with',
              successResults.length,
              'results',
            );
            onBulkTicketsCreated(successResults);
          } else {
            console.log('[ArtifactRenderer] No onBulkTicketsCreated callback or no results');
          }
        } else {
          console.error('[ArtifactRenderer] Bulk create failed:', await response.text());
        }
      } catch (error) {
        console.error('[ArtifactRenderer] Failed to create bulk tickets:', error);
      } finally {
        setIsCreatingBulk(false);
      }
    },
    [onBulkTicketsCreated],
  );

  return (
    <div className="space-y-4">
      {parts.map((part, index) => {
        if (part.type === 'ticket-response') {
          const hasMultipleTickets = part.data.tickets.length > 1;

          return (
            <div key={index} className="space-y-4 my-2">
              {part.data.reasoning && (
                <div className="text-sm text-zinc-600 dark:text-zinc-400 italic border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                  {part.data.reasoning}
                </div>
              )}

              {/* Create All button for multiple tickets */}
              {hasMultipleTickets && !isReadOnly && (
                <button
                  onClick={() => handleOpenBulkModal(part.data.tickets)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl"
                >
                  <Layers className="w-4 h-4" />
                  Create All {part.data.tickets.length} Tickets
                </button>
              )}

              <div className="grid gap-4">
                {part.data.tickets.map((ticket, i) => {
                  const ticketKey = ticket.id || `ticket-${i}`;
                  const displayTicket = editedTickets.get(ticketKey) || ticket;
                  return (
                    <IssueWidget
                      key={ticketKey}
                      issue={displayTicket}
                      status="draft"
                      isReadOnly={isReadOnly}
                      onTicketCreated={onTicketCreated}
                      onUpdate={(updated) => handleTicketUpdate(ticketKey, updated)}
                    />
                  );
                })}
              </div>

              {part.data.needsClarification &&
                part.data.clarificationQuestions &&
                part.data.clarificationQuestions.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Clarification Needed:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-amber-700 dark:text-amber-300">
                      {part.data.clarificationQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          );
        }

        return <MarkdownContent key={index} content={part.content} />;
      })}

      {/* Bulk Ticket Modal */}
      <BulkTicketModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        tickets={bulkTickets}
        onCreateAll={handleBulkCreate}
        isCreating={isCreatingBulk}
      />
    </div>
  );
}

// Detection logic
interface TicketResponse {
  type: 'tickets';
  tickets: TicketResponseTicket[];
  reasoning?: string;
  needsClarification?: boolean;
  clarificationQuestions?: string[];
}

// Partial ticket type match - uses Ticket from schemas
type TicketResponseTicket = Ticket;

type ContentPart =
  | { type: 'markdown'; content: string }
  | { type: 'ticket-response'; data: TicketResponse };

// Attempt to repair common JSON issues from AI output
function repairJson(jsonString: string): string {
  let repaired = jsonString;

  // Fix double quotes like ""id" -> "id"
  repaired = repaired.replace(/""(\w)/g, '"$1');

  // Fix trailing commas before closing brackets/braces
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Fix missing quotes around property names (simple cases)
  repaired = repaired.replace(/{\s*(\w+)\s*:/g, '{"$1":');
  repaired = repaired.replace(/,\s*(\w+)\s*:/g, ',"$1":');

  return repaired;
}

// Helper to update the content with an edited ticket
function updateContentWithTicket(
  content: string,
  ticketKey: string,
  updatedTicket: Ticket,
): string {
  const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;

  return content.replace(jsonBlockRegex, (match, jsonStr) => {
    try {
      const repairedJson = repairJson(jsonStr);
      const jsonContent = JSON.parse(repairedJson);
      const result = ticketResponseSchema.safeParse(jsonContent);

      if (result.success && result.data.type === 'tickets') {
        // Find and update the ticket
        const updatedTickets = result.data.tickets.map((ticket, i) => {
          const key = ticket.id || `ticket-${i}`;
          if (key === ticketKey) {
            return updatedTicket;
          }
          return ticket;
        });

        // Reconstruct the JSON response
        const updatedData = {
          ...result.data,
          tickets: updatedTickets,
        };

        return '```json\n' + JSON.stringify(updatedData, null, 2) + '\n```';
      }
    } catch (e) {
      console.warn('[ArtifactRenderer] Failed to update JSON block:', e);
    }

    // Return original if parsing failed
    return match;
  });
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];

  // Regex to find JSON code blocks
  const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;

  let lastIndex = 0;
  let match;

  while ((match = jsonBlockRegex.exec(content)) !== null) {
    // Content before the block
    if (match.index > lastIndex) {
      parts.push({
        type: 'markdown',
        content: content.slice(lastIndex, match.index),
      });
    }

    try {
      // Try to repair common JSON issues before parsing
      const repairedJson = repairJson(match[1]);
      const jsonContent = JSON.parse(repairedJson);
      const result = ticketResponseSchema.safeParse(jsonContent);

      if (result.success && result.data.type === 'tickets') {
        parts.push({
          type: 'ticket-response',
          data: result.data as TicketResponse,
        });
      } else {
        // If not our specific schema, treat as regular markdown code block
        parts.push({
          type: 'markdown',
          content: match[0],
        });
      }
    } catch (e) {
      // If repair didn't help, log the error for debugging
      console.warn('[ArtifactRenderer] Failed to parse JSON block:', e);
      // Failed to parse JSON, treat as markdown
      parts.push({
        type: 'markdown',
        content: match[0],
      });
    }

    lastIndex = jsonBlockRegex.lastIndex;
  }

  // Remaining content
  if (lastIndex < content.length) {
    parts.push({
      type: 'markdown',
      content: content.slice(lastIndex),
    });
  }

  return parts;
}

// Reusing MarkdownContent logic (could be extracted to shared component)
function MarkdownContent({ content }: { content: string }) {
  const { resolvedTheme } = useTheme();

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');

          if (!match) {
            return (
              <code
                className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 text-[13px] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="my-3 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#1e1e1e]">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-200 dark:bg-zinc-800/50 border-b border-zinc-300 dark:border-zinc-800">
                <span className="text-zinc-500 text-xs font-mono">{language}</span>
                <CopyButton code={codeString} />
              </div>
              <SyntaxHighlighter
                language={language}
                style={resolvedTheme === 'dark' ? vscDarkPlus : vs}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  background: 'transparent',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
                codeTagProps={{
                  style: {
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  },
                }}
                showLineNumbers={false}
                wrapLines={false}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          );
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-zinc-800 dark:text-zinc-200">{children}</li>;
        },
        h1({ children }) {
          return (
            <h1 className="text-xl font-semibold mt-4 mb-2 text-zinc-900 dark:text-white">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 className="text-lg font-semibold mt-4 mb-2 text-zinc-900 dark:text-white">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="text-base font-semibold mt-3 mb-1.5 text-zinc-900 dark:text-white">
              {children}
            </h3>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 my-3 text-zinc-600 dark:text-zinc-400 italic">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          );
        },
        strong({ children }) {
          return (
            <strong className="font-semibold text-zinc-900 dark:text-white">{children}</strong>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-white rounded transition-colors"
      title="Copy code"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}
