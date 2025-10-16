import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, type ThrottlerModuleOptions, ThrottlerStorage, ThrottlerLimitDetail } from '@nestjs/throttler';
export declare class GlobalThrottlerGuard extends ThrottlerGuard {
    constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector);
    protected throwThrottlingException(context: ExecutionContext, _limitDetail: ThrottlerLimitDetail): Promise<void>;
}
