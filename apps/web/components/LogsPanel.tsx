'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { c} from '@/lib/utils';
import { FiChevronUp, FiChevronDown, FiX, FiMaximize2, FiMinimize2 } from 'react-icons/fi';

export interface ConsoleLog {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: Date;
  source?: string;
}

interface LogsPanelProps {
  logs: ConsoleLog[];
  onClear: () => void;
  className?: string;
  maxHeight?: string;
  defaultHeight?: string;
}

export const LogsPanel = React.memo(function LogsPanel({
  logs,
  onClear,
  className,
  maxHeight = '50vh',
  defaultHeight = '200px'
}: LogsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [height, setHeight] = useState(defaultHeight);
  const previousHeight = useRef(defaultHeight);
  const isResizing = useRef(false);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (isMinimized || !logsEndRef.current) return;
    
    const timer = setTimeout(() => {
      if (logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [logs, isMinimized]);

  // Handle minimize toggle
  const toggleMinimize = useCallback(() => {
    if (isMinimized) {
      // Restore previous height
      setHeight(previousHeight.current);
    } else {
      // Save current height before minimizing
      previousHeight.current = height;
      setHeight('32px');
    }
    setIsMinimized(!isMinimized);
  }, [isMinimized, height]);

  // Handle expand toggle
  const toggleExpand = useCallback(() => {
    if (isMinimized) {
      setIsMinimized(false);
      setHeight(previousHeight.current);
    } else if (isExpanded) {
      setHeight(previousHeight.current);
    } else {
      previousHeight.current = height === defaultHeight ? height : previousHeight.current;
      setHeight(maxHeight);
    }
    setIsExpanded(!isExpanded);
  }, [isMinimized, isExpanded, height, defaultHeight, maxHeight]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const startHeight = panelRef.current?.offsetHeight || 0;
    isResizing.current = true;
    
    // Add styles for better UX during resize
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    
    const onMouseMove = (e: MouseEvent) => {
      if (!panelRef.current || !isResizing.current) return;
      
      const newHeight = startHeight + (startY - e.clientY);
      const minHeight = 100; // Minimum height in pixels
      const maxHeight = window.innerHeight * 0.8; // 80% of viewport height
      
      // Constrain the height
      const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
      
      setHeight(`${constrainedHeight}px`);
      previousHeight.current = `${constrainedHeight}px`;
      
      // If we're near the top, auto-scroll the page up
      if (e.clientY < 100) {
        window.scrollBy(0, -10);
      }
      // If we're near the bottom, auto-scroll the page down
      else if (e.clientY > window.innerHeight - 100) {
        window.scrollBy(0, 10);
      }
    };
    
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp, { once: true });
  }, []);

  // Format timestamp
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  }, []);

  // Get log type styles
  const getLogTypeStyles = useCallback((type: string) => {
    switch (type) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'success': return 'text-green-500';
      default: return 'text-gray-800 dark:text-gray-200';
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className={cn(
        'bg-dominofy-light-surface dark:bg-dominofy-dark-surface',
        'border-t border-gray-200 dark:border-gray-700 shadow-lg',
        'transition-all duration-200 ease-in-out flex flex-col',
        'fixed bottom-0 left-0 right-0 z-50',
        'flex flex-col',
        className
      )}
      style={{
        height: isMinimized ? '40px' : `min(${height}, 80vh)`,
        maxHeight: isExpanded ? maxHeight : 'none',
        minHeight: isMinimized ? '40px' : '140px',
        transform: 'translateZ(0)', // Force GPU acceleration
        marginTop: isMinimized ? '0' : '-1px', // Pull up slightly when expanded
      }}
    >
      {/* Resize handle */}
      <div 
        className="h-2 w-full cursor-row-resize flex items-center justify-center group bg-dominofy-light-surface dark:bg-dominofy-dark-surface border-b border-gray-200 dark:border-gray-700 relative z-10"
        onMouseDown={handleMouseDown}
      >
        <div className="w-16 h-1 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-blue-500 transition-colors" />
      </div>
      {/* Header */}
      <div 
        className={cn(
          'h-14 flex items-center justify-between px-4 cursor-pointer select-none',
          'bg-dominofy-light-surface dark:bg-dominofy-dark-surface',
          'border-b border-gray-200 dark:border-gray-700',
          'hover:bg-dominofy-light-surface/95 dark:hover:bg-dominofy-dark-surface/95',
          'flex-shrink-0',
          'transition-all duration-200',
          'relative z-30',
          'shadow-sm',
          isMinimized ? 'rounded-t-lg' : ''
        )}
        style={{
          paddingTop: '2px', // Add slight top padding to ensure visibility
        }}
        onClick={toggleMinimize}
      >
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleMinimize}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
            title={isMinimized ? 'Show logs' : 'Minimize'}
          >
            {isMinimized ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
            </span>
            <span className="text-gray-900 dark:text-white text-[13px] font-medium">Workflow Logs</span>
          </h3>
          {logs.length > 0 && (
            <span className="text-xs bg-dominofy-light-panel dark:bg-dominofy-dark-panel px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onClear}
            className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Clear logs"
          >
            <FiX />
          </button>
          <button
            onClick={toggleExpand}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
          </button>
        </div>
      </div>

      {/* Logs content */}
      {!isMinimized && (
        <div 
          className="overflow-y-auto overflow-x-auto flex-grow p-3 relative z-0 bg-white dark:bg-gray-900"
          style={{ 
            minHeight: '100px',
            maxHeight: 'calc(80vh - 56px)' // Account for taller header
          }}
        >
          {logs.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No logs available. Run the workflow to see logs here.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'text-xs font-mono p-1.5 rounded',
                    'hover:bg-dominofy-light-panel dark:hover:bg-dominofy-dark-panel',
                    getLogTypeStyles(log.type)
                  )}
                >
                  <div className="flex items-start">
                    <span className="text-gray-500 dark:text-gray-400 mr-2 whitespace-nowrap">
                      [{formatTime(log.timestamp)}]
                    </span>
                    {log.source && (
                      <span className="text-purple-500 dark:text-purple-400 mr-2 font-medium">
                        [{log.source}]
                      </span>
                    )}
                    <span className="whitespace-pre-wrap break-words">{log.message}</span>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Resize handle */}
      {!isMinimized && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
});

export default LogsPanel;
