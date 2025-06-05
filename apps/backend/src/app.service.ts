import { Injectable } from '@nestjs/common';
import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { buildPipeline, buildLevelBuckets } from '../../../shared/helpers/buildPipeline';
import { Observable } from 'rxjs';
import { WorkflowService } from './workflow/workflow.service';
import { DominoResult } from './domino-engine/domino-engine.type';
import { Runner } from './domino-engine/runner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AppService {
  constructor(private readonly workflowService: WorkflowService) { }

  async dominofyEvent(workflowId: string, userId: string) {
    const workflow = await this.workflowService.findOneAndVerify(workflowId, userId);
    if (!workflow?.visualJson?.edges?.length) return;

    const { nodes, edges } = workflow.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

    return new Observable<DominoResult>(subscriber => {
    const runId = uuidv4();
    const runner = new Runner(pipeline);

    runner.on("done", res => subscriber.next(res));
    runner.on("allDone", () => subscriber.complete());

    runner.run(runId).catch(err => subscriber.error(err));
    return () => runner.removeAllListeners();
  });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }
}
