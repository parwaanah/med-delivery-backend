import { LoggerService } from '@nestjs/common';
export declare class GlobalLogger implements LoggerService {
    private logDir;
    private logFile;
    private errorFile;
    constructor();
    private writeToFile;
    private format;
    log(message: any, context?: string): void;
    error(message: any, trace?: string, context?: string): void;
    warn(message: any, context?: string): void;
}
