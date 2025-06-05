import { Body, Controller, Param, Post, Query, Req, Sse } from '@nestjs/common';
import { AppService } from './app.service';
import { PipelineStep } from '../../../shared/types/pipelineStepType';

@Controller('dominofy')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Sse('event/:id')
  dominofyEvent(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    return this.appService.dominofyEvent(id, userId);
  }

// @Sse('run/:workflowId')
// runWorkflow(@Param("workflowId") id: string) {
//   return new Observable<DominoResult>(subscriber => {
//     const runId = uuidv4();
//     const pipeline = this.workflowService.load(id);           // your JSON
//     const runner = new Runner(pipeline);

//     runner.on("done", res => subscriber.next(res));
//     runner.on("allDone", () => subscriber.complete());

//     runner.run(runId).catch(err => subscriber.error(err));
//     return () => runner.removeAllListeners();
//   });
// }


  @Post()
  dominofy(@Body() pipeline: PipelineStep[]) {
    return this.appService.dominofy(pipeline);
  }
}
