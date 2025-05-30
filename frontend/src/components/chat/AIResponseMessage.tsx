import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TicketData, ChatMode } from '../../hooks/useChat';
import type { TicketFieldValue } from '../../types';
import CodeBlock from './CodeBlock';

interface AIResponseMessageProps {
  aiResponse: {
    response: string;
    tickets?: TicketData[];
    shouldSplit?: boolean;
    clarificationNeeded?: boolean;
  };
  editingTickets: { [key: number]: boolean };
  editedTickets: { [key: number]: TicketData };
  updateEditedTicket: (index: number, field: keyof TicketData, value: TicketFieldValue) => void;
  startEditing: (index: number, ticket: TicketData) => void;
  saveEdit: (index: number) => void;
  cancelEdit: (index: number) => void;
  cleanAIResponse: (response: string) => string;
  copyToClipboard: (text: string) => Promise<void>;
  openProjectSelector: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  mode: ChatMode;
}

const AIResponseMessage: React.FC<AIResponseMessageProps> = ({
  aiResponse,
  editingTickets,
  editedTickets,
  updateEditedTicket,
  startEditing,
  saveEdit,
  cancelEdit,
  cleanAIResponse,
  copyToClipboard,
  openProjectSelector,
  addToast,
  mode,
}) => {
  const [analysisExpanded, setAnalysisExpanded] = useState(false);

  return (
    <div className='space-y-4'>
      {/* Collapsible Initial Analysis */}
      <div className='border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800'>
        <button
          onClick={() => setAnalysisExpanded(!analysisExpanded)}
          className='w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-xl'
        >
          <div className='flex items-center space-x-3'>
            <span className='text-lg font-semibold text-gray-900 dark:text-white'>
              Initial Analysis
            </span>
            <button
              onClick={e => {
                e.stopPropagation();
                copyToClipboard(aiResponse.response);
              }}
              className='p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors'
              title='Copy AI response'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                />
              </svg>
            </button>
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${analysisExpanded ? 'rotate-180' : ''}`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
          </svg>
        </button>

        {analysisExpanded && (
          <div className='px-4 pb-4 border-t border-gray-200 dark:border-gray-600'>
            <div className='mt-3 leading-relaxed'>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className='text-xl font-bold text-gray-700 dark:text-gray-300 mb-2'>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className='text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2'>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className='text-base font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className='text-gray-700 dark:text-gray-300 mb-2'>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className='list-disc list-inside text-gray-700 dark:text-gray-300 mb-2 space-y-1'>
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className='list-decimal list-inside text-gray-700 dark:text-gray-300 mb-2 space-y-1'>
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className='text-gray-700 dark:text-gray-300'>{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className='font-semibold text-gray-700 dark:text-gray-300'>
                      {children}
                    </strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-600 dark:decoration-blue-400 hover:decoration-blue-800 dark:hover:decoration-blue-300 underline-offset-2 transition-colors duration-200 font-medium'
                    >
                      {children}
                    </a>
                  ),
                  code: props => <CodeBlock {...props} addToast={addToast} />,
                  pre: ({ children }) => <div className='my-2'>{children}</div>,
                }}
              >
                {cleanAIResponse(aiResponse.response)}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Editable User Stories */}
      {mode === 'ticket' && aiResponse?.tickets && aiResponse.tickets.length > 0 && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-xl font-semibold text-gray-900 dark:text-white'>
              Generated User Stories
            </h3>
          </div>
          <div className='space-y-4'>
            {aiResponse.tickets.map((ticket: TicketData, index: number) => {
              const isEditing = editingTickets[index];
              const currentTicket = isEditing ? editedTickets[index] : ticket;

              // Function to copy ticket content
              const copyTicket = async () => {
                const ticketText = `${ticket.title}

User Story: ${ticket.description}

Acceptance Criteria:
${ticket.acceptanceCriteria.map((criteria: string, i: number) => `${i + 1}. ${criteria}`).join('\n')}

Tasks:
${ticket.tasks.map((task: string) => `- ${task}`).join('\n')}

Priority: ${ticket.priority}
Labels: ${ticket.labels.join(', ')}`;

                try {
                  await navigator.clipboard.writeText(ticketText);
                  addToast(`Ticket "${ticket.title}" copied to clipboard!`, 'success');
                } catch (err) {
                  console.error('Failed to copy ticket: ', err);
                  addToast('Failed to copy ticket to clipboard', 'error');
                }
              };

              return (
                <div
                  key={index}
                  className='border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-gray-50 dark:bg-gray-800 hover:shadow-lg transition-shadow'
                >
                  <div className='flex items-start justify-between mb-4'>
                    {isEditing ? (
                      <input
                        type='text'
                        value={currentTicket.title}
                        onChange={e =>
                          updateEditedTicket(index, 'title', e.target.value as TicketFieldValue)
                        }
                        className='flex-1 text-lg font-semibold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white mr-4'
                      />
                    ) : (
                      <h4 className='font-semibold text-gray-900 dark:text-white text-lg flex-1'>
                        {ticket.title}
                      </h4>
                    )}
                    <div className='flex items-center space-x-2'>
                      {isEditing ? (
                        <select
                          value={currentTicket.priority}
                          onChange={e =>
                            updateEditedTicket(
                              index,
                              'priority',
                              e.target.value as TicketFieldValue
                            )
                          }
                          className='px-3 py-1 text-xs rounded-full font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                        >
                          <option value='low'>Low</option>
                          <option value='medium'>Medium</option>
                          <option value='high'>High</option>
                          <option value='critical'>Critical</option>
                        </select>
                      ) : (
                        <span
                          className={`px-3 py-1 text-xs rounded-full font-medium ${
                            ticket.priority === 'critical'
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : ticket.priority === 'high'
                                ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                                : ticket.priority === 'medium'
                                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                  : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className='mb-4'>
                    <h5 className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
                      User Story:
                    </h5>
                    {isEditing ? (
                      <textarea
                        value={currentTicket.description}
                        onChange={e =>
                          updateEditedTicket(
                            index,
                            'description',
                            e.target.value as TicketFieldValue
                          )
                        }
                        rows={3}
                        className='w-full p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white'
                      />
                    ) : (
                      <p className='text-gray-600 dark:text-gray-400 leading-relaxed italic'>
                        {ticket.description}
                      </p>
                    )}
                  </div>

                  {currentTicket.acceptanceCriteria.length > 0 && (
                    <div className='mb-4'>
                      <h5 className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
                        Acceptance Criteria:
                      </h5>
                      {isEditing ? (
                        <div className='space-y-2'>
                          {currentTicket.acceptanceCriteria.map((criteria: string, i: number) => (
                            <div key={i} className='flex items-center space-x-2'>
                              <span className='text-green-500 font-medium'>{i + 1}.</span>
                              <input
                                type='text'
                                value={criteria}
                                onChange={e => {
                                  const newCriteria = [...currentTicket.acceptanceCriteria];
                                  newCriteria[i] = e.target.value;
                                  updateEditedTicket(
                                    index,
                                    'acceptanceCriteria',
                                    newCriteria as TicketFieldValue
                                  );
                                }}
                                className='flex-1 p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white'
                              />
                              <button
                                onClick={() => {
                                  const newCriteria = currentTicket.acceptanceCriteria.filter(
                                    (_: string, idx: number) => idx !== i
                                  );
                                  updateEditedTicket(
                                    index,
                                    'acceptanceCriteria',
                                    newCriteria as TicketFieldValue
                                  );
                                }}
                                className='text-red-500 hover:text-red-700 p-1'
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newCriteria = [
                                ...currentTicket.acceptanceCriteria,
                                'New criteria',
                              ];
                              updateEditedTicket(
                                index,
                                'acceptanceCriteria',
                                newCriteria as TicketFieldValue
                              );
                            }}
                            className='text-green-600 hover:text-green-800 text-sm font-medium'
                          >
                            + Add Criteria
                          </button>
                        </div>
                      ) : (
                        <ul className='text-sm text-gray-600 dark:text-gray-400 space-y-1'>
                          {ticket.acceptanceCriteria.map((criteria: string, i: number) => (
                            <li key={i} className='flex items-start'>
                              <span className='text-green-500 mr-2 mt-1 font-medium'>{i + 1}.</span>
                              {criteria}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {currentTicket.tasks.length > 0 && (
                    <div className='mb-4'>
                      <h5 className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
                        Tasks:
                      </h5>
                      {isEditing ? (
                        <div className='space-y-2'>
                          {currentTicket.tasks.map((task: string, i: number) => (
                            <div key={i} className='flex items-center space-x-2'>
                              <span className='text-blue-500'>☐</span>
                              <input
                                type='text'
                                value={task}
                                onChange={e => {
                                  const newTasks = [...currentTicket.tasks];
                                  newTasks[i] = e.target.value;
                                  updateEditedTicket(index, 'tasks', newTasks as TicketFieldValue);
                                }}
                                className='flex-1 p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white'
                              />
                              <button
                                onClick={() => {
                                  const newTasks = currentTicket.tasks.filter(
                                    (_: string, idx: number) => idx !== i
                                  );
                                  updateEditedTicket(index, 'tasks', newTasks as TicketFieldValue);
                                }}
                                className='text-red-500 hover:text-red-700 p-1'
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newTasks = [...currentTicket.tasks, 'New task'];
                              updateEditedTicket(index, 'tasks', newTasks as TicketFieldValue);
                            }}
                            className='text-blue-600 hover:text-blue-800 text-sm font-medium'
                          >
                            + Add Task
                          </button>
                        </div>
                      ) : (
                        <ul className='text-sm text-gray-600 dark:text-gray-400 space-y-1'>
                          {ticket.tasks.map((task: string, i: number) => (
                            <li key={i} className='flex items-start'>
                              <span className='text-blue-500 mr-2 mt-1'>☐</span>
                              {task}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className='flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600'>
                    <div className='flex flex-wrap gap-2'>
                      {isEditing ? (
                        <div className='flex flex-wrap gap-2 items-center'>
                          {currentTicket.labels.map((label: string, i: number) => (
                            <div
                              key={i}
                              className='flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1'
                            >
                              <input
                                type='text'
                                value={label}
                                onChange={e => {
                                  const newLabels = [...currentTicket.labels];
                                  newLabels[i] = e.target.value;
                                  updateEditedTicket(
                                    index,
                                    'labels',
                                    newLabels as TicketFieldValue
                                  );
                                }}
                                className='bg-transparent text-xs text-gray-900 dark:text-white border-none outline-none w-16'
                              />
                              <button
                                onClick={() => {
                                  const newLabels = currentTicket.labels.filter(
                                    (_: string, idx: number) => idx !== i
                                  );
                                  updateEditedTicket(
                                    index,
                                    'labels',
                                    newLabels as TicketFieldValue
                                  );
                                }}
                                className='text-red-500 hover:text-red-700 text-xs'
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newLabels = [...currentTicket.labels, 'new-label'];
                              updateEditedTicket(index, 'labels', newLabels as TicketFieldValue);
                            }}
                            className='text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 border border-dashed border-blue-300 rounded'
                          >
                            + Add Label
                          </button>
                        </div>
                      ) : (
                        currentTicket.labels.map((label: string, i: number) => (
                          <span
                            key={i}
                            className={`px-3 py-1 text-xs rounded-full font-medium ${
                              label === 'user-story'
                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                : label === 'frontend'
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                  : label === 'backend'
                                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                    : label === 'database'
                                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200'
                                      : label === 'authentication'
                                        ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {label}
                          </span>
                        ))
                      )}
                    </div>

                    <div className='flex items-center space-x-2'>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(index)}
                            className='px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors'
                          >
                            Save
                          </button>
                          <button
                            onClick={() => cancelEdit(index)}
                            className='px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded transition-colors'
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(index, ticket)}
                            className='px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors'
                          >
                            Edit
                          </button>
                          <button
                            onClick={copyTicket}
                            className='px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors flex items-center space-x-1'
                            title='Copy ticket'
                          >
                            <svg
                              className='w-3 h-3'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                              />
                            </svg>
                            <span>Copy</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create Tickets Button at the bottom */}
          <div className='flex justify-center pt-4'>
            <button
              onClick={openProjectSelector}
              className='px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
            >
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
              <span>
                Create {aiResponse.tickets.length} Ticket{aiResponse.tickets.length > 1 ? 's' : ''}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIResponseMessage;
