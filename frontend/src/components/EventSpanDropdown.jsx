import React, { useState, useRef, useEffect } from 'react';

const EVENT_SPANS = ['Single Day', 'Multiple Days'];

const EventSpanDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayText = value === 'single' ? 'Single Day' : 'Multiple Days';
  const spanOptions = [
    { label: 'Single Day', value: 'single' },
    { label: 'Multiple Days', value: 'multiple' }
  ];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="py-2 px-4 inline-flex items-center justify-between w-full h-[42px] gap-x-2 text-sm font-medium rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-hover)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]/20 dark:focus:border-[#388bfd] dark:focus:ring-[#388bfd]/20 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        aria-haspopup="menu" 
        aria-expanded={isOpen} 
        aria-label="Event Span Dropdown"
      >
        <span className="truncate">{displayText}</span>
        <svg className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {isOpen && (
        <div 
            className="absolute z-50 transition-opacity duration-200 bg-[var(--bg-card)] border border-[var(--border)] shadow-md rounded-xl mt-2 overflow-hidden w-full" 
            style={{ top: '100%', left: 0 }}
            role="menu"
        >
          <div className="p-2 flex flex-col gap-1">
            {spanOptions.map(option => (
                <button 
                    key={option.value} 
                    className={`w-full text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors focus:outline-none ${value === option.value ? 'bg-blue-500 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => { onChange(option.value); setIsOpen(false); }}
                >
                    {option.label}
                </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventSpanDropdown;
