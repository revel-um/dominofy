import { Injectable } from '@nestjs/common';
import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { Observable } from 'rxjs';

@Injectable()
export class AppService {
  dominofyEvent(pipeline: PipelineStep[]) {
    return new Observable<PipelineStep>((observer) => {
      const interval = setInterval(() => {
        const step = pipeline.shift();
        if (!step) {
          clearInterval(interval);
          observer.complete();
          return;
        }
        observer.next(step);
      }, 1000); // Emit one step per second
  
      // Cleanup on unsubscribe
      return () => clearInterval(interval);
    });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }
}
