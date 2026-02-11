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

  private scrub(value: any): any {
    const MAX_DEPTH = 6;
    const redactKeys = new Set([
      'password',
      'pass',
      'otp',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'set-cookie',
      'apiKey',
      'secret',
      'client_secret',
      'webhook_secret',
    ]);

    const visit = (v: any, depth: number): any => {
      if (depth > MAX_DEPTH) return '[Truncated]';
      if (v == null) return v;
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return v;
      if (Array.isArray(v)) return v.slice(0, 100).map((x) => visit(x, depth + 1));
      if (typeof v !== 'object') return String(v);

      const out: any = {};
      for (const [k, val] of Object.entries(v)) {
        const key = String(k);
        if (redactKeys.has(key) || redactKeys.has(key.toLowerCase())) {
          out[key] = '[REDACTED]';
        } else {
          out[key] = visit(val, depth + 1);
        }
      }
      return out;
    };

    return visit(value, 0);
  }

  private format(level: string, message: any, context?: string): string {
    const ts = new Date().toISOString();
    const base: any = { ts, level };
    if (context) base.context = context;
    if (typeof message === 'string') {
      base.message = message;
    } else {
      base.message = this.scrub(message);
    }
    return JSON.stringify(base);
  }

  log(message: any, context?: string) {
    const formatted = this.format('INFO', message, context);
    console.log(formatted);
    this.writeToFile(this.logFile, formatted);
  }

  error(message: any, trace?: string, context?: string) {
    const withTrace =
      trace && message && typeof message === 'object'
        ? { ...message, trace }
        : trace
          ? { message, trace }
          : message;
    const formatted = this.format('ERROR', withTrace, context);
    console.error(formatted);
    this.writeToFile(this.errorFile, formatted);
  }

  warn(message: any, context?: string) {
    const formatted = this.format('WARN', message, context);
    console.warn(formatted);
    this.writeToFile(this.logFile, formatted);
  }
}
