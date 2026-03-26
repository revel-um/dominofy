import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { Workspace } from './workspace.entity';
import {
  WorkspaceMembership,
  WorkspaceMembershipAcceptanceStatus,
  WorkspaceRole,
} from './workspace-membership.entity';
import { CreateWorkspaceDto } from './workspace.dto';
import { User, UserAccountStatus } from 'src/user/user.entity';
import { Project } from 'src/projects/projects.entity';
import { AcceptWorkspaceInviteDto, InviteWorkspaceMemberDto } from './workspace.dto';
import { WorkspaceInvitation } from './workspace-invitation.entity';
import { encryptPassword } from 'src/helper/encryption';
import { EmailService } from 'src/email/email.service';
import * as crypto from 'crypto';

const DEFAULT_WRITE_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
];

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMembership)
    private readonly membershipRepository: Repository<WorkspaceMembership>,
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  async listForUser(userId: string, query?: string) {
    const qb = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.workspace', 'workspace')
      .leftJoinAndSelect('workspace.createdBy', 'createdBy')
      .leftJoin('membership.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('membership.createdAt', 'ASC');

    if (query?.trim()) {
      const normalizedQuery = `%${query.trim()}%`;
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('workspace.name ILIKE :query', { query: normalizedQuery })
            .orWhere('createdBy.name ILIKE :query', { query: normalizedQuery })
            .orWhere('createdBy.email ILIKE :query', { query: normalizedQuery });
        }),
      );
    }

    const memberships = await qb.getMany();

    return Promise.all(
      memberships.map(async (membership) => {
        const workspaceId = membership.workspace.id;
        const [projectCount, memberCount] = await Promise.all([
          this.projectRepository.count({
            where: { workspace: { id: workspaceId } } as any,
          }),
          this.membershipRepository.count({
            where: { workspace: { id: workspaceId } } as any,
          }),
        ]);

        return {
          id: workspaceId,
          name: membership.workspace.name,
          slug: membership.workspace.slug ?? null,
          role: membership.role,
          projectCount,
          memberCount,
          createdById: membership.workspace.createdBy?.id ?? null,
          createdByName: membership.workspace.createdBy?.name ?? null,
          createdByEmail: membership.workspace.createdBy?.email ?? null,
          isOwnedByUser: membership.workspace.createdBy?.id === userId,
        };
      }),
    );
  }

  async createWorkspaceForUser(
    dto: CreateWorkspaceDto,
    userId: string,
    manager?: EntityManager,
  ) {
    const result = await this.createWorkspaceWithOwner(dto, userId, manager);
    return result.workspace;
  }

  async createWorkspaceWithOwner(
    dto: Pick<CreateWorkspaceDto, 'name'> & Partial<CreateWorkspaceDto>,
    userId: string,
    manager?: EntityManager,
  ) {
    const workspaceRepo = manager
      ? manager.getRepository(Workspace)
      : this.workspaceRepository;
    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;

    const workspace = workspaceRepo.create({
      name: dto.name,
      slug: dto.slug ?? null,
      createdBy: { id: userId } as User,
    });
    const savedWorkspace = await workspaceRepo.save(workspace);

    const membership = membershipRepo.create({
      workspace: savedWorkspace,
      user: { id: userId } as User,
      role: WorkspaceRole.OWNER,
    });
    const savedMembership = await membershipRepo.save(membership);

    return {
      workspace: savedWorkspace,
      membership: savedMembership,
    };
  }

  async getAccessibleWorkspaceIds(
    userId: string,
    allowedRoles?: WorkspaceRole[],
    manager?: EntityManager,
  ) {
    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;
    const where: any = { user: { id: userId } };
    if (allowedRoles?.length) {
      where.role = In(allowedRoles);
    }

    const memberships = await membershipRepo.find({
      where,
      relations: ['workspace'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => membership.workspace.id);
  }

  async resolveWorkspaceIdForUser(
    userId: string,
    workspaceId?: string,
    allowedRoles: WorkspaceRole[] = DEFAULT_WRITE_ROLES,
    manager?: EntityManager,
  ) {
    if (workspaceId) {
      await this.assertWorkspaceAccess(userId, workspaceId, allowedRoles, manager);
      return workspaceId;
    }

    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;

    const membership = await membershipRepo.findOne({
      where: {
        user: { id: userId },
        role: In(allowedRoles),
      } as any,
      relations: ['workspace'],
      order: { createdAt: 'ASC' },
    });

    if (!membership) {
      throw new NotFoundException('No writable workspace found for this user');
    }

    return membership.workspace.id;
  }

  async assertWorkspaceAccess(
    userId: string,
    workspaceId: string,
    allowedRoles: WorkspaceRole[] = Object.values(WorkspaceRole),
    manager?: EntityManager,
  ) {
    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;

    const membership = await membershipRepo.findOne({
      where: {
        user: { id: userId },
        workspace: { id: workspaceId },
        role: In(allowedRoles),
      } as any,
      relations: ['workspace', 'user'],
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    return membership;
  }

  async getCurrentWorkspaceSummary(userId: string, workspaceId?: string) {
    const membership = workspaceId
      ? await this.assertWorkspaceAccess(userId, workspaceId)
      : await this.membershipRepository.findOne({
          where: { user: { id: userId } } as any,
          relations: ['workspace'],
          order: { createdAt: 'ASC' },
        });

    if (!membership) {
      throw new NotFoundException('No workspace found for this user');
    }

    const resolvedWorkspaceId = membership.workspace.id;

    const [projectCount, memberCount] = await Promise.all([
      this.projectRepository.count({
        where: { workspace: { id: resolvedWorkspaceId } } as any,
      }),
      this.membershipRepository.count({
        where: { workspace: { id: resolvedWorkspaceId } } as any,
      }),
    ]);

    return {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug ?? null,
      role: membership.role,
      projectCount,
      memberCount,
    };
  }

  async listMembers(
    userId: string,
    workspaceId: string,
    limit = 25,
    offset = 0,
  ) {
    await this.assertWorkspaceAccess(userId, workspaceId);

    const [memberships, count] = await this.membershipRepository.findAndCount({
      where: { workspace: { id: workspaceId } } as any,
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });

    return {
      data: memberships.map((membership) => ({
        id: membership.id,
        userId: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        joinedAt: membership.createdAt,
        acceptanceStatus: membership.acceptanceStatus,
      })),
      count,
      limit,
      offset,
      hasMore: offset + memberships.length < count,
    };
  }

  async inviteMember(userId: string, workspaceId: string, dto: InviteWorkspaceMemberDto) {
    await this.assertWorkspaceAccess(userId, workspaceId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const role = dto.role ?? WorkspaceRole.MEMBER;

    if (role === WorkspaceRole.OWNER) {
      throw new BadRequestException('New members cannot be invited as owner');
    }

    let targetUser = await this.userRepository.findOne({
      where: { email: normalizedEmail } as any,
    });

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId } as any,
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    let createdPendingUser = false;
    if (!targetUser) {
      const inferredName = normalizedEmail.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Dominofy user';
      targetUser = await this.userRepository.save(
        this.userRepository.create({
          email: normalizedEmail,
          name: inferredName
            .split(' ')
            .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
            .join(' '),
          password: null,
          accountStatus: UserAccountStatus.PENDING_INVITE,
        }),
      );
      createdPendingUser = true;
    }

    const requiresPasswordSetup = createdPendingUser || !targetUser.password;

    const existingMembership = await this.membershipRepository.findOne({
      where: {
        workspace: { id: workspaceId },
        user: { id: targetUser.id },
      } as any,
      relations: ['workspace', 'user'],
    });

    if (existingMembership) {
      if (existingMembership.role !== role) {
        existingMembership.role = role;
      }
      existingMembership.acceptanceStatus = requiresPasswordSetup
        ? WorkspaceMembershipAcceptanceStatus.PENDING
        : WorkspaceMembershipAcceptanceStatus.ACCEPTED;
      existingMembership.invitedAt = new Date();
      if (!requiresPasswordSetup) {
        existingMembership.acceptedAt = existingMembership.acceptedAt ?? new Date();
      }
      await this.membershipRepository.save(existingMembership);

      return {
        id: existingMembership.id,
        userId: existingMembership.user.id,
        name: existingMembership.user.name,
        email: existingMembership.user.email,
        role: existingMembership.role,
        joinedAt: existingMembership.createdAt,
        acceptanceStatus: existingMembership.acceptanceStatus,
      };
    }

    const membership = this.membershipRepository.create({
      workspace: { id: workspaceId } as Workspace,
      user: { id: targetUser.id } as User,
      role,
      acceptanceStatus: WorkspaceMembershipAcceptanceStatus.PENDING,
      invitedAt: new Date(),
      acceptedAt: null,
    });
    const savedMembership = await this.membershipRepository.save(membership);

    await this.createAndSendInvitation(
      workspace,
      targetUser,
      savedMembership,
      { requiresPasswordSetup },
    );

    return {
      id: savedMembership.id,
      userId: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: savedMembership.role,
      joinedAt: savedMembership.createdAt,
      acceptanceStatus: savedMembership.acceptanceStatus,
    };
  }

  async getInvitationDetails(token: string) {
    const invitation = await this.invitationRepository.findOne({
      where: { token } as any,
      relations: ['workspace', 'user', 'membership'],
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('Invitation link is invalid or expired');
    }

    const requiresPasswordSetup =
      invitation.user.accountStatus === UserAccountStatus.PENDING_INVITE || !invitation.user.password;

    return {
      email: invitation.email,
      workspaceName: invitation.workspace.name,
      invitedUserName: invitation.user.name,
      requiresPasswordSetup,
    };
  }

  async acceptInvitation(token: string, dto: AcceptWorkspaceInviteDto) {
    const invitation = await this.invitationRepository.findOne({
      where: { token } as any,
      relations: ['workspace', 'user', 'membership'],
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('Invitation link is invalid or expired');
    }

    const requiresPasswordSetup =
      invitation.user.accountStatus === UserAccountStatus.PENDING_INVITE || !invitation.user.password;

    if (requiresPasswordSetup) {
      if (!dto.name?.trim()) {
        throw new BadRequestException('Name is required to accept this invitation');
      }
      if (!dto.password?.trim()) {
        throw new BadRequestException('Password is required to accept this invitation');
      }

      invitation.user.name = dto.name.trim();
      invitation.user.password = await encryptPassword(dto.password);
      invitation.user.accountStatus = UserAccountStatus.ACTIVE;
      await this.userRepository.save(invitation.user);
    } else if (dto.name?.trim() && dto.name.trim() !== invitation.user.name) {
      invitation.user.name = dto.name.trim();
      await this.userRepository.save(invitation.user);
    }

    invitation.membership.acceptanceStatus = WorkspaceMembershipAcceptanceStatus.ACCEPTED;
    invitation.membership.acceptedAt = new Date();
    await this.membershipRepository.save(invitation.membership);

    invitation.usedAt = new Date();
    await this.invitationRepository.save(invitation);

    return {
      success: true,
      workspaceName: invitation.workspace.name,
      email: invitation.email,
    };
  }

  private async createAndSendInvitation(
    workspace: Workspace,
    user: User,
    membership: WorkspaceMembership,
    options?: { requiresPasswordSetup?: boolean },
  ) {
    const invitation = this.invitationRepository.create({
      email: user.email,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      workspace: { id: workspace.id } as Workspace,
      user: { id: user.id } as User,
      membership: { id: membership.id } as WorkspaceMembership,
    });
    const savedInvitation = await this.invitationRepository.save(invitation);
    await this.sendWorkspaceInviteEmail(
      savedInvitation,
      workspace.name,
      user.name,
      Boolean(options?.requiresPasswordSetup),
    );
    return savedInvitation;
  }

  private async sendWorkspaceInviteEmail(
    invitation: WorkspaceInvitation,
    workspaceName: string,
    recipientName: string,
    requiresPasswordSetup: boolean,
  ) {
    const inviteVaultId = this.configService.get<string>('INVITE_EMAIL_VAULT_ID');
    const from = this.configService.get<string>('INVITE_EMAIL_FROM') || 'noreply@dominofy.com';
    const webBaseUrl = this.configService.get<string>('APP_WEB_URL') || 'http://localhost:3000';

    if (!inviteVaultId) {
      console.warn('Workspace invite email skipped because INVITE_EMAIL_VAULT_ID is missing');
      return;
    }

    const acceptUrl = `${webBaseUrl.replace(/\/$/, '')}/accept-invite?token=${invitation.token}`;
    const safeRecipientName = this.escapeHtml(recipientName || invitation.email);
    const safeWorkspaceName = this.escapeHtml(workspaceName);
    const introText = requiresPasswordSetup
      ? `You have been invited to join the "${workspaceName}" workspace on Dominofy.`
      : `You have been invited to join the "${workspaceName}" workspace on Dominofy with your existing account.`;
    const actionText = requiresPasswordSetup
      ? 'Create your password and accept the invitation here:'
      : 'Review and accept the invitation here:';
    const buttonLabel = requiresPasswordSetup
      ? 'Create your password and accept the invitation'
      : 'Accept your workspace invitation';

    await this.emailService.sendEmail(
      inviteVaultId,
      invitation.email,
      `You are invited to ${workspaceName} on Dominofy`,
      {
        from,
        text: [
          `Hi ${recipientName || invitation.email},`,
          '',
          introText,
          '',
          actionText,
          acceptUrl,
          '',
          'This invitation link expires in 7 days.',
          '',
          'If you were not expecting this invitation, you can ignore this email.',
        ].join('\n'),
        html: `
          <div style="background:#f3f8ff;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbeafe;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.10);">
              <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#0369a1 100%);color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.85;">Dominofy Workspace Invite</div>
                <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;font-weight:700;">Join ${safeWorkspaceName}</h1>
              </div>
              <div style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${safeRecipientName},</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#334155;">
                  ${this.escapeHtml(introText)}
                </p>
                <div style="margin:24px 0;padding:20px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1e3a8a;">${this.escapeHtml(actionText)}</p>
                  <a href="${acceptUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">
                    ${this.escapeHtml(buttonLabel)}
                  </a>
                </div>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">
                  This invitation link expires in 7 days.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
                  If you were not expecting this invitation, you can safely ignore this email.
                </p>
              </div>
            </div>
          </div>
        `,
      },
    );
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
