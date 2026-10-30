import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { RequestContext } from '../common/context/request-context';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public lastConnectionDurationMs: number = 0;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const detailedLoggingEnabled = process.env.PRISMA_LOG_QUERIES === 'true';

    // Normalize and tune database URL connection pool parameters
    const configuredUrl = PrismaService.resolveConfiguredDatabaseUrl();

    super({
      datasources: {
        db: {
          url: configuredUrl,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    this.logPoolDiagnostics(configuredUrl);
    this.setupQueryDiagnostics(detailedLoggingEnabled, isProduction);
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Disconnecting from database during application shutdown...');
      await this.$disconnect();
      this.logger.log('Database connection pool disconnected cleanly.');
    } catch (err: any) {
      this.logger.error(
        `Error during database disconnect: ${PrismaService.sanitizeErrorMessage(err?.message || String(err))}`,
      );
    }
  }

  /**
   * Overrides $transaction to ensure serverless/cloud databases (like Neon)
   * have adequate interactive transaction timeouts (default 30s instead of Prisma's default 5s).
   */
  // @ts-ignore
  override $transaction(arg: any, options?: any): Promise<any> {
    if (typeof arg === 'function') {
      const tunedOptions = {
        maxWait: 15000, // 15 seconds to acquire connection from pool
        timeout: 30000, // 30 seconds for interactive transaction execution
        ...options,
      };
      return super.$transaction(arg, tunedOptions);
    }
    return super.$transaction(arg, options);
  }

  /**
   * Normalizes the DATABASE_URL to ensure critical connection pool parameters
   * (connection_limit, connect_timeout, pool_timeout, and pgbouncer) are tuned for serverless PostgreSQL.
   */
  private static resolveConfiguredDatabaseUrl(): string {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
      return '';
    }

    try {
      const url = new URL(rawUrl);
      const isPooler = url.hostname.includes('pooler');

      // Default connection limit to 10 if not specified
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '10');
      }

      // Default connection timeout to 15s to allow for serverless compute wake-up
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', process.env.DB_CONNECT_TIMEOUT || '15');
      }

      // Default pool acquisition timeout to 20s
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '20');
      }

      // Ensure PgBouncer transaction mode flag is set for pooled endpoints
      if (isPooler && !url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true');
      }

      // Ensure TLS is enforced
      if (!url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'require');
      }

      return url.toString();
    } catch {
      // If URL parsing fails, return raw string and let Prisma validation handle diagnostics
      return rawUrl;
    }
  }

  /**
   * Logs a non-sensitive summary of database connection pool settings.
   */
  private logPoolDiagnostics(fullUrl: string): void {
    try {
      if (!fullUrl) {
        this.logger.warn('DATABASE_URL is not defined in environment variables.');
        return;
      }

      const url = new URL(fullUrl);
      const hostParts = url.hostname.split('.');
      const maskedHost =
        hostParts.length > 2
          ? `${hostParts[0].slice(0, 4)}***.${hostParts.slice(-3).join('.')}`
          : url.hostname;

      const isPooler = url.hostname.includes('pooler');
      const poolLimit = url.searchParams.get('connection_limit') || 'default';
      const connectTimeout = url.searchParams.get('connect_timeout') || 'default';
      const poolTimeout = url.searchParams.get('pool_timeout') || 'default';
      const pgbouncer = url.searchParams.get('pgbouncer') === 'true';

      this.logger.log(
        `Prisma pool initialized: host=${maskedHost} pooler=${isPooler} pgbouncer=${pgbouncer} ` +
          `connection_limit=${poolLimit} connect_timeout=${connectTimeout}s pool_timeout=${poolTimeout}s`,
      );
    } catch {
      this.logger.log('Prisma pool initialized with configured database parameters.');
    }
  }

  private setupQueryDiagnostics(enabled: boolean, isProduction: boolean): void {
    const slowQueryThresholdMs =
      Number(process.env.PRISMA_SLOW_QUERY_THRESHOLD_MS) || 1000;
    const allowFullSql =
      !isProduction && process.env.PRISMA_LOG_FULL_SQL === 'true';

    (this as any).$on('query', (event: any) => {
      const durationMs =
        typeof event.duration === 'number' ? event.duration : 0;
      const isSlow = durationMs >= slowQueryThresholdMs;

      // Skip non-slow queries if detailed query logging is not enabled
      if (!enabled && !isSlow) {
        return;
      }

      const timestamp = event.timestamp
        ? new Date(event.timestamp).toISOString()
        : new Date().toISOString();
      const correlationId = RequestContext.getCorrelationId() || 'system';

      const safeQueryId = allowFullSql
        ? this.sanitizeSqlStatement(event.query || '')
        : this.extractSafeQueryIdentifier(event.query || '');

      const logPayload = `[corrId=${correlationId}] [query=${safeQueryId}] [duration=${durationMs}ms] [time=${timestamp}]`;

      if (isSlow) {
        this.logger.warn(`SLOW QUERY (>=${slowQueryThresholdMs}ms) ${logPayload}`);
      } else {
        this.logger.log(`QUERY ${logPayload}`);
      }
    });
  }

  /**
   * Sanitizes and classifies database connection errors.
   * Differentiates permanent configuration errors (which must NOT be retried)
   * from transient network or serverless wake-up errors.
   */
  private static isTransientError(error: any): boolean {
    const errorCode = String(error?.errorCode || error?.code || '');
    const errorMessage = String(error?.message || '').toLowerCase();

    // Permanent configuration errors: Retrying will never succeed
    const permanentCodes = [
      'P1000', // Authentication failed (invalid credentials)
      'P1003', // Database does not exist
      'P1010', // User was denied access
      'P1011', // Error opening TLS connection (cert/cipher error)
      'P1012', // Schema parsing/validation failure
      'P1013', // Invalid database connection string
      'P1014', // Underlying model/table does not exist
      'P1016', // Incorrect number of parameters
    ];

    if (permanentCodes.includes(errorCode)) {
      return false;
    }

    if (
      errorMessage.includes('password authentication failed') ||
      errorMessage.includes('database does not exist') ||
      errorMessage.includes('role does not exist') ||
      errorMessage.includes('invalid connection string') ||
      errorMessage.includes('invalid credentials')
    ) {
      return false;
    }

    // Transient errors: P1001 (can't reach server), P1002 (timeout), P1008 (operation timeout),
    // network connection resets, and cold-start serverless stalls.
    return true;
  }

  /**
   * Strips passwords and connection tokens from error strings to prevent credential leaks.
   */
  private static sanitizeErrorMessage(msg: string): string {
    return msg
      .replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://***:***@')
      .replace(/password=[^\s&]+/gi, 'password=***')
      .split('\n')[0]
      .trim();
  }

  private extractSafeQueryIdentifier(rawQuery: string): string {
    const trimmed = rawQuery.trim().replace(/\s+/g, ' ');
    if (/^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE)/i.test(trimmed)) {
      return trimmed.split(' ')[0].toUpperCase();
    }

    if (/^SELECT\s+1\b/i.test(trimmed)) {
      return 'SELECT 1';
    }

    const selectMatch = trimmed.match(
      /^SELECT\b.*?FROM\s+["`]?([a-zA-Z0-9_."]+)["`]?/i,
    );
    if (selectMatch) {
      const table = selectMatch[1].replace(/["`]/g, '').split('.').pop();
      return `SELECT FROM ${table}`;
    }

    const insertMatch = trimmed.match(
      /^INSERT INTO\s+["`]?([a-zA-Z0-9_."]+)["`]?/i,
    );
    if (insertMatch) {
      const table = insertMatch[1].replace(/["`]/g, '').split('.').pop();
      return `INSERT INTO ${table}`;
    }

    const updateMatch = trimmed.match(/^UPDATE\s+["`]?([a-zA-Z0-9_."]+)["`]?/i);
    if (updateMatch) {
      const table = updateMatch[1].replace(/["`]/g, '').split('.').pop();
      return `UPDATE ${table}`;
    }

    const deleteMatch = trimmed.match(
      /^DELETE FROM\s+["`]?([a-zA-Z0-9_."]+)["`]?/i,
    );
    if (deleteMatch) {
      const table = deleteMatch[1].replace(/["`]/g, '').split('.').pop();
      return `DELETE FROM ${table}`;
    }

    return trimmed.slice(0, 40).replace(/["`]/g, '');
  }

  private sanitizeSqlStatement(sql: string): string {
    return sql
      .replace(/'[^']*'/g, "'***'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async connectWithRetry(
    maxRetries = Number(process.env.DB_MAX_RETRIES) || 5,
    initialDelayMs = 1000,
    maxDelayMs = 8000,
  ): Promise<void> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxRetries) {
      attempt++;
      try {
        this.logger.log(
          `Establishing database connection (attempt ${attempt}/${maxRetries})...`,
        );
        const connectStart = performance.now();
        await this.$connect();
        const connectDurationMs =
          Math.round((performance.now() - connectStart) * 100) / 100;
        this.lastConnectionDurationMs = connectDurationMs;

        this.logger.log(
          `Database connection established successfully in ${connectDurationMs}ms (attempt ${attempt}/${maxRetries}).`,
        );
        return;
      } catch (error: any) {
        const errorCode = error?.errorCode || error?.code || 'UNKNOWN';
        const sanitizedMsg = PrismaService.sanitizeErrorMessage(
          error?.message || String(error),
        );

        const isTransient = PrismaService.isTransientError(error);

        // If error is permanent (e.g. invalid credentials or missing database), abort immediately
        if (!isTransient) {
          this.logger.error(
            `Permanent database configuration error [${errorCode}]: ${sanitizedMsg}. Retrying aborted.`,
          );
          throw error;
        }

        if (attempt >= maxRetries) {
          this.logger.error(
            `Failed to connect to database after ${maxRetries} attempts [${errorCode}]: ${sanitizedMsg}`,
          );
          throw error;
        }

        this.logger.warn(
          `Transient database connection attempt ${attempt}/${maxRetries} failed [${errorCode}]: ${sanitizedMsg}. Retrying in ${delay}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(Math.round(delay * 1.5), maxDelayMs);
      }
    }
  }
}
