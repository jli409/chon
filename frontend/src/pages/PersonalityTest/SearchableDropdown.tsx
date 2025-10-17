import React, { useState, useRef, useEffect } from 'react';
import { Question, Option } from './questionnaires';

interface SearchableDropdownProps {
  question: Question;
  selectedValue: string;
  onSelect: (optionId: string) => void;
  language: 'en' | 'zh';
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  question,
  selectedValue,
  onSelect,
  language
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(question.options || []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOptions(question.options || []);
    } else {
      const filtered = (question.options || []).filter(option => {
        const searchLower = searchTerm.toLowerCase();
        return option.textEn.toLowerCase().includes(searchLower) || 
               option.textZh.includes(searchTerm);
      });
      setFilteredOptions(filtered);
    }
  }, [searchTerm, question.options]);

  // Get selected option text
  const getSelectedText = () => {
    const selectedOption = question.options?.find(option => option.id === selectedValue);
    return selectedOption ? (language === 'en' ? selectedOption.textEn : selectedOption.textZh) : '';
  };

  // Get dynamic placeholder text based on question
  const getPlaceholder = () => {
    const questionTextLower = question.textEn.toLowerCase();
    if (questionTextLower.includes('country') || questionTextLower.includes('countries') || questionTextLower.includes('based')) {
      return language === 'en' ? 'Search countries or regions' : '搜索国家或地区';
    } else if (questionTextLower.includes('children')) {
      return language === 'en' ? 'Select number' : '选择数量';
    }
    return language === 'en' ? 'Search...' : '搜索...';
  };

  // Handle option selection
  const handleOptionSelect = (option: Option) => {
    onSelect(option.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="searchable-dropdown" ref={dropdownRef}>
      <div className="dropdown-input-container">
        <input
          ref={inputRef}
          type="text"
          className="dropdown-search-input"
          value={isOpen ? searchTerm : getSelectedText()}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={getPlaceholder()}
        />
        <div className="dropdown-arrow" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '▲' : '▼'}
        </div>
      </div>
      
      {isOpen && (
        <div className="dropdown-options">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <div
                key={option.id}
                className={`dropdown-option ${selectedValue === option.id ? 'selected' : ''}`}
                onClick={() => handleOptionSelect(option)}
              >
                <span className="option-text">
                  {language === 'en' ? option.textEn : option.textZh}
                </span>
              </div>
            ))
          ) : (
            <div className="dropdown-no-results">
              {language === 'en' ? 'No results found' : '未找到结果'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
