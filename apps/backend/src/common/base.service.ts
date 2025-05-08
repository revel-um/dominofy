import { Repository, DeepPartial, FindOptionsWhere } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';


export interface IBaseEntity {
  id: string;
}

@Injectable()
export class BaseService<T extends IBaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async findOne(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: QueryDeepPartialEntity<T>): Promise<T> {
    await this.repository.update(id, data);
    const updated = await this.findOne(id);
    if (!updated) throw new Error(`Entity with id ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
