export function validateEnv() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const isProd = nodeEnv === 'production';

  const errors: string[] = [];
  const warnings: string[] = [];

  const requireValue = (name: string) => {
    const value = String(process.env[name] || '').trim();
    if (!value) errors.push(`${name} is required`);
    return value;
  };

  requireValue('DATABASE_URL');

  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (jwtSecret === 'dev-secret') {
    if (isProd) {
      errors.push('JWT_SECRET cannot be "dev-secret" in production');
    } else {
      warnings.push('JWT_SECRET is using the dev default');
    }
  }

  if (isProd) {
    if (String(process.env.AUTH_COOKIE_MODE || '').trim() !== '1') {
      errors.push('AUTH_COOKIE_MODE must be "1" in production');
    }

    const corsOrigin = String(process.env.CORS_ORIGIN || '').trim();
    if (!corsOrigin) errors.push('CORS_ORIGIN is required in production');
    if (corsOrigin.includes('*')) {
      errors.push('CORS_ORIGIN cannot include "*" in production');
    }
  } else {
    if (!String(process.env.CORS_ORIGIN || '').trim()) {
      warnings.push('CORS_ORIGIN is not set (defaulting to localhost)');
    }
  }

  const rateLimitWindowMs = String(process.env.RATE_LIMIT_WINDOW_MS || '').trim();
  if (rateLimitWindowMs && !Number.isFinite(Number(rateLimitWindowMs))) {
    errors.push('RATE_LIMIT_WINDOW_MS must be a number');
  }

  const rateLimitMax = String(process.env.RATE_LIMIT_MAX || '').trim();
  if (rateLimitMax && !Number.isFinite(Number(rateLimitMax))) {
    errors.push('RATE_LIMIT_MAX must be a number');
  }

  if (errors.length) {
    throw new Error(`Env validation failed:\n- ${errors.join('\n- ')}`);
  }

  if (warnings.length) {
    console.warn(`Env validation warnings:\n- ${warnings.join('\n- ')}`);
  }
}
