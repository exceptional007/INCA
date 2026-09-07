import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, body } = req;
    const startTime = Date.now();

    // Mask sensitive fields in logs
    let bodyLog = '';
    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      const sanitized = { ...body };
      for (const key of Object.keys(sanitized)) {
        if (/password|token|secret|authorization/i.test(key)) {
          sanitized[key] = '***MASKED***';
        }
      }
      bodyLog = ` | Body: ${JSON.stringify(sanitized)}`;
    }

    this.logger.log(`--> ${method} ${originalUrl}${bodyLog}`);

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const user = (req as any).user ? ` [${(req as any).user.email || (req as any).user.role}]` : '';
      const message = `<-- ${method} ${originalUrl} ${statusCode} (${duration}ms)${user}`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
