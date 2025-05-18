import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { decryptPassword } from 'src/helper/encryption';
import { generateJwtToken } from 'src/helper/generate.token';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    super(userRepository);
  }

  async login(email: string, password: string) {
    // Check if email exists and password matches with the encrypted password
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && await decryptPassword(user.password) == password) {
      const token = generateJwtToken({ id: user.id, email: user.email }, this.configService.get<string>('JWT_SECRET')!);
      return { token };
    }
    throw new Error('Invalid email or password');
  }
}
