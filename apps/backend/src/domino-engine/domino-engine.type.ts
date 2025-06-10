// domino-engine/types.ts
export interface ExecuteContext {
  runId: string;                    // same runId we bubble up to SSE
  input: Record<string, any>;       // outputs of parent dominos
  globals?: Record<string, any>;    // DB handles, env, secrets, etc.
}

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
}
