import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProviderName, PayoutMode } from './payments.enums';

export class ConnectPayerProviderDto {
  @IsEnum(PaymentProviderName)
  providerName: PaymentProviderName;

  @IsString()
  @IsNotEmpty()
  companyName: string;
}

export class CreateRecipientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class AddBankInstrumentDto {
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  ifsc: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AddUpiInstrumentDto {
  @IsString()
  @IsNotEmpty()
  vpa: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class PayoutRequestDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  instrumentId: string;

  @IsNumber()
  @Min(1)
  amountPaise: number;

  @IsEnum(PayoutMode)
  mode: PayoutMode;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class BulkPayoutItemDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  instrumentId: string;

  @IsNumber()
  @Min(1)
  amountPaise: number;

  @IsEnum(PayoutMode)
  mode: PayoutMode;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class BulkPayoutRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPayoutItemDto)
  payouts: BulkPayoutItemDto[];
}

export class WorkflowPayoutRequestDto {
  @IsString()
  @IsNotEmpty()
  payerId: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsOptional()
  @IsString()
  instrumentId?: string;

  @IsOptional()
  @IsObject()
  bankDetails?: AddBankInstrumentDto;

  @IsOptional()
  @IsObject()
  upiDetails?: AddUpiInstrumentDto;

  @IsNumber()
  @Min(1)
  amountPaise: number;

  @IsEnum(PayoutMode)
  mode: PayoutMode;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  workflowRunId?: string;

  @IsOptional()
  @IsString()
  stepId?: string;
}

export class WorkflowBulkPayoutItemDto {
  @IsObject()
  recipient: CreateRecipientDto;

  @IsOptional()
  @IsObject()
  instrument?: AddBankInstrumentDto | AddUpiInstrumentDto;

  @IsOptional()
  @IsString()
  instrumentId?: string;

  @IsNumber()
  @Min(1)
  amountPaise: number;

  @IsEnum(PayoutMode)
  mode: PayoutMode;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class WorkflowBulkPayoutRequestDto {
  @IsString()
  @IsNotEmpty()
  payerId: string;

  @IsArray()
  payouts: WorkflowBulkPayoutItemDto[];

  @IsOptional()
  @IsString()
  defaultPurpose?: string;

  @IsOptional()
  @IsEnum(PayoutMode)
  defaultMode?: PayoutMode;

  @IsOptional()
  @IsString()
  workflowRunId?: string;

  @IsOptional()
  @IsString()
  stepId?: string;
}

export class RefreshPayerStatusDto {
  @IsOptional()
  @IsBoolean()
  refresh?: boolean;
}
