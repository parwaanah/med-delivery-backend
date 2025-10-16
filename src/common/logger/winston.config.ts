import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';

export const winstonConfig: winston.LoggerOptions = {
  transports: [
    // 🖥️ Console output with pretty Nest-style + JSON detail
    new winston.transports.Console({
      format: winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
    const extras =
      meta && Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const ctx = context && typeof context === 'string' ? context : '';
    return `[${timestamp}] ${level}: ${message} ${ctx ? `(${ctx})` : ''} ${extras}`;
  }),
),

    }),

    // 📁 Daily log file for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // 📁 Combined log file (info + warn + error)
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};
