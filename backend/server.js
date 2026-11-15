const app = require('./app');
const env = require('./config/env');
const { closePool } = require('./config/database');
const logger = require('./utils/logger');
const { startRetentionScheduler, stopRetentionScheduler } = require('./services/retentionService');

const server = app.listen(env.port, () => {
  logger.info(`HR Hunter API listening on port ${env.port} (${env.nodeEnv})`);
  startRetentionScheduler();
});

async function shutdown(signal) {
  logger.info(`Received ${signal}. Closing HTTP server, cron scheduler, and Supabase DB pool...`);
  stopRetentionScheduler();
  server.close(async () => {
    await closePool();
    logger.info('Graceful shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
