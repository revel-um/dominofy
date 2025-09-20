import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { decryptPassword } from 'src/helper/encryption';
import { generateJwtToken } from 'src/helper/generate.token';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './user.dto';
import { ProjectsService } from 'src/projects/projects.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly projectsService: ProjectsService
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
    // 1. Create user first
    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: dto.password, // assume already hashed
    });
    const savedUser = await this.userRepository.save(user);

    // 2. Create default project (which automatically creates default workflow)
    const result = await this.projectsService.createProjectWithDefaultWorkflow(
      {
        name: 'Project 1',
        description: 'Default project',
      },
      savedUser.id
    );

    // 3. Generate token
    const token = generateJwtToken(
      { id: savedUser.id, email: savedUser.email },
      this.configService.get<string>('JWT_SECRET')!,
    );

    // 4. Return result with same structure as before
    return {
      token,
      user: savedUser,
      project: result.project,
      workflow: result.defaultWorkflow,
    };
  }
}
