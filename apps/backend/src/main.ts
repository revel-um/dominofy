import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, Global, ValidationPipe, VersioningType } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/exception.handler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // turn on validation for every incoming request
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // strip properties that don't have decorators
    forbidNonWhitelisted: true, // throw an error if non-decorated props are present
    transform: true,            // auto-transform payloads to your DTO classes
    validationError: { target: false },
    exceptionFactory: (errors) => {
      console.error(errors);
      throw new BadRequestException(errors);
    },
  }));

  app.enableVersioning({
    type: VersioningType.URI, // Use URI versioning: /v1/...
    defaultVersion: '1',
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: 'http://localhost:3000',        // your front-end origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,                      // if you need cookies/auth
  });

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
