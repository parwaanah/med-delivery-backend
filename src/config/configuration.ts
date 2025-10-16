export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10), // ✅ fixed undefined issue
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'fallback_secret',
});
