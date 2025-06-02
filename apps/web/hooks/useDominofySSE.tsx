// src/hooks/useDominofySSE.tsx
import { useEffect, useRef, useState } from 'react';

export interface PipelineStep {
  // (fill in whatever fields your shared PipelineStep type has)
  id: string;
  name: string;
  // …etc.
}

interface UseDominofySSEOptions {
  /**
   * The pipeline array you want to run. 
   * An array of PipelineStep objects.
   */
  pipeline: PipelineStep[];

  /**
   * The full URL (including protocol + host) of your NestJS server.
   * Example: "http://localhost:3000"
   */
  backendUrl: string;
}

interface UseDominofySSEResult {
  /**
   * All SSE messages received so far, in the order they arrived.
   */
  events: unknown[];

  /**
   * True while the SSE connection is open.
   */
  connected: boolean;

  /**
   * If the SSE stream errors out, an Error object or message (otherwise null).
   */
  error: string | null;
}

/**
 * Custom React hook that:
 *   1. POSTs the pipeline to /dominofy 
 *   2. Opens an EventSource to /dominofy/event 
 *   3. Aggregates incoming SSE messages in `events`.
 */
export function useDominofySSE({
  pipeline,
  backendUrl,
}: UseDominofySSEOptions): UseDominofySSEResult {
  const [events, setEvents] = useState<unknown[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!pipeline || pipeline.length === 0) {
      return;
    }

    // 1) First, POST the pipeline to /dominofy (so NestJS knows which job to run).
    //    We fire-and-forget this fetch; SSE will stream back results once the server is ready.
    fetch(`${backendUrl}/dominofy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    }).catch((err) => {
      console.error('Failed to POST pipeline:', err);
      setError('Could not start pipeline.');
    });

    // 2) Then open an EventSource to /dominofy/event
    const sseUrl = `${backendUrl}/dominofy/event`;
    const es = new EventSource(sseUrl, { withCredentials: false });
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('SSE connection opened');
      setConnected(true);
    };

    es.onmessage = (e) => {
      try {
        // Parse the JSON data from the server. Adjust deserialization as needed.
        const parsed = JSON.parse(e.data);
        setEvents((prev) => [...prev, parsed]);
      } catch (parseErr) {
        console.warn('Could not parse SSE data as JSON:', e.data);
      }
    };

    es.onerror = (evt) => {
      console.error('SSE error:', evt);
      setError('Connection lost or server error.');
      setConnected(false);
      // Optionally close on error:
      es.close();
    };

    return () => {
      // cleanup when component unmounts or pipeline changes:
      console.log('Closing SSE');
      es.close();
      setConnected(false);
    };
  }, [pipeline, backendUrl]);

  return { events, connected, error };
}
