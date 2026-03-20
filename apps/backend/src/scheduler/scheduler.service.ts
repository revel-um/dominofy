import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, Worker, Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Schedule } from './scheduler.entity';
import { Workflow } from 'src/workflow/workflow.entity';
import { RunnerLauncherService } from 'src/runner-launcher/runner-launcher.service';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';
import { v4 as uuidv4 } from 'uuid';

interface SchedulerNodeConfig {
  nodeId: string;
  cronExpression: string | null;
  timezone: string;
  enabled: boolean;
  rawConfig: Record<string, any>;
}

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private readonly queueName = 'workflow-scheduler';
  private readonly jobName = 'run-workflow';
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly config: ConfigService,
    private readonly runnerLauncher: RunnerLauncherService,
    private readonly workflowLogger: WorkflowLoggerService,
  ) {}

  /* ───────────────────────── lifecycle ───────────────────────── */

  async onModuleInit() {
    const connection = this.getRedisConnection();
    this.queue = new Queue(this.queueName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    });

    this.worker = new Worker(
      this.queueName,
      async (job) => this.handleJob(job),
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed for schedule ${job?.data?.scheduleId}: ${err?.message}`);
    });

    await this.syncAllWorkflowsToSchedules();
    await this.restoreSchedulesFromDatabase();
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }

  /* ───────────────────────── public API ───────────────────────── */

  async syncWorkflowSchedules(workflow: Workflow) {
    const definitions = this.extractSchedulesFromWorkflow(workflow);
    const existing = await this.scheduleRepository.find({
      where: { workflowId: workflow.id },
    });

    const seenNodeIds = new Set<string>();

    for (const def of definitions) {
      if (!def.cronExpression) {
        this.logger.warn(`Skipping scheduler node ${def.nodeId} on workflow ${workflow.id} due to missing cron`);
        continue;
      }

      seenNodeIds.add(def.nodeId);
      const matching = existing.find((s) => s.nodeId === def.nodeId);

      if (matching) {
        matching.cronExpression = def.cronExpression;
        matching.timezone = def.timezone;
        matching.enabled = def.enabled;
        matching.rawConfig = def.rawConfig;
        matching.workflowId = workflow.id;
        matching.workflow = workflow;
        await this.scheduleRepository.save(matching);
        await this.registerRepeatable(matching);
      } else {
        const created = this.scheduleRepository.create({
          workflowId: workflow.id,
          workflow,
          nodeId: def.nodeId,
          cronExpression: def.cronExpression,
          timezone: def.timezone,
          enabled: def.enabled,
          rawConfig: def.rawConfig,
        });
        const saved = await this.scheduleRepository.save(created);
        await this.registerRepeatable(saved);
      }
    }

    // Disable schedules whose nodes were removed
    const toDisable = existing.filter((s) => !seenNodeIds.has(s.nodeId));
    for (const schedule of toDisable) {
      if (schedule.enabled) {
        schedule.enabled = false;
        await this.scheduleRepository.save(schedule);
      }
      await this.removeRepeatable(schedule);
    }
  }

  /* ───────────────────────── workers ───────────────────────── */

  private async handleJob(job: Job<{ scheduleId: string; workflowId: string }>) {
    const { scheduleId, workflowId } = job.data;
    const schedule = await this.scheduleRepository.findOne({ where: { id: scheduleId } });
    if (!schedule) {
      await this.removeMissingScheduleJob(job, scheduleId);
      return;
    }

    if (!schedule.enabled || !schedule.isActive) {
      this.logger.warn(`Skipping run for disabled schedule ${scheduleId}`);
      return;
    }

    const workflow = await this.workflowRepository.findOne({ where: { id: workflowId } });
    if (!workflow) {
      this.logger.warn(`Workflow ${workflowId} missing for schedule ${scheduleId}`);
      return;
    }

    schedule.lastRunAt = new Date();
    await this.scheduleRepository.save(schedule);

    const { nodes = [], edges = [] } = (workflow.visualJson as any) ?? {};
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

    const runId = uuidv4();
    const runner = this.runnerLauncher.createRunner(
      workflow.id,
      runId,
      pipeline,
      20,
      workflow.visualJson
    );

    await runner.run(runId, {});
    await this.workflowLogger.flushNow();
  }

  /* ───────────────────────── helpers ───────────────────────── */

  private getRedisConnection() {
    return {
      host: this.config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: Number(this.config.get('REDIS_PORT') ?? 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      db: Number(this.config.get('REDIS_DB') ?? 0),
    };
  }

  private buildJobId(schedule: Schedule) {
    return `schedule:${schedule.id}`;
  }

  private async restoreSchedulesFromDatabase() {
    const activeSchedules = await this.scheduleRepository.find({
      where: { enabled: true, isActive: true },
    });
    await Promise.all(activeSchedules.map((s) => this.registerRepeatable(s)));
    this.logger.log(`Scheduler restored ${activeSchedules.length} repeatable jobs from DB`);
  }

  /**
   * On boot, re-sync every workflow's scheduler nodes into the schedules table,
   * so cold starts repopulate repeatables even if the table was empty.
   */
  private async syncAllWorkflowsToSchedules() {
    try {
      const workflows = await this.workflowRepository.find();
      for (const wf of workflows) {
        await this.syncWorkflowSchedules(wf);
      }
      this.logger.log(`Scheduler synced schedules for ${workflows.length} workflows`);
    } catch (err) {
      this.logger.error(`Failed to sync workflows to schedules on startup: ${err?.message}`);
    }
  }

  private async registerRepeatable(schedule: Schedule) {
    if (!this.queue) return;
    if (!schedule.enabled || !schedule.isActive) {
      await this.removeRepeatable(schedule);
      return;
    }

    try {
      await this.queue.removeRepeatable(this.jobName, {
        pattern: schedule.cronExpression,
        tz: schedule.timezone,
        jobId: this.buildJobId(schedule),
      });
    } catch (err) {
      // ignore removal errors (likely not present)
    }

    await this.queue.add(
      this.jobName,
      { scheduleId: schedule.id, workflowId: schedule.workflowId },
      {
        jobId: this.buildJobId(schedule),
        repeat: { pattern: schedule.cronExpression, tz: schedule.timezone },
        removeOnComplete: 500,
        removeOnFail: 500,
      }
    );
  }

  private async removeRepeatable(schedule: Schedule) {
    if (!this.queue) return;
    try {
      await this.queue.removeRepeatable(this.jobName, {
        pattern: schedule.cronExpression,
        tz: schedule.timezone,
        jobId: this.buildJobId(schedule),
      });
    } catch (err) {
      // swallow - job may not exist yet
    }
  }

  private async removeMissingScheduleJob(
    job: Job<{ scheduleId: string; workflowId: string }>,
    scheduleId: string,
  ) {
    try {
      if (this.queue && job.repeatJobKey) {
        await this.queue.removeRepeatableByKey(job.repeatJobKey);
      }
    } catch (err) {
      this.logger.error(
        `Failed to remove orphaned repeatable job for missing schedule ${scheduleId}: ${err?.message}`,
      );
    }

    try {
      await job.remove();
    } catch (err) {
      // swallow - completed repeat jobs may already be gone
    }

    this.logger.log(`Removed orphaned scheduler job for missing schedule ${scheduleId}`);
  }

  private extractSchedulesFromWorkflow(workflow: Workflow): SchedulerNodeConfig[] {
    const nodes: any[] = (workflow.visualJson as any)?.nodes ?? [];
    return nodes
      .filter((n) => n?.type === 'SchedulerDomino')
      .map((node) => this.buildScheduleConfigFromNode(node))
      .filter((cfg): cfg is SchedulerNodeConfig => Boolean(cfg));
  }

  private buildScheduleConfigFromNode(node: any): SchedulerNodeConfig | null {
    const fields = node?.data?.details?.fields ?? [];
    const findField = (heading: string) => fields.find((f: any) => f.heading === heading)?.value ?? node?.data?.details?.[heading];

    const frequency = (findField('Frequency') || 'day').toString().toLowerCase();
    const interval = Number(findField('Interval') ?? 1) || 1;
    const time = (findField('Time') || '09:00').toString();
    const tzRaw = findField('Time Zone') || 'UTC';
    const daysRaw = findField('Days of Week') ?? findField('DaysOfWeek') ?? '';
    const enabledRaw = findField('Active');

    const timezone = (tzRaw === 'local' ? 'UTC' : tzRaw.toString()).replace(/\s+/g, '_');
    const enabled = enabledRaw === undefined ? true : enabledRaw === true || enabledRaw === 'true' || enabledRaw === '1';

    const daysOfWeek = Array.isArray(daysRaw)
      ? daysRaw
      : daysRaw
          .toString()
          .split(',')
          .map((d: string) => parseInt(d, 10))
          .filter((d: number) => !isNaN(d));

    const cronExpression = this.toCronExpression(frequency, interval, time, daysOfWeek);

    return {
      nodeId: node.id,
      cronExpression,
      timezone,
      enabled,
      rawConfig: {
        frequency,
        interval,
        time,
        daysOfWeek,
        timezone,
        enabled,
      },
    };
  }

  private toCronExpression(
    frequency: string,
    interval: number,
    time: string,
    daysOfWeek: number[],
  ): string | null {
    const safeInterval = Math.max(1, Number.isFinite(interval) ? interval : 1);
    const [hourStr, minuteStr] = time.split(':');
    const hour = Math.min(23, Math.max(0, parseInt(hourStr ?? '0', 10) || 0));
    const minute = Math.min(59, Math.max(0, parseInt(minuteStr ?? '0', 10) || 0));

    switch (frequency) {
      case 'minute':
        return `*/${safeInterval} * * * *`;
      case 'hour':
        return `${minute} */${safeInterval} * * *`;
      case 'day':
        return `${minute} ${hour} */${safeInterval} * *`;
      case 'week': {
        const days =
          daysOfWeek && daysOfWeek.length
            ? daysOfWeek.join(',')
            : '*';
        return `${minute} ${hour} * * ${days}`;
      }
      case 'month':
        return `${minute} ${hour} 1 */${safeInterval} *`;
      case 'once':
        // Fallback: run at the chosen time once per day (closest to "once" without date input)
        return `${minute} ${hour} * * *`;
      default:
        return null;
    }
  }
}
