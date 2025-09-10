import { Repository, DeepPartial, FindOptionsWhere } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { IBaseEntity } from './base.interfaces';

@Injectable()
export class BaseService<T extends IBaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}
  async findOne(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  async create(data: DeepPartial<T>): Promise<T> {
    console.log('Creating entity with data:', data);
    const entity = this.repository.create(data);
    console.log('Created entity:', entity);
    return this.repository.save(entity);
  }

  async update(id: string, data): Promise<T> {
    await this.repository.update(id, data);
    const updated = await this.findOne(id);
    if (!updated) throw new Error(`Entity with id ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
