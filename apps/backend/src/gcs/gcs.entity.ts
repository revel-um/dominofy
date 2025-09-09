import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { Workflow } from 'src/workflow/workflow.entity';

@Entity('assets')
export class Asset extends BaseEntity {
  @Column()
  fileName: string;

  @Column()
  originalName: string;

  @Column()
  key: string; // GCS object key/path

  @Column()
  bucketName: string;

  @Column()
  contentType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ nullable: true })
  etag: string;

  @Column({ nullable: true })
  md5Hash: string;

  @Column()
  gcsUrl: string; // Full GCS URL for accessing the file

  @Column({ nullable: true })
  publicUrl: string; // Public URL if available

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  uploadedBy: User;

  @Column({ nullable: false })
  systemUpload: boolean;

  @ManyToOne(() => Workflow, { nullable: true, onDelete: 'SET NULL' })
  workflow: Workflow;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Additional metadata as JSON
}
