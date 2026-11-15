const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createDbPool } = require('./db');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

async function runMigrations() {
  const pool = createDbPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(50) PRIMARY KEY,
        filename    VARCHAR(255) NOT NULL,
        checksum    VARCHAR(64),
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedResult = await client.query('SELECT version, checksum FROM schema_migrations');
    const appliedMap = new Map(appliedResult.rows.map((r) => [r.version, r.checksum]));

    let appliedCount = 0;

    for (const filename of files) {
      const version = filename.split('_')[0];
      const fullPath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      if (appliedMap.has(version)) {
        const existingChecksum = appliedMap.get(version);
        if (existingChecksum && existingChecksum !== checksum) {
          throw new Error(
            `Checksum mismatch for already-applied migration ${filename} (version ${version}).`
          );
        }
        console.log(`[SKIP] ${filename} already applied.`);
        continue;
      }

      console.log(`[APPLY] Running ${filename}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, filename, checksum)
           VALUES ($1, $2, $3)
           ON CONFLICT (version) DO NOTHING`,
          [version, filename, checksum]
        );
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`[OK] Applied ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[FAIL] Migration ${filename} failed:`, err.message);
        throw err;
      }
    }

    console.log(`Migrations complete. Newly applied: ${appliedCount}/${files.length}`);
    return { total: files.length, newlyApplied: appliedCount };
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
