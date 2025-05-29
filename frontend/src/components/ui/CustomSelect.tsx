import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  description?: string;
  type?: string;
  groupName?: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showGroups?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  showGroups = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

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

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (option.groupName && option.groupName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group options by type if showGroups is true
  const groupedOptions = showGroups ? filteredOptions.reduce((groups, option) => {
    const type = option.type || 'default';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(option);
    return groups;
  }, {} as Record<string, Option[]>) : { default: filteredOptions };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'project': return 'Project Milestones';
      case 'group': return 'Group Milestones';
      case 'parent_group': return 'Parent Group Milestones';
      default: return 'Options';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'project':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'group':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'parent_group':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-4 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 
          rounded-xl shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-all duration-200 ease-in-out group
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500 border-transparent shadow-md' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {selectedOption && showGroups && (
              <div className="flex-shrink-0">
                {getTypeIcon(selectedOption.type || '')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {selectedOption ? (
                <div>
                  <div className="text-gray-900 dark:text-white font-medium truncate text-sm">
                    {selectedOption.label}
                  </div>
                  {selectedOption.groupName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {selectedOption.groupName}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500 dark:text-gray-400 text-sm">{placeholder}</span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-2">
            <svg
              className={`w-5 h-5 text-gray-400 transition-all duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[60] w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-96 overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search options..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
                autoFocus
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-80 overflow-y-auto">
            {Object.keys(groupedOptions).length === 0 || filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.5a7.966 7.966 0 00-6-2.461 7.966 7.966 0 00-6 2.461" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">No options found</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search</p>
              </div>
            ) : (
              Object.entries(groupedOptions).map(([type, typeOptions]) => (
                <div key={type}>
                  {showGroups && typeOptions.length > 0 && (
                    <div className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-600 flex items-center space-x-2 sticky top-0">
                      {getTypeIcon(type)}
                      <span className="uppercase tracking-wide">{getTypeLabel(type)}</span>
                    </div>
                  )}
                  {typeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`
                        w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-150 group border-b border-gray-50 dark:border-gray-700 last:border-b-0
                        ${value === option.value ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' : 'text-gray-900 dark:text-white'}
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        {showGroups && (
                          <div className="flex-shrink-0">
                            {getTypeIcon(option.type || '')}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium truncate text-sm ${value === option.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                            {option.label}
                          </div>
                          {option.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                              {option.description}
                            </div>
                          )}
                          {option.groupName && !showGroups && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                              {option.groupName}
                            </div>
                          )}
                        </div>
                        {value === option.value && (
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* No Milestone Option */}
          <div className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 group
                ${value === '' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 12M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-medium">No milestone</span>
                </div>
                {value === '' && (
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 