const { createDbPool } = require('./db');

async function inspectSchema() {
  const pool = createDbPool();
  const client = await pool.connect();

  try {
    const tables = await client.query(
      `SELECT table_name, table_type
         FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_type, table_name`
    );

    const routines = await client.query(
      `SELECT routine_name
         FROM information_schema.routines
        WHERE routine_schema = 'public'
        ORDER BY routine_name`
    );

    const triggers = await client.query(
      `SELECT trigger_name, event_object_table
         FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name`
    );

    const counts = [];
    for (const row of tables.rows.filter((r) => r.table_type === 'BASE TABLE')) {
      const cnt = await client.query(`SELECT COUNT(*)::INT AS c FROM "${row.table_name}"`);
      counts.push({ table: row.table_name, rows: cnt.rows[0].c });
    }

    const summary = {
      tables: tables.rows,
      routines: routines.rows.map((r) => r.routine_name),
      triggers: triggers.rows,
      rowCounts: counts,
    };

    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  inspectSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { inspectSchema };
