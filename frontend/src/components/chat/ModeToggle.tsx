import { useChat } from '../../hooks/useChat';

export default function ModeToggle() {
  const { mode, setMode } = useChat();

  const toggleMode = () => {
    setMode(mode === 'ticket' ? 'assistant' : 'ticket');
  };

  return (
    <div className='flex items-center space-x-3'>
      <span
        className={`text-sm font-medium transition-colors ${
          mode === 'ticket' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        Ticket Mode
      </span>

      <button
        onClick={toggleMode}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
          mode === 'assistant' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
        role='switch'
        aria-checked={mode === 'assistant'}
        aria-label='Toggle chat mode'
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            mode === 'assistant' ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>

      <span
        className={`text-sm font-medium transition-colors ${
          mode === 'assistant'
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        AI Assistant
      </span>
    </div>
  );
}
