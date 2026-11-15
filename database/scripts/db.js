const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function createDbPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in .env');
  }

  const useSsl = process.env.DB_SSL !== 'false';
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });
}

module.exports = { createDbPool };
