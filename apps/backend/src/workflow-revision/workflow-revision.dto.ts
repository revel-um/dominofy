import { IsString, IsOptional, IsNumber, IsArray, IsObject } from 'class-validator';

export class AiGenerateDto {
  @IsString()
  prompt: string;

  /** Real-time workflow state from the frontend canvas (nodes + edges).
   *  When provided, this takes precedence over the DB-persisted visualJson
   *  so the AI sees unsaved changes. */
  @IsOptional()
  current_json?: Record<string, any>;
}

export class AiGenerateResponseDto {
  nodes: any[];
  edges: any[];
  explanation: string;
  status?: string;
  thought_summaries?: string[];
  chain_of_thought?: string[];
}

export class WorkflowRevisionDto {
  rev_id: number;
  workflow: string;
  user: string;
  diff_json: unknown;
  ai_prompt: string;
  ai_explanation: string;
  created_at: Date;
}

export class WorkflowRevisionListDto {
  @IsOptional()
  @IsNumber()
  limit?: number = 10;
} 
