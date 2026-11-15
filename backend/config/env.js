const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  dbSsl: process.env.DB_SSL !== 'false',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-jwt-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-only-refresh-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
};

module.exports = env;
