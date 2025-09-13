import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum SupportCategory {
  Billing = 'billing',
  Technical = 'technical',
  General = 'general',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export class CreateSupportDto {
  @IsString()
  @MinLength(3)
  subject!: string;

  @IsString()
  @MinLength(10)
  message!: string;

  @IsEnum(SupportCategory)
  @IsOptional()
  category?: SupportCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority = TicketPriority.Medium;
}
