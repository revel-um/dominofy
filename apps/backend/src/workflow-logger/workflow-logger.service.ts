// src/workflow-logger/workflow-logger.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';

import { BaseService } from 'src/common/base.service';
import { WorkflowLog, WorkflowLogStatus } from './workflow-logger.entity';

/* -------------------------------------------------------------------------- */
/*                               Public DTO type                              */
/* -------------------------------------------------------------------------- */

export interface WorkflowLogDto {
  workflowId: string;                 // FK → Workflow.id
  type: string;                       // e.g. 'print', 'email', …
  runId: string;                      // execution instance
  dominoId: string;                   // node that produced this log (NOT NULL!)
  status: WorkflowLogStatus;          // 'success' | 'failure'
  output?: { seq: number; output?: any }; // only for print logs
  error?: { message: string; stack?: string };
  ts?: Date;                          // defaulted by logLine()
  seq?: number;                       // convenience for non‑print logs
}

/* -------------------------------------------------------------------------- */
/*                               Logger service                               */
/* -------------------------------------------------------------------------- */

@Injectable()
export class WorkflowLoggerService
  extends BaseService<WorkflowLog>
  implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WorkflowLoggerService.name);

  private readonly flushMs = Number(process.env.LOGGER_FLUSH_MS ?? 5_000);
  private readonly cap = Number(process.env.LOGGER_BUFFER_CAP ?? 10_000);

  private readonly buffer: WorkflowLogDto[] = [];
  private timer!: NodeJS.Timeout;

  constructor(
    @InjectRepository(WorkflowLog)
    private readonly logsRepo: Repository<WorkflowLog>,
  ) {
    super(logsRepo);
  }

  /* ------------------------------------------------------------------------ */
  /*                                Lifecycle                                 */
  /* ------------------------------------------------------------------------ */

  async onModuleInit() {
    // kick off periodic flush task
    this.timer = setInterval(
      () => this.flush().catch((e) => this.log.error(e)),
      this.flushMs,
    );
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.flush();
  }

  /* ------------------------------------------------------------------------ */
  /*                               Public  API                                */
  /* ------------------------------------------------------------------------ */

  /** Push a single log DTO into the in‑memory buffer. */
  async logLine(dto: WorkflowLogDto) {
    // Safety guard: do not queue logs missing the NOT‑NULL column.
    if (!dto.dominoId) {
      this.log.warn(
        `Dropped log without dominoId (workflow=${dto.workflowId}, run=${dto.runId})`,
      );
      return;
    }

    // simple ring‑buffer back‑pressure
    if (this.buffer.length >= this.cap) this.buffer.shift();

    dto.ts = dto.ts ?? new Date();
    this.buffer.push(dto);
  }

  /* ------------------------------ Query helper ----------------------------- */

  async findAll(
    workflowId: string,
    runId?: string,
    limit = 50,
    offset = 0,
    search?: string,
  ) {
    const where: any = { workflow: { id: workflowId } };
    if (runId) where.runId = runId;
    if (search) where.output = ILike(`%${search}%`);

    return this.logsRepo.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                                Flushing                                  */
  /* ------------------------------------------------------------------------ */

  /**
   * Flushes the in‑memory buffer to Postgres, grouping by
   * `(workflowId, runId, dominoId)` and *upserting* rows.
   */
  private async flush() {
    if (this.buffer.length === 0) return;

    // Drain buffer quickly to shorten critical section.
    const slice = this.buffer.splice(0, this.buffer.length);

    /* --------------------------- Group by composite key -------------------------- */

    interface Group {
      workflowId: string;
      runId: string;
      dominoId: string;
      status: WorkflowLogStatus;
      outputs: { seq: number; output?: any }[];
      error?: { message: string; stack?: string };
      ts: Date;
    }

    const groups = new Map<string, Group>();

    for (const d of slice) {
      const key = `${d.workflowId}::${d.runId}::${d.dominoId}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          workflowId: d.workflowId,
          runId: d.runId,
          dominoId: d.dominoId,
          status: d.status,
          outputs: [],
          ts: d.ts!,
        };
        groups.set(key, g);
      }

      // merge status and error (last one wins)
      g.status = d.status;
      if (d.error) g.error = d.error;
      g.ts = d.ts ?? g.ts;

      if (d.type === 'print') {
        /** Runner V1  →  dto.seq + dto.output
         *  Runner V2  →  dto.output = { seq, output }
         *  Handle either form safely.
         */
        const seq =
          (d.output as any)?.seq ??                 // new format
          (typeof d.seq === 'number' ? d.seq : undefined); // old format

        const value =
          (d.output as any)?.output ??              // new format
          (seq !== undefined ? (d as any).output : undefined); // old format

        if (seq !== undefined && !g.outputs.some((o) => o.seq === seq)) {
          g.outputs.push({ seq, output: value });
        }
      }
    }

    /* ---------------------------- Fetch existing rows --------------------------- */

    const compositeKeys = Array.from(groups.values()).map((g) => ({
      runId: g.runId,
      dominoId: g.dominoId,
    }));

    const existingLogs = await this.logsRepo.find({
      where: compositeKeys.map((k) => ({ runId: k.runId, dominoId: k.dominoId })),
      relations: ['workflow'],
    });

    const existingMap = new Map<string, WorkflowLog>();
    for (const log of existingLogs) {
      existingMap.set(`${log.workflow.id}::${log.runId}::${log.dominoId}`, log);
    }

    /* ------------------------------ Build entities ----------------------------- */

    const toSave: WorkflowLog[] = [];

    for (const g of groups.values()) {
      console.log(g)
      const key = `${g.workflowId}::${g.runId}::${g.dominoId}`;
      const existing = existingMap.get(key);

      const mergedOutputs = (() => {
        const set = new Map<number, any>();
        if (existing?.output?.length)
          for (const o of existing.output)
            if (typeof o.seq === 'number') set.set(o.seq, o.output);
        for (const o of g.outputs) set.set(o.seq, o.output);
        return [...set.entries()]
          .sort(([a], [b]) => a - b)
          .map(([seq, output]) => ({ seq, output }));
      })();

      toSave.push(
        this.logsRepo.create({
          id: existing?.id,
          workflow: { id: g.workflowId },
          runId: g.runId,
          dominoId: g.dominoId,
          status: g.status,
          output: mergedOutputs.length ? mergedOutputs : undefined,
          error: g.error,
          createdAt: existing?.createdAt ?? g.ts,
          updatedAt: g.ts,
        }),
      );
    }

    /* ----------------------------- Persist (upsert) ----------------------------- */

    try {
      await this.logsRepo.save(toSave, { chunk: 100 });
      this.log.debug(`Flushed ${toSave.length} workflow logs`);
    } catch (err) {
      // Re‑queue so nothing is lost (no FS spill anymore)
      this.buffer.unshift(...slice);
      this.log.error(`DB save failed – buffer=${this.buffer.length}`, err as any);
    }
  }
}
