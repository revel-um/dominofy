export interface IBaseService<
  Entity,
  Create = unknown,
  Update = Partial<Create>,
  Id = string,
> {
  /** allow null when nothing is found */
  findOne(id: Id): Promise<Entity | null>;
  create(dto: Create): Promise<Entity>;
  update(id: Id, dto: Update): Promise<Entity>;
  remove(id: Id): Promise<void>;
}

export interface IBaseEntity {
  id: string;
}