import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger as WinstonLogger } from 'winston';
export declare class ErrorLoggerMiddleware implements NestMiddleware {
    private readonly winstonLogger;
    private readonly fallbackLogger;
    constructor(winstonLogger: WinstonLogger);
    use(req: Request, res: Response, next: NextFunction): void;
    private safeStringify;
}
