import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsObject()
  @IsNotEmpty()
  visualJson: any;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  static from(partial: Partial<CreateWorkflowDto>) {
    return {
      name: partial.name,
      user: partial.userId,
      project: partial.projectId,
      visualJson: partial.visualJson,
      isPublished: partial.isPublished ?? false,
    }
  }
}
