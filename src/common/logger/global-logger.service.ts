import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GlobalLogger implements LoggerService {
  private logDir = path.join(process.cwd(), 'logs');
  private logFile = path.join(this.logDir, 'app.log');
  private errorFile = path.join(this.logDir, 'errors.log');

  constructor() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }
  }

  private writeToFile(filePath: string, message: string) {
    fs.appendFileSync(filePath, message + '\n', { encoding: 'utf8' });
  }

  private format(level: string, message: any, context?: string): string {
    const ts = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    return `[${ts}] [${level}] ${ctx} ${typeof message === 'string' ? message : JSON.stringify(message)}`;
  }

  log(message: any, context?: string) {
    const formatted = this.format('INFO', message, context);
    console.log(formatted);
    this.writeToFile(this.logFile, formatted);
  }

  error(message: any, trace?: string, context?: string) {
    const formatted = this.format('ERROR', message, context);
    console.error(formatted, trace || '');
    this.writeToFile(this.errorFile, formatted + (trace ? `\n${trace}` : ''));
  }

  warn(message: any, context?: string) {
    const formatted = this.format('WARN', message, context);
    console.warn(formatted);
    this.writeToFile(this.logFile, formatted);
  }
}
