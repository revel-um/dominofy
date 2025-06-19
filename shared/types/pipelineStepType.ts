export interface PipelineStep {
  id: string;
  type: string;
  data: Record<string, any>;
  next: Record<string, string[]>;
}
