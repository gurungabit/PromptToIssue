import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: 'Start New Chat',
      description: 'Describe your requirements and generate tickets',
      icon: (
        <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.53-.37l-3.47 1.14a.75.75 0 01-.919-.918l1.14-3.47A8.955 8.955 0 015 12c0-4.418 3.582-8 8-8s8 3.582 8 8z'
          />
        </svg>
      ),
      action: '/chat',
      color: 'blue',
    },
    {
      title: 'Platform Settings',
      description: 'Connect GitLab, GitHub, and configure integrations',
      icon: (
        <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
          />
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
          />
        </svg>
      ),
      action: '/settings',
      color: 'purple',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-700',
        text: 'text-blue-600 dark:text-blue-400',
        accent: 'text-blue-700 dark:text-blue-300',
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-700',
        text: 'text-green-600 dark:text-green-400',
        accent: 'text-green-700 dark:text-green-300',
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-700',
        text: 'text-purple-600 dark:text-purple-400',
        accent: 'text-purple-700 dark:text-purple-300',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className='h-full bg-white dark:bg-gray-900 overflow-y-auto'>
      <div className='max-w-5xl mx-auto space-y-12 py-8 px-8'>
        {/* Welcome Header */}
        <div className='text-center space-y-6'>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-white'>
            Welcome back, {user?.username}! 👋
          </h1>
          <p className='text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed'>
            Ready to turn your ideas into actionable tickets? I can help you break down
            requirements, create structured issues, and streamline your development workflow.
          </p>
        </div>

        {/* Quick Actions */}
        <div className='space-y-8'>
          <div className='text-center'>
            <h2 className='text-2xl font-semibold text-gray-900 dark:text-white mb-4'>
              What would you like to do today?
            </h2>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
            {quickActions.map((action, index) => {
              const colors = getColorClasses(action.color);
              return (
                <Link
                  key={index}
                  to={action.action}
                  className={`${colors.bg} ${colors.border} border rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group block hover:scale-105`}
                >
                  <div
                    className={`${colors.text} mb-6 group-hover:scale-110 transition-transform duration-300`}
                  >
                    {action.icon}
                  </div>
                  <h3 className={`text-xl font-semibold ${colors.accent} mb-3`}>{action.title}</h3>
                  <p className='text-gray-600 dark:text-gray-400 leading-relaxed'>
                    {action.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Getting Started */}
        <div className='bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-10 shadow-lg'>
          <div className='text-center mb-8'>
            <h2 className='text-2xl font-semibold text-gray-900 dark:text-white'>
              🚀 Getting Started
            </h2>
          </div>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
            <div className='space-y-6'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>How it works:</h3>
              <ol className='space-y-4'>
                <li className='flex items-start'>
                  <span className='bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full w-8 h-8 text-sm flex items-center justify-center mr-4 mt-1 font-semibold'>
                    1
                  </span>
                  <div>
                    <p className='text-gray-700 dark:text-gray-300 font-medium'>
                      Start a conversation
                    </p>
                    <p className='text-gray-600 dark:text-gray-400 text-sm mt-1'>
                      Describe your feature or bug in natural language
                    </p>
                  </div>
                </li>
                <li className='flex items-start'>
                  <span className='bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full w-8 h-8 text-sm flex items-center justify-center mr-4 mt-1 font-semibold'>
                    2
                  </span>
                  <div>
                    <p className='text-gray-700 dark:text-gray-300 font-medium'>
                      AI analyzes and breaks down
                    </p>
                    <p className='text-gray-600 dark:text-gray-400 text-sm mt-1'>
                      Automatically creates structured tickets with acceptance criteria
                    </p>
                  </div>
                </li>
                <li className='flex items-start'>
                  <span className='bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full w-8 h-8 text-sm flex items-center justify-center mr-4 mt-1 font-semibold'>
                    3
                  </span>
                  <div>
                    <p className='text-gray-700 dark:text-gray-300 font-medium'>
                      Review and create
                    </p>
                    <p className='text-gray-600 dark:text-gray-400 text-sm mt-1'>
                      Edit tickets and create them on your platforms
                    </p>
                  </div>
                </li>
              </ol>
            </div>
            <div className='space-y-6'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>Pro Tips:</h3>
              <ul className='space-y-4'>
                <li className='flex items-start'>
                  <span className='text-green-500 mr-3 mt-1'>✓</span>
                  <div>
                    <p className='text-gray-700 dark:text-gray-300 font-medium'>
                      Be specific about user stories
                    </p>
                    <p className='text-gray-600 dark:text-gray-400 text-sm mt-1'>
                      Include acceptance criteria and edge cases
                    </p>
                  </div>
                </li>
                <li className='flex items-start'>
                  <span className='text-green-500 mr-3 mt-1'>✓</span>
                  <div>
                    <p className='text-gray-700 dark:text-gray-300 font-medium'>
                      Mention technical constraints
                    </p>
                    <p className='text-gray-600 dark:text-gray-400 text-sm mt-1'>
                      Dependencies, tech stack, and limitations
                    </p>
                  </div>
                </li>
                <li className='flex items-start'>
                  <span className='text-green-500 mr-3 mt-1'>✓</span>
                  <div>
                    <p className='text-gray-700 dark:text-gray-300 font-medium'>
                      Include priority and complexity
                    </p>
                    <p className='text-gray-600 dark:text-gray-400 text-sm mt-1'>
                      Help AI understand urgency and scope
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
