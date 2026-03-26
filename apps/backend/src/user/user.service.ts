import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { User } from './user.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { decryptPassword } from 'src/helper/encryption';
import { generateJwtToken } from 'src/helper/generate.token';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './user.dto';
import { ProjectsService } from 'src/projects/projects.service';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { RefreshToken } from 'src/auth/refresh-token.entity';
import * as crypto from 'crypto';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    @Inject(forwardRef(() => WorkspaceService))
    private readonly workspaceService: WorkspaceService,
    private readonly dataSource: DataSource,
  ) {
    super(userRepository);
  }

  async login(email: string, password: string) {
    // Check if email exists and password matches with the encrypted password
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && user.password && await decryptPassword(user.password) == password) {
      const accessToken = generateJwtToken(
        { id: user.id, email: user.email },
        this.configService.get<string>('JWT_SECRET')!,
      );
      const refreshToken = await this.generateRefreshToken(user.id);

      return {
        token: accessToken,
        accessToken,
        refreshToken: refreshToken.token,
      };
    }
    throw new Error('Invalid email or password');
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async setupUser(dto: CreateUserDto) {
    const result = await this.createUserWithPersonalWorkspace({
      name: dto.name,
      email: dto.email,
      password: dto.password,
    });

    const accessToken = generateJwtToken(
      { id: result.user.id, email: result.user.email },
      this.configService.get<string>('JWT_SECRET')!,
    );
    const refreshToken = await this.generateRefreshToken(result.user.id);

    return {
      token: accessToken,
      accessToken,
      refreshToken: refreshToken.token,
      user: result.user,
      workspace: result.workspace,
      project: result.project,
      workflow: result.defaultWorkflow,
    };
  }

  async createOAuthUser(dto: Pick<CreateUserDto, 'name' | 'email'>) {
    const result = await this.createUserWithPersonalWorkspace({
      name: dto.name,
      email: dto.email,
      password: null,
    });

    return result.user;
  }

  private async createUserWithPersonalWorkspace(dto: {
    name: string;
    email: string;
    password: string | null;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        name: dto.name,
        email: dto.email,
        password: dto.password,
      });
      const savedUser = await manager.save(user);

      const { workspace } = await this.workspaceService.createWorkspaceWithOwner(
        { name: `${savedUser.name}'s Workspace` },
        savedUser.id,
        manager,
      );

      const { project, defaultWorkflow } =
        await this.projectsService.createProjectWithDefaultWorkflowInManager(
          manager,
          {
            name: 'Project 1',
            description: 'Default project',
            workspaceId: workspace.id,
          },
          savedUser.id,
          workspace.id,
        );

      return {
        user: savedUser,
        workspace,
        project,
        defaultWorkflow,
      };
    });
  }

  private async generateRefreshToken(userId: string): Promise<RefreshToken> {
    const token = crypto.randomBytes(40).toString('hex');
    const ttlDays = Number(this.configService.get('REFRESH_TOKEN_TTL_DAYS') || 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (Number.isFinite(ttlDays) ? ttlDays : 30));

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
      isRevoked: false,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }
}
