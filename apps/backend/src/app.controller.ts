import { Body, Controller, Post, Sse } from '@nestjs/common';
import { AppService } from './app.service';
import { PipelineStep } from '../../../shared/types/pipelineStepType';

@Controller('dominofy')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Sse('event')
  dominofyEvent(@Body() pipeline: PipelineStep[]) {
    return this.appService.dominofyEvent(pipeline);
  }

  @Post()
  dominofy(@Body() pipeline: PipelineStep[]) {
    return this.appService.dominofy(pipeline);
  }
}
