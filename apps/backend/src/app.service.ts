import { Injectable } from '@nestjs/common';
import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { buildPipeline } from '../../../shared/helpers/buildPipeline';
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

    return new Observable(subscriber => {
      const runId = uuidv4();
      const runner = new Runner(pipeline, 5); // or any concurrency you want

      // Subscribe to per-node “done” events:
      runner.on("done", (res: DominoResult) => {
        console.log('res:', res);
        subscriber.next(JSON.stringify(res))
      });
      runner.on("error", (errContext) => {
        // you can choose to propagate errors or just log them
        console.error("[Runner] Node error:", errContext);
      });
      runner.on("terminate", (finalResults) => {
        subscriber.next('terminate');
        subscriber.complete();
      });

      runner.run(runId).catch((err) => {
        // If something catastrophic happens (e.g., graph cycle detection),
        // surface it here and complete the SSE stream with an error.
        subscriber.error(err);
      });

      // When the client unsubscribes, clean up listeners:
      return () => runner.removeAllListeners();
    });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }
}