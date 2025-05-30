import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, addToast, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  // Determine theme based on current theme - check both class and localStorage
  const isDark =
    document.documentElement.classList.contains('dark') ||
    localStorage.theme === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const style = isDark ? oneDark : oneLight;

  const code = String(children).replace(/\n$/, '');

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (addToast) {
        addToast(`${language.toUpperCase()} code copied to clipboard!`, 'success');
      }
    } catch (err) {
      console.error('Failed to copy code: ', err);
      if (addToast) {
        addToast('Failed to copy code to clipboard', 'error');
      }
    }
  };

  return match ? (
    <div className='relative group'>
      <SyntaxHighlighter
        style={style as any}
        language={language}
        PreTag='div'
        className='rounded-md text-sm my-2'
        showLineNumbers={[
          'sql',
          'javascript',
          'typescript',
          'python',
          'java',
          'cpp',
          'csharp',
          'php',
          'go',
          'rust',
        ].includes(language)}
        {...props}
      >
        {code}
      </SyntaxHighlighter>

      {/* Copy button for code blocks */}
      <button
        onClick={copyCode}
        className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-gray-800 dark:bg-gray-600 hover:bg-gray-900 dark:hover:bg-gray-500 text-gray-300 hover:text-white rounded-md transition-all duration-200 hover:scale-110'
        title={`Copy ${language} code`}
      >
        <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
          />
        </svg>
      </button>
    </div>
  ) : (
    <code className='bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm' {...props}>
      {children}
    </code>
  );
};

export default CodeBlock;
