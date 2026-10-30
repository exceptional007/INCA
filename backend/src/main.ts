import dns from 'node:dns';
import { performance } from 'node:perf_hooks';

// High-resolution entry point timer
const processEntryTime = performance.now();
const nodeUptimeAtEntryMs = Math.round(process.uptime() * 1000);

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const bootstrapLogger = new Logger('BootstrapDiagnostics');

  // Phase 1: NestFactory.create (Module resolution, DI graph construction, provider onModuleInit hooks)
  const tCreateStart = performance.now();
  const app = await NestFactory.create(AppModule);
  const tCreateDuration = performance.now() - tCreateStart;

  // Enable graceful shutdown hooks so Prisma.$disconnect and cleanup hooks run on SIGINT/SIGTERM
  app.enableShutdownHooks();

  // Phase 2: Configuration & Global Middleware
  const tConfigStart = performance.now();
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/(.*)'],
  });

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
  const tConfigDuration = performance.now() - tConfigStart;

  // Phase 3: Swagger documentation setup (lazy factory generation)
  const tSwaggerStart = performance.now();
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
      'JWT-auth',
    )
    .build();

  // Lazy document factory: document is generated on-demand only when /docs is requested
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
  const tSwaggerDuration = performance.now() - tSwaggerStart;

  // Phase 4: HTTP server startup
  const tListenStart = performance.now();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  const tListenDuration = performance.now() - tListenStart;

  const totalProcessBootstrapMs = performance.now() - processEntryTime;

  bootstrapLogger.log(
    `Backend Startup Diagnostics Breakdown:\n` +
      `  ├─ Node.js Process & Engine Init   : ${nodeUptimeAtEntryMs}ms\n` +
      `  ├─ NestFactory.create(AppModule)  : ${tCreateDuration.toFixed(2)}ms\n` +
      `  ├─ App Configuration & Pipes      : ${tConfigDuration.toFixed(2)}ms\n` +
      `  ├─ Swagger Setup (Lazy Factory)   : ${tSwaggerDuration.toFixed(2)}ms\n` +
      `  ├─ HTTP Server Listen (Port ${port}) : ${tListenDuration.toFixed(2)}ms\n` +
      `  └─ Total Process Startup Time     : ${totalProcessBootstrapMs.toFixed(2)}ms\n` +
      `  [Note: Process startup measures internal execution from Node.js process entry to listen. Host/container provisioning, network routing, and platform cold-starts occur outside and prior to process entry.]`,
  );

  console.log(`🚀 Server running at http://localhost:${port}`);
}

bootstrap().catch((err: any) => {
  const logger = new Logger('Bootstrap');
  const errorCode = err?.errorCode || err?.code || err?.name || 'UNKNOWN';
  const errorMessage =
    err?.message?.split('\n')[0] || err?.message || String(err);

  const isDbError =
    String(errorCode).startsWith('P1') ||
    errorCode === 'PrismaClientInitializationError' ||
    errorMessage.toLowerCase().includes('database') ||
    errorMessage.toLowerCase().includes("can't reach");

  if (isDbError) {
    logger.error(
      `❌ Fatal startup failure: Database unreachable at startup [${errorCode}]: ${errorMessage}. ` +
        `Please check your DATABASE_URL, network connectivity, and Neon database status.`,
    );
  } else {
    logger.error(
      `❌ Fatal startup failure [${errorCode}]: ${errorMessage}.`,
      err instanceof Error ? err.stack : undefined,
    );
  }
  process.exit(1);
});
