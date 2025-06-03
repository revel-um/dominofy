import { Injectable } from '@nestjs/common';
import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { Observable } from 'rxjs';

@Injectable()
export class AppService {
  dominofyEvent(): Observable<string> {
    return new Observable<string>((observer) => {
      let count = 0;

      const interval = setInterval(() => {
        if (count >= 5) {
          clearInterval(interval);
          observer.next('done');
          observer.complete();
          return;
        }

        observer.next('hello');
        count++;
      }, 1000); // Emit "hello" every 1 second, 5 times

      // Cleanup on unsubscribe
      return () => clearInterval(interval);
    });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }
}
