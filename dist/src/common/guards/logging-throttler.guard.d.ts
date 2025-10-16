import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerStorage, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import 'winston-daily-rotate-file';
export declare class LoggingThrottlerGuard extends ThrottlerGuard {
    protected readonly storageService: ThrottlerStorage;
    protected readonly reflector: Reflector;
    private readonly logger;
    constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector);
    protected throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: ThrottlerLimitDetail): Promise<void>;
}
