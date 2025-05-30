import React from 'react';
import type { ChatMode } from '../../hooks/useChat';

interface ConversationStartersProps {
  username?: string;
  handleSend: (message: string) => void;
  loading: boolean;
  mode: ChatMode;
}

const ConversationStarters: React.FC<ConversationStartersProps> = ({
  username,
  handleSend,
  loading,
  mode,
}) => {
  const ticketStarters = [
    'Create a user authentication system',
    'Build a REST API for a blog',
    'Implement a payment gateway',
    'Design a dashboard with analytics',
    'Add real-time chat functionality',
    'Create a file upload system',
    'Build a notification system',
    'Implement search functionality',
  ];

  const assistantStarters = [
    'How does JWT authentication work?',
    'What are the best practices for API design?',
    'Explain how OAuth works',
    'Help me understand microservices architecture',
    'What is the difference between SQL and NoSQL?',
    'How do I optimize database queries?',
    'Explain React hooks and their usage',
    'What are design patterns in software development?',
  ];

  const conversationStarters = mode === 'ticket' ? ticketStarters : assistantStarters;

  return (
    <div className='flex flex-col items-center justify-center h-full py-8'>
      {/* Welcome Message */}
      <div className='text-center space-y-8 w-full max-w-4xl'>
        <div className='space-y-4'>
          <h1 className='text-3xl font-medium text-gray-900 dark:text-white'>
            {mode === 'ticket' ? 'AI Ticket Generator' : 'AI Assistant'}
          </h1>
          <p className='text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
            {mode === 'ticket'
              ? "Describe your requirements and I'll create structured tickets for you"
              : "Ask me anything! I'm here to help with your questions and provide assistance"}
          </p>
        </div>

        <div className='space-y-6'>
          <h2 className='text-2xl font-medium text-gray-900 dark:text-white'>
            Hi {username},{' '}
            {mode === 'ticket'
              ? 'what should we build into tickets today?'
              : 'how can I help you today?'}
          </h2>
          <p className='text-gray-600 dark:text-gray-400 max-w-xl mx-auto'>
            {mode === 'ticket'
              ? "I can help you create well-structured tickets from your ideas. Just describe what you need and I'll break it down into actionable tasks."
              : "I'm here to answer your questions, explain concepts, help with coding problems, or provide guidance on any topic you're curious about."}
          </p>
        </div>

        {/* Conversation Starters */}
        <div className='w-full max-w-4xl mt-12'>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
            {conversationStarters.map((starter, index) => (
              <button
                key={index}
                onClick={() => handleSend(starter)}
                disabled={loading}
                className='p-4 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-md'
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationStarters;
