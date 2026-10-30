import {
  Controller,
  Get,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'Standard health check endpoint reporting server and database status',
  })
  @ApiResponse({ status: 200, description: 'Server and database are healthy' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  @Get()
  async check() {
    const timestamp = new Date().toISOString();
    try {
      const dbStart = performance.now();
      // Lightweight query to verify database responsiveness
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs =
        Math.round((performance.now() - dbStart) * 100) / 100;

      return {
        status: 'ok',
        timestamp,
        services: {
          database: {
            status: 'up',
            latencyMs,
          },
        },
      };
    } catch (error: any) {
      const errorCode = error?.errorCode || error?.code || 'UNKNOWN';
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp,
        services: {
          database: {
            status: 'down',
            code: errorCode,
            message: 'Database temporarily unreachable',
          },
        },
      });
    }
  }

  @ApiOperation({
    summary: 'Diagnostic performance and infrastructure metrics (safe, non-sensitive)',
  })
  @ApiResponse({ status: 200, description: 'Diagnostic telemetry and health state' })
  @Get('diagnostics')
  async diagnostics() {
    const timestamp = new Date().toISOString();
    const dbStart = performance.now();
    let dbStatus = 'up';
    let dbDurationMs = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbDurationMs = Math.round((performance.now() - dbStart) * 100) / 100;
    } catch {
      dbStatus = 'down';
      dbDurationMs = Math.round((performance.now() - dbStart) * 100) / 100;
    }

    const memory = process.memoryUsage();

    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      timestamp,
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        pingLatencyMs: dbDurationMs,
        lastConnectionDurationMs: this.prisma.lastConnectionDurationMs,
      },
      memory: {
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }
}
