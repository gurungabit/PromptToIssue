import React from 'react';

interface ConversationStartersProps {
  username?: string;
  handleSend: (message: string) => void;
  loading: boolean;
}

const ConversationStarters: React.FC<ConversationStartersProps> = ({ 
  username, 
  handleSend, 
  loading 
}) => {
  const conversationStarters = [
    'Create a user authentication system',
    'How does JWT authentication work?',
    'Build a REST API for a blog',
    'What are the best practices for API design?',
    'Implement a payment gateway',
    'Explain how OAuth works',
    'Design a dashboard with analytics',
    'Help me understand microservices architecture',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      {/* Welcome Message */}
      <div className="text-center space-y-8 w-full max-w-4xl">
        <div className="space-y-4">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white">
            AI Ticket Generator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Describe your requirements and I'll create structured tickets for you
          </p>
        </div>
        
        <div className="space-y-6">
          <h2 className="text-2xl font-medium text-gray-900 dark:text-white">
            Hi {username}, what should we build into tickets today?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            I can help you create well-structured tickets from your ideas. Just describe what you need 
            and I'll break it down into actionable tasks.
          </p>
        </div>

        {/* Conversation Starters */}
        <div className="w-full max-w-4xl mt-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {conversationStarters.map((starter, index) => (
              <button
                key={index}
                onClick={() => handleSend(starter)}
                disabled={loading}
                className="p-4 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-md"
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