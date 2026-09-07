import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'unique field';
        message = `A record with this ${target} already exists.`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Requested record not found.';
      } else if (exception.code === 'P2028') {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Database operation timed out. Please try again.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Database error (${exception.code}): ${exception.message.split('\n').pop()}`;
      }
      this.logger.warn(`Prisma Known Error [${exception.code}]: ${message} on ${request.method} ${request.url}`);
    } else {
      this.logger.error(
        `Unhandled Exception on ${request.method} ${request.url}:`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}