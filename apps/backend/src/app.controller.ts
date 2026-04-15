import { Body, Controller, Param, Post, Query, Req, Sse } from '@nestjs/common';
import { AppService } from './app.service';
import { PipelineStep } from '../../../shared/types/pipelineStepType';

@Controller('dominofy')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Sse('event/:id')
  dominofyEvent(@Param('id') id: string, @Req() req: Request, @Query('runToken') runToken?: string) {
    const userId = (req as any).user.id;
    return this.appService.dominofyEvent(id, userId, runToken);
  }

  @Post('run/:id')
  createRunSession(
    @Param('id') id: string,
    @Req() req: Request,
    @Body('mockInput') mockInput?: Record<string, any>,
  ) {
    const userId = (req as any).user.id;
    return this.appService.createRunSession(id, userId, mockInput ?? {});
  }

  @Post()
  dominofy(@Body() pipeline: PipelineStep[]) {
    return this.appService.dominofy(pipeline);
  }
}
