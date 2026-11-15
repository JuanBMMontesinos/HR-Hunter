const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  tz: process.env.TZ || 'America/Sao_Paulo',
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
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 5),
  exportRateLimitMax: Number(process.env.EXPORT_RATE_LIMIT_MAX || 10),
  cookieSecure:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : nodeEnv === 'production',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@hrhunter.com',
  enableRetentionCron:
    process.env.ENABLE_RETENTION_CRON === 'true' ||
    (nodeEnv === 'production' && process.env.ENABLE_RETENTION_CRON !== 'false'),
  retentionCronSchedule: process.env.RETENTION_CRON_SCHEDULE || '0 2 * * *',
};

module.exports = env;
