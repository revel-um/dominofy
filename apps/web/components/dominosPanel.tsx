'use client';

import React, { useState, useRef, useMemo } from 'react';
import dominos from '../dominos/dominos';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { FiSearch } from 'react-icons/fi';

interface DominosPanelProps {
  bottomOffset?: number;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export default function DominosPanel({ bottomOffset = 0 }: DominosPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<{ [category: string]: boolean }>({});
  const isDragging = useRef(false);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const toggleCategory = (category: string) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Memoized categorized + filtered dominos
  const filteredCategories = useMemo(() => {
    const result: { [key: string]: typeof dominos } = {};

    dominos.forEach(domino => {
      const matches = domino.label.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matches && searchTerm) return;

      domino.categories.forEach(cat => {
        if (!result[cat]) result[cat] = [];
        result[cat].push(domino);
      });
    });

    return result;
  }, [searchTerm]);

  return (
    <div
      className="relative z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel p-4 overflow-y-auto flex flex-col"
      style={{ width, height: `calc(100% - ${bottomOffset}px)` }}
    >
      {/* Search */}
      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white text-sm pointer-events-none" />
        <input
          type="text"
          placeholder="Search dominos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-sm !text-white placeholder-white caret-white border border-transparent focus:border-black dark:focus:border-black focus:outline-none"
        />
      </div>

      <hr className="-mx-4 border-t border-gray-500 dark:border-gray-600 mb-4 mt-2" />

      {/* Category Groups */}
      <div className="flex-grow overflow-y-auto">
        {Object.entries(filteredCategories)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, items]) => (
            <div key={category} className="mb-8">
              <div
                className="cursor-pointer font-semibold text-sm text-dominofy-light-text dark:text-dominofy-dark-text mb-2 flex justify-between items-center"
                onClick={() => toggleCategory(category)}
              >
                <span>{category}</span>
                {expanded[category] || searchTerm ? (
                  <ChevronUp className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
                )}
              </div>

              {(expanded[category] || searchTerm) &&
                items.map(({ id, label, icon: Icon }) => (
                  <div
                    key={id + category}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="flex items-center gap-2 p-3 mb-2 bg-dominofy-light-surface dark:bg-dominofy-dark-surface rounded cursor-move hover:opacity-90 transition"
                  >
                    <Icon className="text-lg text-dominofy-light-text dark:text-dominofy-dark-text" />
                    <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text">
                      {label}
                    </span>
                  </div>
                ))}
            </div>
          ))}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-transparent"
      />
    </div>
  );
}
