import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { WorkflowLogStatus, WorkflowLog } from './workflow-logger.entity';

/* ---------- DTO handed to the logger by the Runner ---------- */
export interface WorkflowLogDto {
  workflowId: string;                 // FK → Workflow.id
  runId: string;                      // one execution instance
  dominoId: string;                   // node that produced this log
  status: WorkflowLogStatus;          // 'success' | 'failure'
  output?: unknown;
  error?: { message: string; stack?: string };
  meta?: Record<string, any>;
  ts?: Date;                          // optional; filled in if absent
}

/* ============================================================ */
/*  WorkflowLoggerService                                       */
/* ============================================================ */
@Injectable()
export class WorkflowLoggerService
  extends BaseService<WorkflowLog>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(WorkflowLoggerService.name);

  /* ---------- tunables (env overrides) ---------- */
  private readonly flushMs = Number(process.env.LOGGER_FLUSH_MS ?? 5_000); // 5 s
  private readonly cap     = Number(process.env.LOGGER_BUFFER_CAP ?? 10_000);

  /* ---------- in-memory buffer ---------- */
  private readonly buffer: WorkflowLogDto[] = [];
  private timer!: NodeJS.Timeout;

  /* ---------- spill-to-disk for DB outages ---------- */
  private readonly stashDir =
    process.env.LOGGER_STASH_DIR ?? '/tmp/dominofy-stash';

  constructor(
    @InjectRepository(WorkflowLog)
    private readonly logsRepo: Repository<WorkflowLog>,
  ) {
    super(logsRepo);
  }

  /* ---------- lifecycle hooks ---------- */
  async onModuleInit() {
    await fs.mkdir(this.stashDir, { recursive: true });
    await this.replayStash();                                   // drain any older files
    this.timer = setInterval(
      () => this.flush().catch(this.log.error),
      this.flushMs,
    );
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.flush();                                         // final drain
  }

  /* ========================================================== */
  /*  Public API – called by the Runner                         */
  /* ========================================================== */
  async logLine(dto: WorkflowLogDto) {
    if (this.buffer.length >= this.cap) this.buffer.shift();    // drop oldest
    dto.ts = dto.ts ?? new Date();
    this.buffer.push(dto);
  }

  /* Convenience read – mirrors style of your ProjectsService */
  async findAll(
    workflowId: string,
    runId?: string,
    limit = 50,
    offset = 0,
    search?: string,
  ) {
    const where: any = { workflow: { id: workflowId } };
    if (runId) where.runId = runId;
    if (search) {
      // simple free-text grep inside the JSON 'output' column
      where.output = ILike(`%${search}%`);
    }

    return this.logsRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /* ========================================================== */
  /*  Internal helpers                                          */
  /* ========================================================== */
  private async flush() {
    if (this.buffer.length === 0) return;
    const slice = this.buffer.splice(0, this.buffer.length);

    try {
      await this.logsRepo
        .createQueryBuilder()
        .insert()
        .into(WorkflowLog)
        .values(
          slice.map((d) => ({
            workflow: { id: d.workflowId },
            runId: d.runId,
            dominoId: d.dominoId,
            status: d.status,
            output: d.output === undefined || typeof d.output === 'string'
              ? d.output
              : JSON.stringify(d.output),
            error: d.error,
            meta: d.meta,
            createdAt: d.ts,
            updatedAt: d.ts,
          })),
        )
        .orIgnore()                                             // dedup on retry
        .execute();

      this.log.debug(`Flushed ${slice.length} workflow logs`);
    } catch (err) {
      /* push back + spill to disk so nothing is lost */
      this.buffer.unshift(...slice);
      await this.spill(slice);
      this.log.error(
        `DB insert failed – buffer=${this.buffer.length}, spilled=${slice.length}`,
        err as any,
      );
    }
  }

  private async spill(batch: WorkflowLogDto[]) {
    const file = path.join(this.stashDir, `${Date.now()}.ndjson`);
    await fs.appendFile(
      file,
      batch.map((b) => JSON.stringify(b)).join('\n') + '\n',
    );
  }

  private async replayStash() {
    const files = await fs.readdir(this.stashDir).catch(() => []);
    for (const f of files) {
      const full = path.join(this.stashDir, f);
      try {
        const raw = await fs.readFile(full, 'utf8');
        const docs: WorkflowLogDto[] = raw
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l));

        await this.logsRepo
          .createQueryBuilder()
          .insert()
          .into(WorkflowLog)
          .values(
            docs.map((d) => ({
              workflow: { id: d.workflowId },
              runId: d.runId,
              dominoId: d.dominoId,
              status: d.status,
              output:
                d.output === undefined || typeof d.output === 'string'
                  ? d.output
                  : JSON.stringify(d.output),
              error: d.error,
              meta: d.meta,
              createdAt: d.ts ?? new Date(),
              updatedAt: d.ts ?? new Date(),
            })),
          )
          .orIgnore()
          .execute();

        await fs.unlink(full);                                  // delete only on success
        this.log.log(`Replayed stash file ${f} (${docs.length} docs)`);
      } catch (e) {
        this.log.warn(`Failed to replay stash file ${f}: ${e}`);
      }
    }
  }
}
