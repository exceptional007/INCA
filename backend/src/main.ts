const rootCanvas = require(require('path').join(process.cwd(), 'node_modules/pdf-to-png-converter/node_modules/@napi-rs/canvas'));
for (const className of ['Path2D', 'DOMMatrix', 'ImageData']) {
  Object.defineProperty(globalThis, className, {
    get() {
      return rootCanvas[className];
    },
    set(val) {
      // Ignore setting to prevent older module versions from overwriting
    },
    configurable: false,
  });
}
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('INCA API')
    .setDescription('Intelligent Campus Assistant')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT Token',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT || 3000);

  console.log(`🚀 Server running at http://localhost:${process.env.PORT || 3000}`);
}
bootstrap();
