import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Global, VersioningType } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/exception.handler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({
    type: VersioningType.URI, // Use URI versioning: /v1/...
    defaultVersion: '1',
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors();
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
