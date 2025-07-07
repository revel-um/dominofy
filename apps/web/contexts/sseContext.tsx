// src/contexts/SSEContext.tsx
import React, { createContext, useContext } from 'react';
import { useDominofySSE } from '@/hooks/useDominofySSE';
import { config } from '@/config/config';

type SSE = ReturnType<typeof useDominofySSE>;

const SSEContext = createContext<SSE | null>(null);

export const SSEProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const sse = useDominofySSE(config.backendBaseUrl);
  return <SSEContext.Provider value={sse}>{children}</SSEContext.Provider>;
};

export function useSSE() {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error('useSSE must be used within an SSEProvider');
  return ctx;
}
