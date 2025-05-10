import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './user.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    findAll() {
      return this.userService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.userService.findOne(id);
    }
    
    @Post()
    async create(@Body() user: Partial<CreateUserDto>) {
      const data = await CreateUserDto.toEncryptedPasswordUser(user);
      return this.userService.create(data);
    }
    
    @Post(':id')
    update(@Param('id') id: string, @Body() user: Partial<CreateUserDto>) {
      return this.userService.update(id, user);
    }
    
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.userService.remove(id);
    }
}
