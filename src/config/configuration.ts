export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
});
