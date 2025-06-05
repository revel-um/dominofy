// src/hooks/useDominofySSE.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

interface UseDominofySSEResult {
  /** Array of JSON‐parsed SSE messages */
  events: unknown[];
  /** True if EventSource is currently open */
  connected: boolean;
  /** Any error string, or null */
  error: string | null;
  /** Call this to kick off POST + open SSE, now providing an `id` */
  start: (id: string, token: string) => void;
  /** (Optional) Close the current SSE stream */
  stop: () => void;
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

  // We'll keep the EventSource reference here so we can close it later.
  const esRef = useRef<EventSource | null>(null);

  /**
   * start(id, pipeline):
   *   1) POST pipeline + id → /dominofy?id=<id>
   *   2) Open EventSource → /dominofy/event?id=<id>
   *   3) Wire up onopen, onmessage, onerror
   */
  const start = useCallback(
    (id: string, token: string) => {
      if (!id) {
        console.warn('useDominofySSE.start(): id is empty.');
        return;
      }

      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      setEvents([]);
      setError(null);
      setConnected(false);

      const es = new EventSourcePolyfill(
        `${backendUrl}/dominofy/event/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      ); esRef.current = es;

      es.onopen = () => {
        console.log('SSE connection opened for id=', id);
        setConnected(true);
      };

      es.onmessage = (e) => {
        try {
          // const parsed = JSON.parse(e.data);
          const parsed = e.data;
          console.log('SSE message received:', parsed);
          setEvents((prev) => [...prev, parsed]);
        } catch {
          console.warn('Could not parse SSE data as JSON:', e.data);
        }
      };

      es.addEventListener('done', (e) => {
        const msg = e as MessageEvent;
        console.log('Received done event:', msg.data);
        es.close();
        setConnected(false);
      });

      es.onerror = (evt) => {
        if (!connected) {
          es.close();
          return;
        }
        console.error('SSE error for id=', id, evt);
        setError('SSE connection error or closed.');
        setConnected(false);
        es.close();
        esRef.current = null;
      };
    },
    [backendUrl]
  );

  /**
   * stop():
   *   Closes any open EventSource.
   */
  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setConnected(false);
    }
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

  return { events, connected, error, start, stop };
}
