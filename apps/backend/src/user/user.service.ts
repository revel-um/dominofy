import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { User } from './user.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { decryptPassword } from 'src/helper/encryption';
import { generateJwtToken } from 'src/helper/generate.token';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './user.dto';
import { Project } from 'src/projects/projects.entity';
import { Workflow } from 'src/workflow/workflow.entity';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource
  ) {
    super(userRepository);
  }

  async login(email: string, password: string) {
    // Check if email exists and password matches with the encrypted password
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && user.password && await decryptPassword(user.password) == password) {
      const token = generateJwtToken({ id: user.id, email: user.email }, this.configService.get<string>('JWT_SECRET')!);
      return { token };
    }
    throw new Error('Invalid email or password');
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async setupUser(dto: CreateUserDto) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Create user
      const user = manager.create(User, {
        name: dto.name,
        email: dto.email,
        password: dto.password, // assume already hashed
      });
      await manager.save(user);

      // 2. Create default project
      const project = manager.create(Project, {
        name: 'Project 1',
        description: 'Default project',
        user,
        isActive: true,
        isDefault: true
      });
      await manager.save(project);

      // 3. Create default workflow
      const workflow = manager.create(Workflow, {
        name: 'Init',
        description: 'Default workflow',
        project,
        isDefault: true,
        user,
      });
      await manager.save(workflow);

      // 4. Generate token
      const token = generateJwtToken(
        { id: user.id, email: user.email },
        this.configService.get<string>('JWT_SECRET')!,
      );

      // 5. Return result
      return {
        token,
        user,
        project,
        workflow,
      };
    });
  }
}
