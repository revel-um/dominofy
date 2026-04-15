// src/hooks/useDominofySSE.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

export type RunMockInput = Record<string, any>;

interface UseDominofySSEResult {
  /** Array of JSON‐parsed SSE messages */
  events: unknown[];
  /** True if EventSource is currently open */
  connected: boolean;
  /** Any error string, or null */
  error: string | null;
  /** Call this to kick off POST + open SSE, now providing an `id` */
  start: (id: string, token: string, mockInput?: RunMockInput) => Promise<void>;
  /** (Optional) Close the current SSE stream */
  stop: () => void;
  activeWorkflowId: string | null;
}

/**
 * Hook that does NOT automatically open SSE.
 * You must call `start(id, pipeline)` to begin.
 */
export function useDominofySSE(
  backendUrl: string
): UseDominofySSEResult {
  const [events, setEvents] = useState<unknown[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);

  // We'll keep the EventSource reference here so we can close it later.
  const esRef = useRef<EventSource | null>(null);

  // Track if the connection was closed deliberately
  const closedDeliberatelyRef = useRef<boolean>(false);

  /**
   * start(id, pipeline):
   *   1) POST pipeline + id → /dominofy?id=<id>
   *   2) Open EventSource → /dominofy/event?id=<id>
   *   3) Wire up onopen, onmessage, onerror
   */
  const start = useCallback(
    async (id: string, token: string, mockInput: RunMockInput = {}) => {
      closedDeliberatelyRef.current = false; // reset when starting

      if (!id) {
        console.warn('useDominofySSE.start(): id is empty.');
        return;
      }

      // Force close any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      // Reset all state
      setEvents([]);
      setError(null);
      setConnected(false);
      setActiveWorkflowId(id);

      let runToken = '';
      try {
        const response = await fetch(`${backendUrl}/dominofy/run/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mockInput }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create run session (${response.status})`);
        }

        const payload = await response.json();
        runToken = typeof payload?.runToken === 'string' ? payload.runToken : '';
      } catch (err) {
        console.error('Failed to create run session:', err);
        setError('Could not start run session.');
        setActiveWorkflowId(null);
        return;
      }

      // Small delay to ensure cleanup before starting new connection
      setTimeout(() => {
        const es = new EventSourcePolyfill(
          `${backendUrl}/dominofy/event/${encodeURIComponent(id)}?runToken=${encodeURIComponent(runToken)}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        esRef.current = es;

        es.onopen = () => {
          setConnected(true);
        };

        es.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            setEvents((prev) => [...prev, parsed]);
          } catch {
            if (e.data == 'terminate') {
              closedDeliberatelyRef.current = true;
              setConnected(false);
              es.close();
              return;
            }
            console.warn('Could not parse SSE data as JSON:', e.data);
          }
        };

        es.onerror = (evt) => {
          if (closedDeliberatelyRef.current) return;
          console.error('SSE error for id=', id, evt);
          setError('SSE connection error or closed.');
          setConnected(false);
          if (esRef.current === es) {
            es.close();
            esRef.current = null;
          }
        };
      }, 100);
    },
    [backendUrl]
  );

  /**
   * stop():
   *   Closes any open EventSource.
   */
  const stop = useCallback(() => {
    closedDeliberatelyRef.current = true;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
    setError(null);
    setActiveWorkflowId(null);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  return { events, connected, error, start, stop, activeWorkflowId };
}
