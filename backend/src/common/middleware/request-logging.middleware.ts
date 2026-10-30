import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { RequestContext } from '../context/request-context';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const rawCorrId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    const correlationId =
      (Array.isArray(rawCorrId) ? rawCorrId[0] : rawCorrId) || randomUUID();

    res.setHeader('X-Correlation-Id', correlationId);

    const { method } = req;
    // Strip query parameters to avoid logging sensitive tokens, credentials, or personal search terms
    const safePath = req.originalUrl.split('?')[0];
    const startTime = performance.now();

    // Log incoming request with safe route identifier and correlation ID
    this.logger.log(`--> [${correlationId}] ${method} ${safePath}`);

    res.on('finish', () => {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const { statusCode } = res;

      // Extract route template if matched by router (e.g., /api/v1/polls/:id), otherwise fallback to safe path
      const routeTemplate = req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : safePath;

      const slowThresholdMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS) || 1000;
      const isSlow = durationMs >= slowThresholdMs;

      const userRole = (req as any).user
        ? ` [${(req as any).user.role || 'USER'}]`
        : '';
      const slowAlert = isSlow ? ` [SLOW >= ${slowThresholdMs}ms]` : '';

      const logMessage = `<-- [${correlationId}] ${method} ${routeTemplate} ${statusCode} (${durationMs}ms)${userRole}${slowAlert}`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (isSlow || statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    RequestContext.run({ correlationId }, () => next());
  }
}
