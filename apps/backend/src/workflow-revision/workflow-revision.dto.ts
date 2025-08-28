import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class AiGenerateDto {
  @IsString()
  prompt: string;
}

export class AiGenerateResponseDto {
  nodes: any[];
  edges: any[];
  explanation: string;
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