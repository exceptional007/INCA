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
      const prismaError = exception as Prisma.PrismaClientKnownRequestError;
      if (prismaError.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = (prismaError.meta?.target as string[])?.join(', ') || 'unique field';
        message = `A record with this ${target} already exists.`;
      } else if (prismaError.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Requested record not found.';
      } else if (prismaError.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Operation failed due to a related record constraint.';
      } else if (prismaError.code === 'P2028') {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Database operation timed out. Please try again.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'A database constraint error occurred.';
      }
      this.logger.warn(`Prisma Known Error [${prismaError.code}]: ${prismaError.message.split('\n').pop()} on ${request.method} ${request.url}`);
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      const initError = exception as Prisma.PrismaClientInitializationError;
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database temporarily unreachable. Please try again shortly.';
      const errorCode = (initError as any).errorCode || 'UNKNOWN';
      this.logger.error(
        `Prisma Initialization/Connection Error [${errorCode}] on ${request.method} ${request.url}: ${initError.message}`,
      );
    } else if (exception instanceof Prisma.PrismaClientRustPanicError) {
      const panicError = exception as Prisma.PrismaClientRustPanicError;
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database service temporarily unavailable. Please try again shortly.';
      this.logger.error(
        `Prisma Engine Panic Error on ${request.method} ${request.url}: ${panicError.message}`,
      );
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