'use client';

import React, { useRef, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkflowTab {
  id: string;
  name: string;
  isModified?: boolean;
}

interface WorkflowTabsProps {
  tabs: WorkflowTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  className?: string;
}

export default function WorkflowTabs({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  className = ''
}: WorkflowTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth
    );
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollButtons();
    container.addEventListener('scroll', updateScrollButtons);
    
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollButtons);
      resizeObserver.disconnect();
    };
  }, [tabs]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newScrollLeft = direction === 'left' 
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  const scrollToActiveTab = () => {
    const container = scrollContainerRef.current;
    if (!container || !activeTabId) return;

    const activeTab = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement;
    if (!activeTab) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    
    if (tabRect.left < containerRect.left) {
      container.scrollTo({
        left: container.scrollLeft + tabRect.left - containerRect.left - 20,
        behavior: 'smooth'
      });
    } else if (tabRect.right > containerRect.right) {
      container.scrollTo({
        left: container.scrollLeft + tabRect.right - containerRect.right + 20,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToActiveTab();
  }, [activeTabId]);

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onTabClose(tabId);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center bg-dominofy-light-surface dark:bg-dominofy-dark-surface border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Left scroll button */}
      <button
        onClick={() => scrollTabs('left')}
        disabled={!canScrollLeft}
        className={`flex items-center justify-center w-8 h-8 border-r border-gray-200 dark:border-gray-700 transition-colors ${
          canScrollLeft
            ? 'hover:bg-dominofy-light-background dark:hover:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text'
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex min-w-full">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => onTabClick(tab.id)}
                className={`
                  group relative flex items-center min-w-0 max-w-[200px] h-8 px-3 cursor-pointer border-r border-gray-200 dark:border-gray-700 transition-colors
                  ${isActive
                    ? 'bg-dominofy-light-background dark:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text'
                    : 'bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-gray-600 dark:text-gray-400 hover:bg-dominofy-light-background dark:hover:bg-dominofy-dark-background hover:text-dominofy-light-text dark:hover:text-dominofy-dark-text'
                  }
                `}
              >
                {/* Tab name with truncation */}
                <span className="flex-1 min-w-0 text-sm font-medium truncate pr-1">
                  {tab.name}
                  {tab.isModified && (
                    <span className="ml-1 text-blue-500">•</span>
                  )}
                </span>

                {/* Close button */}
                <button
                  onClick={(e) => handleTabClose(e, tab.id)}
                  className="flex-shrink-0 ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Active tab indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right scroll button */}
      <button
        onClick={() => scrollTabs('right')}
        disabled={!canScrollRight}
        className={`flex items-center justify-center w-8 h-8 border-l border-gray-200 dark:border-gray-700 transition-colors ${
          canScrollRight
            ? 'hover:bg-dominofy-light-background dark:hover:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text'
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}