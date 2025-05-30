import { useState, useRef, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  url?: string;
}

interface ProjectSelectorProps {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function ProjectSelector({
  projects,
  value,
  onChange,
  placeholder = 'Select project or enter ID...',
  disabled = false,
  className = '',
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize input value when value changes from outside
  useEffect(() => {
    if (value) {
      const project = projects.find(p => p.id === value);
      setInputValue(project ? project.name : value);
      setIsManualInput(!project);
    } else {
      setInputValue('');
      setIsManualInput(false);
    }
  }, [value, projects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter projects based on input
  const filteredProjects = projects.filter(
    project =>
      project.name.toLowerCase().includes(inputValue.toLowerCase()) ||
      project.id.toLowerCase().includes(inputValue.toLowerCase()) ||
      (project.url && project.url.toLowerCase().includes(inputValue.toLowerCase()))
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsManualInput(true);
    setIsOpen(true);

    // If user is typing something that doesn't match any project, treat as manual input
    const matchingProject = projects.find(
      p => p.name.toLowerCase() === newValue.toLowerCase() || p.id === newValue
    );

    if (matchingProject) {
      onChange(matchingProject.id);
      setIsManualInput(false);
    } else {
      onChange(newValue);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setInputValue(project.name);
    onChange(project.id);
    setIsOpen(false);
    setIsManualInput(false);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    setIsOpen(false);
    setIsManualInput(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input Field */}
      <div className='relative'>
        <input
          ref={inputRef}
          type='text'
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-4 pr-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 
            rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all duration-200 ease-in-out text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300 dark:hover:border-gray-500'}
            ${isOpen ? 'ring-2 ring-blue-500 border-transparent shadow-md' : ''}
          `}
        />

        {/* Right side icons */}
        <div className='absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1'>
          {/* Manual input indicator */}
          {isManualInput && value && (
            <div className='flex items-center space-x-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded text-xs'>
              <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                />
              </svg>
              <span>Custom</span>
            </div>
          )}

          {/* Clear button */}
          {value && (
            <button
              type='button'
              onClick={handleClear}
              className='p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              title='Clear selection'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          )}

          {/* Dropdown arrow */}
          <button
            type='button'
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 9l-7 7-7-7'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className='absolute z-[60] w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-96 overflow-hidden animate-in slide-in-from-top-2 duration-200'>
          {/* Options List */}
          <div className='max-h-80 overflow-y-auto'>
            {filteredProjects.length === 0 ? (
              <div className='px-4 py-8 text-center'>
                <svg
                  className='w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                  />
                </svg>
                <p className='text-sm text-gray-500 dark:text-gray-400'>No projects found</p>
                {inputValue && (
                  <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
                    Press Enter to use "{inputValue}" as custom project ID
                  </p>
                )}
              </div>
            ) : (
              filteredProjects.map(project => (
                <button
                  key={project.id}
                  type='button'
                  onClick={() => handleProjectSelect(project)}
                  className={`
                    w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-150 group border-b border-gray-50 dark:border-gray-700 last:border-b-0
                    ${value === project.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' : 'text-gray-900 dark:text-white'}
                  `}
                >
                  <div className='flex items-center space-x-3'>
                    <div className='flex-shrink-0'>
                      <svg
                        className='w-5 h-5 text-green-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                        />
                      </svg>
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div
                        className={`font-medium truncate text-sm ${value === project.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}
                      >
                        {project.name}
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400 truncate mt-1'>
                        ID: {project.id}
                      </div>
                      {project.url && (
                        <div className='text-xs text-gray-500 dark:text-gray-400 truncate mt-1'>
                          {project.url}
                        </div>
                      )}
                    </div>
                    {value === project.id && (
                      <div className='flex-shrink-0'>
                        <svg
                          className='w-5 h-5 text-blue-600 dark:text-blue-400'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path
                            fillRule='evenodd'
                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                            clipRule='evenodd'
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
