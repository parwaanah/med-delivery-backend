import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { GlobalLogger } from '../logger/global-logger.service';
export declare class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger;
    constructor(logger: GlobalLogger);
    use(req: Request, res: Response, next: NextFunction): void;
}
