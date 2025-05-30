import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../hooks/useChat';
import type { TicketData } from '../../hooks/useChat';
import { useToast } from '../../contexts/ToastContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import CustomSelect from '../ui/CustomSelect';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import CodeBlock from './CodeBlock';
import AIResponseMessage from './AIResponseMessage';
import ConversationStarters from './ConversationStarters';
import ModeToggle from './ModeToggle';
import type { Message, Platform, Project, Milestone, PlatformTicket, ApiError, TicketCreationResponse, TicketFieldValue } from '../../types';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { sendMessage, loading, setCurrentConversation, conversations, mode } = useChat();
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiResponse, setAiResponse] = useState<{
    response: string;
    tickets?: TicketData[];
    shouldSplit?: boolean;
    clarificationNeeded?: boolean;
  } | null>(null);
  const [editingTickets, setEditingTickets] = useState<{[key: number]: boolean}>({});
  const [editedTickets, setEditedTickets] = useState<{[key: number]: TicketData}>({});
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [creatingTickets, setCreatingTickets] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation data when conversationId changes
  const loadConversation = async (id: string) => {
    setLoadingConversation(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        addToast('Please log in again', 'error');
        navigate('/login');
        return;
      }

      console.log('Loading conversation:', id);
      const response = await axios.get(`/api/protected/conversations/${id}`);
      
      console.log('Response status:', response.status);
      
      if (response.status === 401) {
        addToast('Session expired. Please log in again.', 'error');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      
      if (response.status === 404) {
        addToast('Conversation not found', 'error');
        // Redirect to new chat
        navigate('/chat');
        return;
      }
      
      if (response.status < 200 || response.status >= 300) {
        console.error('Failed to load conversation:', response.status, response.data);
        throw new Error(`Failed to load conversation: ${response.status}`);
      }
      
      const conversationData = response.data;
      console.log('Loaded conversation data:', conversationData);
      setCurrentConversation(conversationData);
      
      // Set messages from the conversation
      if (conversationData.messages) {
        setMessages(conversationData.messages);
        
        // Find the last AI response with tickets
        const lastAiMessage = conversationData.messages
          .filter((msg: Message) => msg.role === 'assistant' && msg.metadata)
          .pop();
          
        if (lastAiMessage?.metadata) {
          const metadata = typeof lastAiMessage.metadata === 'string' 
            ? JSON.parse(lastAiMessage.metadata) 
            : lastAiMessage.metadata;
            
          if (metadata.tickets && metadata.tickets.length > 0) {
            setAiResponse({
              response: lastAiMessage.content,
              tickets: metadata.tickets,
              shouldSplit: metadata.shouldSplit,
              clarificationNeeded: metadata.clarificationNeeded,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      const apiError = error as ApiError;
      if (apiError.status === 401) {
        addToast('Session expired. Please log in again.', 'error');
        localStorage.removeItem('token');
        navigate('/login');
      } else if (apiError.status === 404) {
        addToast('Conversation not found', 'error');
        navigate('/chat');
      } else {
        addToast(`Failed to load conversation: ${apiError.message || 'Unknown error'}`, 'error');
      }
    } finally {
      setLoadingConversation(false);
    }
  };

  // Effect to handle conversation loading
  useEffect(() => {
    if (conversationId) {
      // Always load the conversation when conversationId changes
      // Clear previous state first
      setMessages([]);
      setAiResponse(null);
      setCurrentConversation(null);
      
      // Load the new conversation
      loadConversation(conversationId);
    } else {
      // Clear state for new conversation
      setMessages([]);
      setAiResponse(null);
      setCurrentConversation(null);
    }
  }, [conversationId]);

  // Effect to check if current conversation was deleted
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      // Check if the current conversation still exists in the conversations list
      const conversationExists = conversations.some(conv => conv.id === conversationId);
      
      if (!conversationExists) {
        // Current conversation was deleted, redirect to new chat
        console.log('Current conversation was deleted, redirecting to new chat');
        addToast('Conversation was deleted', 'info');
        navigate('/chat');
      }
    }
  }, [conversationId, conversations, addToast]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      addToast('Failed to copy to clipboard', 'error');
    }
  };

  const startEditing = (index: number, ticket: TicketData) => {
    setEditingTickets(prev => ({ ...prev, [index]: true }));
    setEditedTickets(prev => ({ ...prev, [index]: { ...ticket } }));
  };

  const saveEdit = (index: number) => {
    if (aiResponse?.tickets && editedTickets[index]) {
      const updatedTickets = [...aiResponse.tickets];
      updatedTickets[index] = editedTickets[index];
      setAiResponse(prev => prev ? { ...prev, tickets: updatedTickets } : null);
    }
    setEditingTickets(prev => ({ ...prev, [index]: false }));
  };

  const cancelEdit = (index: number) => {
    setEditingTickets(prev => ({ ...prev, [index]: false }));
    setEditedTickets(prev => {
      const newState = { ...prev };
      delete newState[index];
      return newState;
    });
  };

  const updateEditedTicket = (index: number, field: keyof TicketData, value: TicketFieldValue) => {
    setEditedTickets(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  // Clean up AI response for display (remove redundant headers)
  const cleanAIResponse = (response: string) => {
    return response
      // Remove various forms of "Initial Analysis" headers
      .replace(/\*\*Initial Analysis:\*\*/gi, '')
      .replace(/\*\*Initial Analysis\*\*:/gi, '')
      .replace(/Initial Analysis:/gi, '')
      .replace(/\*\*Initial Analysis\*\*/gi, '')
      // Remove "Recommended Approach" headers
      .replace(/\*\*Recommended Approach:\*\*/gi, '')
      .replace(/\*\*Recommended Approach\*\*:/gi, '')
      .replace(/Recommended Approach:/gi, '')
      // Remove excessive dashes
      .replace(/^\s*-{3,}\s*/gm, '')
      // Remove "Generated User Stories" or similar headers from content
      .replace(/\*\*Generated User Stories\*\*/gi, '')
      .replace(/Generated User Stories:/gi, '')
      .replace(/User generated/gi, '')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleSend = async (message: string) => {
    if (!message.trim() || loading) return;

    // Always add the user message to local state immediately
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Add a loading message placeholder
    const loadingMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '...',
      createdAt: new Date().toISOString(),
      isLoading: true,
    };
    setMessages(prev => [...prev, loadingMessage]);
    
    setInput('');
    // Reset textarea height after clearing input
    setTimeout(() => adjustTextareaHeight(), 0);
    
    try {
      const response = await sendMessage(message, conversationId, 'google', mode);
      
      // Replace the loading message with the actual AI response
      const aiMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant' as const,
        content: response.response,
        createdAt: new Date().toISOString(),
      };
      
      setMessages(prev => {
        // Remove the loading message and add the real response
        const withoutLoading = prev.filter(msg => !msg.isLoading);
        return [...withoutLoading, aiMessage];
      });
      
      // If we now have a conversationId (new conversation), update the URL
      if (response.conversationId && response.conversationId !== conversationId) {
        navigate(`/chat/${response.conversationId}`);
      }
      
      // Set aiResponse for ticket creation functionality
      setAiResponse(response);
    } catch (error) {
      console.error('Error sending message:', error);
      const apiError = error as ApiError;
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant' as const,
        content: `Sorry, I encountered an error: ${apiError.message || 'Unknown error'}. Please make sure you have configured at least one AI API key in the backend .env file.`,
        createdAt: new Date().toISOString(),
      };
      
      // Replace the loading message with the error message
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => !msg.isLoading);
        return [...withoutLoading, errorMessage];
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      handleSend(input.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        handleSend(input.trim());
      }
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on scrollHeight, with min and max constraints
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 200); // Min 48px, Max 200px
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const isNewConversation = !conversationId && messages.length === 0;
  const isLoadingConversation = conversationId && loadingConversation;

  const openProjectSelector = async () => {
    try {
      const response = await axios.get('/api/protected/platforms');
      const platforms = await response.data;
      
      if (platforms.length === 0) {
        addToast('No platforms configured. Go to Settings to add GitLab or GitHub integration.', 'warning');
        return;
      }
      
      setAvailablePlatforms(platforms);
      setShowProjectSelector(true);
    } catch (error) {
      console.error('Failed to load platforms:', error);
      addToast('Failed to load platforms', 'error');
    }
  };

  const loadProjects = async (platformId: string) => {
    setLoadingProjects(true);
    try {
      const response = await axios.get(`/api/protected/platforms/${platformId}/projects`);
      const projectsData = response.data;
      console.log('Projects loaded:', projectsData);
      setProjects(projectsData);
      setSelectedProject('');
      setMilestones([]);
      setSelectedMilestone('');
    } catch (error) {
      console.error('Failed to load projects:', error);
      addToast('Failed to load projects', 'error');
    }
    setLoadingProjects(false);
  };

  const loadMilestones = async (platformId: string, projectId: string) => {
    setLoadingMilestones(true);
    try {
      const response = await axios.get(`/api/protected/platforms/${platformId}/projects/${projectId}/milestones`);
      const milestonesData = response.data;
      console.log('Milestones loaded:', milestonesData);
      setMilestones(milestonesData);
      setSelectedMilestone('');
    } catch (error) {
      console.error('Failed to load milestones:', error);
      addToast('Failed to load milestones', 'error');
    }
    setLoadingMilestones(false);
  };

  const createTicketsOnPlatform = async () => {
    if (!selectedProject || !aiResponse?.tickets) return;

    setCreatingTickets(true);
    try {
      const response = await axios.post('/api/protected/tickets', {
        conversationId: conversationId || 'temp',
        tickets: aiResponse.tickets,
        platformId: selectedPlatform,
        projectId: selectedProject,
        milestoneId: selectedMilestone || undefined
      });
      
      const { platformTickets, message } = response.data as TicketCreationResponse;
      
      // Show success toast
      addToast(message, 'success');
      
      // If tickets were created on platform, add links as a chat message
      if (platformTickets && platformTickets.length > 0) {
        const linksMessage = `🎉 **Tickets Created Successfully!**

I've created ${platformTickets.length} ticket${platformTickets.length > 1 ? 's' : ''} on your platform:

${platformTickets.map((ticket: PlatformTicket, index: number) => 
          `**${index + 1}.** [${ticket.title}](${ticket.url}) - Issue #${ticket.number}`
        ).join('\n\n')}

You can click on any ticket title above to view it on your platform. All tickets have been saved with the specified labels, priority, milestone (if selected), acceptance criteria, and tasks.`;
        
        // Add the links message to the chat after a small delay to ensure it appears after other content
        setTimeout(() => {
          const linksMessageObj = {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: linksMessage,
            createdAt: new Date().toISOString(),
          };
          
          setMessages(prev => [...prev, linksMessageObj]);
          
          // Scroll to bottom to show the new message
          setTimeout(() => {
            scrollToBottom();
          }, 100);
          
          // If we have a conversation ID, also save this message to the backend
          if (conversationId) {
            axios.post('/api/protected/messages', {
              conversationId,
              role: 'assistant',
              content: linksMessage,
            }).catch(error => {
              console.error('Failed to save links message:', error);
            });
          }
        }, 500);
      }
      
      setShowProjectSelector(false);
    } catch (error) {
      console.error('Failed to create tickets:', error);
      addToast('Failed to create tickets. Please check your platform configuration.', 'error');
    }
    setCreatingTickets(false);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto h-full px-8 lg:px-16">
          {isLoadingConversation ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <LoadingSpinner />
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading conversation...</p>
            </div>
          ) : isNewConversation ? (
            <ConversationStarters 
              username={user?.username}
              handleSend={handleSend}
              loading={loading}
              mode={mode}
            />
          ) : (
            <div className="py-8 min-h-full">
              <div className="space-y-6">
                {/* Messages */}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-8`}
                  >
                    <div className="relative group max-w-[80%]">
                      <div
                        className={`rounded-2xl px-6 py-4 ${ 
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="leading-relaxed">
                          {message.role === 'user' ? (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          ) : message.isLoading ? (
                            <div className="flex items-center gap-2">
                              <LoadingSpinner size="sm" />
                              <span className="text-gray-500 dark:text-gray-400">AI is thinking...</span>
                            </div>
                          ) : (
                            // Check if this is an AI message with tickets
                            aiResponse?.tickets && aiResponse.tickets.length > 0 && 
                            (message.content === aiResponse.response || 
                             (message.metadata && JSON.parse(message.metadata as string)?.tickets)) ? (
                              <AIResponseMessage
                                aiResponse={aiResponse}
                                editingTickets={editingTickets}
                                editedTickets={editedTickets}
                                updateEditedTicket={updateEditedTicket}
                                startEditing={startEditing}
                                saveEdit={saveEdit}
                                cancelEdit={cancelEdit}
                                cleanAIResponse={cleanAIResponse}
                                copyToClipboard={copyToClipboard}
                                openProjectSelector={openProjectSelector}
                                addToast={addToast}
                                mode={mode}
                              />
                            ) : (
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({children}) => <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{children}</h1>,
                                  h2: ({children}) => <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{children}</h2>,
                                  h3: ({children}) => <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">{children}</h3>,
                                  p: ({children}) => <p className="text-gray-900 dark:text-white mb-2">{children}</p>,
                                  ul: ({children}) => <ul className="list-disc list-inside text-gray-900 dark:text-white mb-2 space-y-1">{children}</ul>,
                                  ol: ({children}) => <ol className="list-decimal list-inside text-gray-900 dark:text-white mb-2 space-y-1">{children}</ol>,
                                  li: ({children}) => <li className="text-gray-900 dark:text-white">{children}</li>,
                                  strong: ({children}) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
                                  em: ({children}) => <em className="italic text-gray-800 dark:text-gray-200">{children}</em>,
                                  blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-2">{children}</blockquote>,
                                  a: ({href, children}) => (
                                    <a 
                                      href={href} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-600 dark:decoration-blue-400 hover:decoration-blue-800 dark:hover:decoration-blue-300 underline-offset-2 transition-colors duration-200 font-medium"
                                    >
                                      {children}
                                    </a>
                                  ),
                                  code: (props) => <CodeBlock {...props} addToast={addToast} />,
                                  pre: ({children}) => <div className="my-2">{children}</div>
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            )
                          )}
                        </div>
                        <div className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      {/* Copy button at bottom */}
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className={`absolute -bottom-6 ${
                          message.role === 'user' ? 'right-0' : 'left-0'
                        } opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1`}
                        title="Copy message"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  </div>
                ))}

                {/* Messages end */}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto px-8 lg:px-16">
          {/* Mode Toggle - positioned in top right */}
          <div className="flex justify-end mb-3">
            <ModeToggle />
          </div>
          
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              {/* Avatar */}
              <div className="pl-4 pr-3 py-3">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </div>

              {/* Input */}
              <div className="flex-1 min-h-[48px] flex items-center">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'ticket' 
                    ? "Describe your requirements to generate tickets (Shift+Enter for new line)"
                    : "Ask me anything! I'm here to help (Shift+Enter for new line)"
                  }
                  disabled={loading}
                  rows={1}
                  className="w-full resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 focus:outline-none py-3 leading-6"
                  style={{ 
                    minHeight: '48px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                />
              </div>

              {/* Right icons */}
              <div className="flex items-center pr-3 space-x-2">
                
                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                  title={input.trim() ? "Send message (Enter)" : "Type a message to send"}
                >
                  {loading ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Project Selector Modal */}
      {showProjectSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl min-h-[600px] max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 px-8 py-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    Create Tickets
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select your platform, project, and milestone to create tickets
                  </p>
                </div>
                <button
                  onClick={() => setShowProjectSelector(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 min-h-[400px]">
              <div className="space-y-8">
                {/* Platform Selection */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h6a2 2 0 002-2v-4a2 2 0 00-2-2m8-8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                      </svg>
                    </div>
                    <label className="text-lg font-semibold text-gray-900 dark:text-white">
                      Platform
                    </label>
                  </div>
                  <CustomSelect
                    options={availablePlatforms.map((platform) => ({
                      value: platform.id,
                      label: platform.name,
                    }))}
                    value={selectedPlatform}
                    onChange={(value) => {
                      setSelectedPlatform(value);
                      if (value) {
                        loadProjects(value);
                      }
                    }}
                    placeholder="Select a platform..."
                    className="w-full"
                  />
                </div>

                {/* Project Selection */}
                {selectedPlatform && (
                  <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <label className="text-lg font-semibold text-gray-900 dark:text-white">
                        Project
                      </label>
                    </div>
                    {loadingProjects ? (
                      <div className="flex items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <LoadingSpinner size="sm" />
                        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading projects...</span>
                      </div>
                    ) : (
                      <CustomSelect
                        options={projects.map((project) => ({
                          value: project.id,
                          label: project.name,
                          description: project.url,
                        }))}
                        value={selectedProject}
                        onChange={(value) => {
                          setSelectedProject(value);
                          if (value && selectedPlatform) {
                            loadMilestones(selectedPlatform, value);
                          }
                        }}
                        placeholder="Select a project..."
                        className="w-full"
                      />
                    )}
                  </div>
                )}

                {/* Milestone Selection */}
                {selectedProject && (
                  <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <label className="text-lg font-semibold text-gray-900 dark:text-white">
                        Milestone
                      </label>
                      <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                        Optional
                      </span>
                    </div>
                    {loadingMilestones ? (
                      <div className="flex items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <LoadingSpinner size="sm" />
                        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading milestones...</span>
                      </div>
                    ) : milestones.length > 0 ? (
                      <CustomSelect
                        options={milestones.map((milestone) => ({
                          value: milestone.id,
                          label: milestone.title,
                          description: milestone.description,
                          type: milestone.type,
                          groupName: milestone.groupName,
                        }))}
                        value={selectedMilestone}
                        onChange={setSelectedMilestone}
                        placeholder="Select a milestone..."
                        showGroups={true}
                        className="w-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            No milestones found for this project
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ticket Summary */}
                {selectedProject && aiResponse?.tickets && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl border border-blue-200 dark:border-gray-600 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Ready to Create
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {aiResponse.tickets.length} tickets will be created
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {aiResponse.tickets.map((ticket, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {ticket.title}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                            ticket.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            ticket.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                            ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                            'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          }`}>
                            {ticket.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Always Visible */}
            <div className="bg-gray-50 dark:bg-gray-800 px-8 py-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setShowProjectSelector(false)}
                  className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={createTicketsOnPlatform}
                  disabled={!selectedProject || creatingTickets}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl transition-all duration-200 flex items-center space-x-3 font-semibold shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {creatingTickets ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Creating Tickets...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create Tickets</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 