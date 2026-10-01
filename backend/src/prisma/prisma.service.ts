import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database connection disconnected cleanly.');
    } catch (err: any) {
      this.logger.error(`Error during database disconnect: ${err.message}`);
    }
  }

  private async connectWithRetry(
    maxRetries = Number(process.env.DB_MAX_RETRIES) || 5,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
  ): Promise<void> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxRetries) {
      attempt++;
      try {
        this.logger.log(
          `Connecting to database (attempt ${attempt}/${maxRetries})...`,
        );
        await this.$connect();
        this.logger.log('Database connection established successfully.');
        return;
      } catch (error: any) {
        const errorCode = error?.errorCode || error?.code || 'UNKNOWN';
        const errorMessage = error?.message?.split('\n')[0] || error?.message || String(error);

        if (attempt >= maxRetries) {
          this.logger.error(
            `Failed to connect to database after ${maxRetries} attempts [${errorCode}]: ${errorMessage}`,
          );
          throw error;
        }

        this.logger.warn(
          `Database connection attempt ${attempt}/${maxRetries} failed [${errorCode}]: ${errorMessage}. Retrying in ${delay}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelayMs);
      }
    }
  }
}

