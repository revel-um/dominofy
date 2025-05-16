// common/base.controller.ts
import {
  Body,
  Post,
  Delete,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IBaseService } from './base.interfaces';

export abstract class BaseController<
  Entity,
  Create extends object,                 // ← add “extends object” here
  Update extends Partial<Create> = Partial<Create>,
  Id = string,
  Service extends IBaseService<Entity, Create, Update, Id> = IBaseService<
    Entity,
    Create,
    Update,
    Id
  >,
> {
  constructor(
    protected readonly service: Service,
    private readonly createDto: new () => Create,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: Id) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: Create) {
    // 1) transform to DTO instance
    const instance = plainToInstance(this.createDto, dto);

    // 2) now `instance` is known to be an object, so `validate` will accept it
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      throw new BadRequestException(errors);
    }

    // 3) your existing hook
    const processed = (await this.beforeCreate(instance as any)) ?? instance;
    return this.service.create(processed as unknown as Create);
  }

  @Post(':id')
  update(@Param('id') id: Id, @Body() dto: Update) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: Id) {
    return this.service.remove(id);
  }

  protected beforeCreate(dto: Create): Promise<Create | void> | Create | void {}
}
