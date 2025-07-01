'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
        'bg-white dark:bg-gray-900',
        'border-t border-gray-200 dark:border-gray-700 shadow-xl',
        'transition-all duration-300 ease-in-out flex flex-col',
        'fixed bottom-0 left-0 right-0 z-50',
        'flex flex-col backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95',
        'transform transition-transform duration-300',
        isMinimized ? 'translate-y-[calc(100%-40px)]' : 'translate-y-0',
        className
      )}
      style={{
        height: isMinimized ? '40px' : `min(${height}, 80vh)`,
        maxHeight: isExpanded ? maxHeight : 'none',
        minHeight: isMinimized ? '40px' : '160px',
      }}
    >
      {/* Resize handle */}
      <div 
        className="h-2 w-full cursor-row-resize flex items-center justify-center group bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 relative z-10"
        onMouseDown={handleMouseDown}
      >
        <div className="w-24 h-1 bg-white/50 rounded-full group-hover:bg-white/80 transition-all duration-200" />
      </div>
      
      {/* Header */}
      <div 
        className={cn(
          'h-14 flex items-center justify-between px-5 cursor-pointer select-none',
          'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900',
          'border-b border-gray-200 dark:border-gray-700',
          'hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-800',
          'flex-shrink-0',
          'transition-all duration-300',
          'relative z-30',
          'shadow-sm',
          isMinimized ? 'rounded-t-lg' : ''
        )}
        onClick={toggleMinimize}
      >
        <div className="flex items-center space-x-3">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            title={isMinimized ? 'Show logs' : 'Minimize'}
          >
            {isMinimized ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-blue-500 opacity-75 animate-pulse"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
            </span>
            <span className="text-gray-800 dark:text-gray-100 text-sm font-medium">Workflow Logs</span>
          </h3>
          {logs.length > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-0.5 rounded-full">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear logs"
            disabled={logs.length === 0}
          >
            <FiX size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
            className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Logs content */}
      {!isMinimized && (
        <div 
          className="overflow-y-auto overflow-x-auto flex-grow relative z-0 bg-white dark:bg-gray-900"
          style={{ 
            minHeight: '100px',
            maxHeight: 'calc(80vh - 56px)'
          }}
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <FiMaximize2 className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-gray-700 dark:text-gray-200 font-medium mb-1">No logs yet</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                Run your workflow to see execution logs appear here in real-time
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'px-4 py-2.5 text-sm font-mono transition-colors duration-150',
                    'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    'border-l-4',
                    log.type === 'error' ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' :
                    log.type === 'warn' ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10' :
                    log.type === 'info' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' :
                    log.type === 'success' ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' :
                    'border-transparent'
                  )}
                >
                  <div className="flex items-start">
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-3 mt-0.5 font-medium min-w-[72px]">
                      {formatTime(log.timestamp)}
                    </span>
                    <div className="flex-1">
                      {log.source && (
                        <span className="inline-block px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 mb-1 mr-2">
                          {log.source}
                        </span>
                      )}
                      <span className={cn(
                        'whitespace-pre-wrap break-words',
                        log.type === 'error' ? 'text-red-700 dark:text-red-300' :
                        log.type === 'warn' ? 'text-yellow-700 dark:text-yellow-300' :
                        log.type === 'info' ? 'text-blue-700 dark:text-blue-300' :
                        log.type === 'success' ? 'text-green-700 dark:text-green-300' :
                        'text-gray-700 dark:text-gray-200'
                      )}>
                        {log.message}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} className="h-4" />
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
