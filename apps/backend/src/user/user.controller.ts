// user/user.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { BaseController } from '../common/base.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserDto, SigninUserDto } from './user.dto';

@Controller('user')
export class UserController extends BaseController<
  User,                  // Entity type returned by the service
  Partial<CreateUserDto>,// DTO accepted on POST /
  Partial<CreateUserDto>,// DTO accepted on POST /:id (can omit, defaults to Partial<Create>)
  string,                // ID type
  UserService            // concrete service to inject
> {
  constructor(private readonly userService: UserService) {
    super(userService, CreateUserDto);  // BaseController needs the service instance
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)  // returns 200 instead of 201
  login(@Body() { email, password }: SigninUserDto) {
    return this.userService.login(email!, password!);
  }

  @Post()
  async setupUser(@Body() data: CreateUserDto) {
    const user = await CreateUserDto.toEncryptedPasswordUser(data);
    return this.userService.setupUser(user);
  }

  @Get()
  find(@Req() req: Request) {
    const id = (req as any).user.id;
    return this.vaultService.findOne(id);
  }

  /** encrypt password before persisting */
  protected async beforeCreate(dto: CreateUserDto) {
    return CreateUserDto.toEncryptedPasswordUser(dto);
  }
}
