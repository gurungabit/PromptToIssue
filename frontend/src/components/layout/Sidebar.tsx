import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useChat } from '../../contexts/ChatContext';
import { useToast } from '../../contexts/ToastContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { conversations, conversationsLoading, deleteConversation, deleteAllConversations } = useChat();
  const { addToast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Helper function to format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Handle deleting individual conversation
  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Check if this is the currently active conversation
    const isCurrentConversation = location.pathname === `/chat/${conversationId}`;
    
    try {
      // If we're deleting the current conversation, navigate immediately to prevent 404 errors
      if (isCurrentConversation) {
        navigate('/chat');
      }
      
      await deleteConversation(conversationId);
      addToast('Conversation deleted successfully', 'success');
    } catch (error: any) {
      addToast(error.message || 'Failed to delete conversation', 'error');
      // If deletion failed and we already navigated, we might want to stay on current page
      // But for now, let's just show the error
    }
  };

  // Handle clearing all conversations
  const handleClearAll = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    try {
      await deleteAllConversations();
      addToast('All conversations deleted successfully', 'success');
      setShowClearConfirm(false);
      
      // Redirect to new chat since all conversations were deleted
      navigate('/chat');
    } catch (error: any) {
      addToast(error.message || 'Failed to delete conversations', 'error');
    }
  };

  // Process conversations for grouping (sort by most recent first)
  const sortedConversations = [...conversations].sort((a, b) => 
    new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
  
  const processedConversations = sortedConversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    date: formatDate(conv.updatedAt || conv.createdAt),
    time: formatTime(conv.updatedAt || conv.createdAt)
  }));

  const groupedConversations = processedConversations.reduce((acc, conv) => {
    if (!acc[conv.date]) {
      acc[conv.date] = [];
    }
    acc[conv.date].push(conv);
    return acc;
  }, {} as Record<string, typeof processedConversations>);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2v0z" />
        </svg>
      ),
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gray-50 dark:bg-gray-800/95 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header with Navigation */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Navigation
              </h1>
              <button
                onClick={onClose}
                className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Navigation Items */}
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={`
                      flex items-center px-2 py-1.5 text-sm rounded-md transition-colors
                      ${isActive 
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }
                    `}
                  >
                    <span className="mr-2">
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Conversations Section */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Conversations
                </h2>
                {conversations.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Clear all conversations"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 dark:text-gray-500 text-sm">
                    No conversations yet
                  </div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    Start a new chat to get going
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedConversations).map(([date, convs]) => (
                    <div key={date}>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                        {date}
                      </h3>
                      <div className="space-y-1">
                        {convs.map((conversation) => {
                          const isActive = location.pathname === `/chat/${conversation.id}`;
                          
                          return (
                            <div
                              key={conversation.id}
                              className={`
                                relative group rounded-md transition-colors
                                ${isActive 
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' 
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }
                              `}
                            >
                              <Link
                                to={`/chat/${conversation.id}`}
                                onClick={() => window.innerWidth < 1024 && onClose()}
                                className="block p-2 pr-8"
                              >
                                <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {conversation.time}
                                </div>
                              </Link>
                              
                              {/* Delete button */}
                              <button
                                onClick={(e) => handleDeleteConversation(conversation.id, e)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200"
                                title="Delete conversation"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/chat"
              onClick={() => window.innerWidth < 1024 && onClose()}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </Link>
          </div>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Clear All Conversations
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete all conversations? This action cannot be undone and will permanently remove all your chat history.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearAll}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 