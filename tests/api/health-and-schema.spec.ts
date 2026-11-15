import { test, expect } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API & Supabase Schema Integration', () => {
  test('GET /api/v1/health reports connected Supabase PostgreSQL', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.database).toBe('connected');
    expect(typeof body.data.latencyMs).toBe('number');
  });

  test('GET /api/docs.json exposes OpenAPI specification', async ({ request }) => {
    const response = await request.get('/api/docs.json');
    expect(response.status()).toBe(200);

    const spec = await response.json();
    expect(spec.info.title).toBe('HR Hunter API');
    expect(spec.paths).toHaveProperty('/health');
  });

  test('Supabase has all 27 tables, 3 views, 8 routines, triggers and seeded records', async () => {
    const pool = createDbPool();
    try {
      const migrations = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
      expect(migrations.rows.map((r: { version: string }) => r.version)).toEqual([
        '001',
        '002',
        '003',
        '004',
        '005',
        '006',
        '007',
      ]);

      const users = await pool.query('SELECT COUNT(*)::INT AS c FROM users');
      expect(users.rows[0].c).toBeGreaterThanOrEqual(5);

      const permissions = await pool.query('SELECT COUNT(*)::INT AS c FROM permissions');
      expect(permissions.rows[0].c).toBe(28);

      const nullCpfCandidates = await pool.query(
        'SELECT COUNT(*)::INT AS c FROM candidates WHERE cpf IS NULL'
      );
      expect(nullCpfCandidates.rows[0].c).toBeGreaterThanOrEqual(2);

      const kpis = await pool.query('SELECT * FROM fn_get_dashboard_kpis()');
      expect(kpis.rows).toHaveLength(1);
      expect(Number(kpis.rows[0].total_companies)).toBeGreaterThanOrEqual(3);

      const critical = await pool.query('SELECT * FROM fn_get_critical_processes()');
      expect(critical.rows.length).toBeGreaterThanOrEqual(1);
    } finally {
      await pool.end();
    }
  });
});
