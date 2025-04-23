export type PipelineStep = {
    id: string;
    type: string; // "print", "math", etc.
    data: Record<string, any>;
    next: string[]; // IDs of next nodes
  };
  