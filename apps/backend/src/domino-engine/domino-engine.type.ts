// domino-engine/types.ts

export interface ExecuteContext {
  /** Same runId bubbled up to SSE */
  runId: string;
  done?: any;

  /** Aggregated inputs coming from parent dominos */
  input: Record<string, any>;

  /** Optional global helpers (DB handles, env, secrets, etc.) */
  globals?: Record<string, any>;

  /* ────────────── Added for state‑ful dominos (Iterator, etc.) ────────────── */

  /** Scratch‑pad that persists for *this* domino for the lifetime of the run */
  local: Record<string, any>;

  /**
   * Safe mutator for the scratch‑pad.  
   * – `setLocal(key, value)` → add / update entry  
   * – `setLocal(key, undefined)` → delete entry
   */
  setLocal: (key: string, value: any) => void;

  /** Allow long‑running dominos to support cooperative cancellation */
  abortSignal?: AbortSignal;
}

/* ─────────────────────────────────────────────────────────────────────────── */

export interface DominoExecutable {
  id: string;
  type: string;
  /** Kick off the work and resolve when done */
  execute(ctx: ExecuteContext): Promise<DominoResult>;
}

export interface DominoResult {
  id: string;
  output: any;
  startedAt: number;
  finishedAt: number;
  isMultiOutPinDomino?: boolean; // true if multiple out pins are used
  /** Exec‑out pins to trigger; optional because single‑branch dominos need none */
  nextChainKeys?: string[];
  done?: boolean; // true if this domino is done and no more executions are expected
}
