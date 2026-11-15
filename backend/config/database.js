const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const startedAt = Date.now();
  await pool.query('SELECT 1');
  return {
    connected: true,
    latencyMs: Date.now() - startedAt,
  };
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  healthCheck,
  closePool,
};
