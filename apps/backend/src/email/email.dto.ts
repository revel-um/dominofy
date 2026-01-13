import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmailConnectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  fromEmail!: string;

  @IsString()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  smtpPort!: number;

  @IsString()
  smtpUser!: string;

  @IsString()
  smtpPass!: string;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;
}

export class SendEmailDto {
  @IsString()
  @IsNotEmpty()
  vaultId!: string;

  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  cc?: string | string[];

  @IsOptional()
  bcc?: string | string[];

  @IsOptional()
  @IsString()
  replyTo?: string;
}
