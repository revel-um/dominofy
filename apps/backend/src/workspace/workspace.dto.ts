import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkspaceRole } from './workspace-membership.entity';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

export class InviteWorkspaceMemberDto {
  @IsEmail({}, { message: 'Enter a valid email' })
  email: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}

export class AcceptWorkspaceInviteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password?: string;
}
