// src/workflow-logger/workflow-logger.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';

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
  output?: any;
  error?: { message: string; stack?: string };
  ts?: Date;                          // defaulted by logLine()
  seq?: number;                       // convenience for non‑print logs
}

/* -------------------------------------------------------------------------- */
/*                               Logger service                               */
/* -------------------------------------------------------------------------- */

@Injectable()
export class WorkflowLoggerService extends BaseService<WorkflowLog> implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WorkflowLoggerService.name);

  private readonly streamEmitter = new EventEmitter();
  private readonly streamEvent = 'workflow_log';
  
  private readonly flushMs = Number(process.env.LOGGER_FLUSH_MS ?? 5_000);
  private readonly cap = Number(process.env.LOGGER_BUFFER_CAP ?? 10_000);

  private readonly buffer: WorkflowLogDto[] = [];
  private timer!: NodeJS.Timeout;

  constructor(
    @InjectRepository(WorkflowLog)
    private readonly logsRepo: Repository<WorkflowLog>,
  ) {
    super(logsRepo);
    this.streamEmitter.setMaxListeners(0);
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
    const shouldPersist =
      dto.status === WorkflowLogStatus.FAILURE ||
      dto.type === 'print' ||
      dto.type === 'response' ||
      dto.dominoId === '__workflow__';

    if (!shouldPersist) {
      return;
    }

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

  /** Live stream for newly persisted log rows. */
  streamLogs(workflowId: string, runId?: string) {
    return new Observable<string>((subscriber) => {
      const handler = (payload: {
        workflowId: string;
        runId: string;
        log: Record<string, unknown>;
      }) => {
        if (payload.workflowId !== workflowId) return;
        if (runId && payload.runId !== runId) return;
        subscriber.next(JSON.stringify(payload));
      };

      this.streamEmitter.on(this.streamEvent, handler);
      return () => this.streamEmitter.off(this.streamEvent, handler);
    });
  }

  /** Force-persist any buffered logs immediately. */
  async flushNow() {
    await this.flush();
  }

  /* ------------------------------ Query helper ----------------------------- */

  async findAll(
    workflowId: string,
    runId?: string,
    limit = 50,
    offset = 0,
    search?: string,
    minutes = 0,
  ): Promise<[WorkflowLog[], number]> {
    const where: any = { workflow: { id: workflowId } };

    if (runId) {
      where.runId = runId;
    }
    if (search) {
      where.output = ILike(`%${search}%`);
    }
    if (minutes > 0) {
      const since = new Date(Date.now() - minutes * 60 * 1000);
      where.createdAt = MoreThanOrEqual(since);
    }

    return this.logsRepo.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Fetch logs between an explicit date range [startDate, endDate].
   */
  async findAllByDateRange(
    workflowId: string,
    runId: string | undefined,
    limit = 50,
    offset = 0,
    search: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<[WorkflowLog[], number]> {
    const where: any = { workflow: { id: workflowId } };

    if (runId) {
      where.runId = runId;
    }
    if (search) {
      where.output = ILike(`%${search}%`);
    }

    // Filter logs whose createdAt is between startDate and endDate (inclusive)
    where.createdAt = Between(startDate, endDate);

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

      /** Runner V1  → dto.seq + dto.output
       *  Runner V2  → dto.output = { seq, output } or [{ seq, output }]
       *  Normalize all successful domino outputs into sequenced entries.
       */
      const normalizedOutputs = (() => {
        if (d.type !== 'print' && d.type !== 'response') {
          return [];
        }

        if (Array.isArray(d.output)) {
          return d.output
            .filter((entry: any) => typeof entry?.seq === 'number')
            .map((entry: any) => ({ seq: entry.seq, output: entry.output }));
        }

        if (d.output && typeof d.output === 'object' && typeof (d.output as any).seq === 'number') {
          return [{ seq: (d.output as any).seq, output: (d.output as any).output }];
        }

        if (typeof d.seq === 'number') {
          return [{ seq: d.seq, output: d.output }];
        }

        return [];
      })();

      for (const entry of normalizedOutputs) {
        if (!g.outputs.some((o) => o.seq === entry.seq)) {
          g.outputs.push(entry);
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
      const savedLogs = await this.logsRepo.save(toSave, { chunk: 100 });
      for (const log of savedLogs) {
        const workflowId =
          (log.workflow as any)?.id ?? (log as any).workflowId;
        if (!workflowId) continue;
        this.streamEmitter.emit(this.streamEvent, {
          workflowId,
          runId: log.runId,
          log: {
            id: log.id,
            runId: log.runId,
            dominoId: log.dominoId,
            status: log.status,
            output: log.output,
            error: log.error,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
          },
        });
      }
      this.log.debug(`Flushed ${toSave.length} workflow logs`);
    } catch (err) {
      // Re‑queue so nothing is lost (no FS spill anymore)
      this.buffer.unshift(...slice);
      this.log.error(`DB save failed – buffer=${this.buffer.length}`, err as any);
    }
  }
}
