import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from 'src/workspace/workspace.entity';
import { Document } from './document.entity';
import { StorageCollectionSchema } from './storage.types';

@Entity('collections')
@Index('IDX_collections_workspace_id', ['workspaceId'])
@Index('IDX_collections_workspace_slug', ['workspaceId', 'slug'], { unique: true })
@Unique('UQ_collections_workspace_id_slug', ['workspaceId', 'slug'])
export class Collection {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({ name: 'slug', type: 'text' })
  slug: string;

  @Column({ name: 'schema_jsonb', type: 'jsonb', nullable: true })
  schemaJsonb?: StorageCollectionSchema | null;

  @OneToMany(() => Document, (document) => document.collection)
  documents: Document[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
