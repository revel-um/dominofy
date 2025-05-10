import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService extends BaseService<User>{
    constructor(
      @InjectRepository(User)
        private readonly userRepository: Repository<User>,
      ) {
        super(userRepository);
      }
}
