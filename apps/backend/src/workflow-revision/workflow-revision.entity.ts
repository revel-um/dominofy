import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Workflow } from '../workflow/workflow.entity';
import { User } from 'src/user/user.entity';

/* ───────────────────────────────────────────────────────────── */
/*  Keep an index on (workflow_id, created_at DESC) for fast    */
/*  "last-N revisions" queries.                                 */
/* ───────────────────────────────────────────────────────────── */
@Index('idx_wf_revision_lookup', ['workflow', 'created_at'])
@Entity('workflow_revisions')
export class WorkflowRevision {
  @PrimaryGeneratedColumn('increment')
  rev_id: number;

  /* Parent workflow (CASCADE delete when workflow is deleted) */
  @ManyToOne(() => Workflow, (wf) => wf.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  workflow: Workflow;

  /* Author of the change (optional; keep for audit) */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  user: User;

  /** JSON Patch|diff or full snapshot of the change */
  @Column({ type: 'jsonb' })
  diff_json: unknown;

  /** Raw prompt the user sent to the AI */
  @Column({ type: 'text' })
  ai_prompt: string;

  /** Explanation returned by the AI for this revision */
  @Column({ type: 'text' })
  ai_explanation: string;

  @CreateDateColumn()
  created_at: Date;
} 