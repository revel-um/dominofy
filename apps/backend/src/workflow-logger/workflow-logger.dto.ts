import { IsString, IsNotEmpty, IsEnum, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowLogStatus } from './workflow-log-status.enum';

export class WorkflowLogOutputDto {
  @IsNotEmpty()
  seq: number;

  @IsOptional()
  output: any;
}

export class WorkflowLogErrorDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  stack?: string;
}

export class CreateWorkflowLogDto {
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @IsString()
  @IsNotEmpty()
  runId: string;

  @IsString()
  @IsNotEmpty()
  dominoId: string;

  @IsEnum(WorkflowLogStatus)
  status: WorkflowLogStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowLogOutputDto)
  @IsOptional()
  output?: WorkflowLogOutputDto[];

  @ValidateNested()
  @Type(() => WorkflowLogErrorDto)
  @IsOptional()
  error?: WorkflowLogErrorDto;
}
