import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { json } from 'body-parser'; // ← import the body-parser hook
import { GlobalExceptionFilter } from './common/exception.handler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1) Capture the raw body buffer on _all_ JSON requests
  app.use(
    json({
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf.toString();   // stash the exact text for signature checking
      },
    }),
  );

  // 2) Your existing global pipes / filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false },
      exceptionFactory: (errors) => {
        console.error(errors);
        throw new BadRequestException(errors);
      },
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
