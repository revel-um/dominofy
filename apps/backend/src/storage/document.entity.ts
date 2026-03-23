import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from 'src/workspace/workspace.entity';
import { Collection } from './collection.entity';
import { User } from 'src/user/user.entity';

@Entity('documents')
@Index('IDX_documents_workspace_id', ['workspaceId'])
@Index('IDX_documents_workspace_collection_id', ['workspaceId', 'collectionId'])
@Index('IDX_documents_workspace_created_at', ['workspaceId', 'createdAt'])
@Unique('UQ_documents_workspace_collection_document_key', [
  'workspaceId',
  'collectionId',
  'documentKey',
])
export class Document {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId: string;

  @ManyToOne(() => Collection, (collection) => collection.documents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'collection_id' })
  collection: Collection;

  @Column({ name: 'document_key', type: 'text', nullable: true })
  documentKey?: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  status?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: User | null;

  @Column({ name: 'data_jsonb', type: 'jsonb' })
  dataJsonb: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
