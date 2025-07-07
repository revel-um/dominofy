// src/contexts/SSEContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDominofySSE } from '@/hooks/useDominofySSE';
import { config } from '@/config/config';

// Infer the hook's return type
type HookReturn = ReturnType<typeof useDominofySSE>;

// Context value exposing events and control methods
export interface SSEContextValue {
  events: HookReturn['events'];
  start: HookReturn['start'];
  stop: HookReturn['stop'];
  clearEvents: () => void;
}

// Create context
const SSEContext = createContext<SSEContextValue | null>(null);

export const SSEProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  // Initialize SSE via your existing hook
  const hook = useDominofySSE(config.backendBaseUrl);
  const { events: hookEvents, start, stop } = hook;

  // Maintain a local copy of events to allow clearing
  const [events, setEvents] = useState(hookEvents);

  // Sync hook events into local state
  useEffect(() => {
    setEvents(hookEvents);
  }, [hookEvents]);

  // Clear buffered events
  const clearEvents = () => setEvents([]);

  return (
    <SSEContext.Provider value={{ events, start, stop, clearEvents }}>
      {children}
    </SSEContext.Provider>
  );
};

export function useSSE(): SSEContextValue {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error('useSSE must be used within an SSEProvider');
  return ctx;
}
