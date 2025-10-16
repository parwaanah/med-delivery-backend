import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { RequestContext } from '../../common/context/request-context'; // ✅ for request ID
import util from 'util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = RequestContext.getRequestId(); // ✅ get current reqId
    const user = (request as any).user || {};

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    // 🧩 Handle known NestJS HttpExceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
      details = typeof res === 'object' ? res : null;
    }
    // 🧩 Handle Prisma known request errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database request error';
      details = { code: exception.code, meta: exception.meta };
    }
    // 🧩 Handle Prisma validation errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid Prisma query';
    }
    // 🧩 Handle other generic JS errors
    else if (exception instanceof Error) {
      message = exception.message;
      details = exception.stack;
    }

    // 🧠 Safe stringify for details (no circular JSON)
    const safeDetails = this.safeStringify(details);

    const logPayload = {
      requestId,
      method: request.method,
      url: request.url,
      status,
      message,
      details: safeDetails,
      ip: request.ip || request.headers['x-forwarded-for'] || 'unknown',
      userId: user.id ?? '-',
      userRole: user.role ?? '-',
      timestamp: new Date().toISOString(),
    };

    const logMessage = `[reqId:${requestId}] ${request.method} ${request.url} → ${status} :: ${message}`;

    // 🧾 Log to both NestJS & Winston
    this.logger.error(logMessage);
    this.winstonLogger.error(logMessage, logPayload);

    // 🚀 Respond safely to client
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId, // ✅ helpful for frontend correlation
      ...(process.env.NODE_ENV === 'development' ? { details: safeDetails } : {}),
    });
  }

  private safeStringify(value: any) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return util.inspect(value, { depth: 2, colors: false });
    }
  }
}
