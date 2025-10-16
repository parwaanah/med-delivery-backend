import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Logger as WinstonLogger } from 'winston';
export declare class HttpExceptionFilter implements ExceptionFilter {
    private readonly winstonLogger;
    private readonly logger;
    constructor(winstonLogger: WinstonLogger);
    catch(exception: unknown, host: ArgumentsHost): void;
    private safeStringify;
}
