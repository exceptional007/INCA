import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Health check endpoint reporting server and database status' })
  @ApiResponse({ status: 200, description: 'Server and database are healthy' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  @Get()
  async check() {
    const timestamp = new Date().toISOString();
    try {
      // Lightweight query to verify database responsiveness
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        timestamp,
        services: {
          database: {
            status: 'up',
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
}
