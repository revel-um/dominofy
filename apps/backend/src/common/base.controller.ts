import {
  Body,
  Post,
  Delete,
  Get,
  Param,
  BadRequestException,
  Req,
  Request,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IBaseService } from './base.interfaces';

export abstract class BaseController<
  Entity,
  Create extends object,
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
  ) { }

  @Get(':id')
  findOne(@Param('id') id: Id) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: Create, @Req() req: Request) {
    const instance = plainToInstance(this.createDto, dto);

    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      throw new BadRequestException(errors);
    }

    // now pass req to beforeCreate
    const processed = (await this.beforeCreate(instance as any, req)) ?? instance;
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

  protected beforeCreate(dto: Create, req: Request): Promise<Create | void> | Create | void {
  }
}
