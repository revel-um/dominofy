// src/workflow/entities/workflow-log.entity.ts
import {
    Entity,
    Column,
    ManyToOne,
    Index,
    JoinColumn,
} from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Workflow } from 'src/workflow/workflow.entity';

/** Allowed execution outcomes for a single domino. */
export enum WorkflowLogStatus {
    SUCCESS = 'success',
    FAILURE = 'failure',
}

@Entity('workflow_logs')
/**
 * A UNIQUE key that lets you retry / replay the same log batch safely:
 * one dominoId can appear only once per runId.
 */
@Index('idx_workflowlog_run_domino_unique', ['runId', 'dominoId'], {
    unique: true,
})
export class WorkflowLog extends BaseEntity {
    /* ─────────── Relations ─────────── */

    @ManyToOne(() => Workflow, (workflow) => workflow.logs, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    workflow: Workflow;

    /* ─────────── Routing keys ───────── */

    /** A single *run* (execution instance) of the workflow, e.g. uuid-v4. */
    @Column()
    runId: string;

    /** The domino node that produced this log line. */
    @Column()
    dominoId: string;

    /* ─────────── Status & data ─────── */

    @Column({
        type: 'enum',
        enum: WorkflowLogStatus,
    })
    status: WorkflowLogStatus;

    /** Returned value from the domino (JSON-serialisable). */
    @Column({ type: 'jsonb', nullable: true })
    output?: any;

    /** Error info if status === FAILURE. */
    @Column({ type: 'jsonb', nullable: true })
    error?: { message: string; stack?: string };
}