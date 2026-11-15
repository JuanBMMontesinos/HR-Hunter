import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Processes, Kanban, Stage Transitions, Offers & Timeline', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const actorEmail = `pw3-proc-${suffix}@example.com`;
  const password = `Pw3Proc#${suffix}!`;
  let actorUserId: number;
  let companyId: number;
  let jobId: number;
  const candidateIds: number[] = [];
  const processIds: number[] = [];

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'PW3 Recrutador Proc', 'Recrutador', 'Recrutamento', TRUE)
       RETURNING id`,
      [actorEmail, hash],
    );
    actorUserId = Number(u.rows[0].id);

    const comp = await pool.query(
      `INSERT INTO companies (legal_name, cnpj, status)
       VALUES ($1, $2, 'Ativo') RETURNING id`,
      [`PW3 Proc Co ${suffix}`, `77.${String(Date.now()).slice(-3)}.222/0001-44`],
    );
    companyId = Number(comp.rows[0].id);

    const funnel = await pool.query(`SELECT id FROM stage_funnels WHERE is_default = TRUE LIMIT 1`);
    const funnelId = Number(funnel.rows[0].id);

    const job = await pool.query(
      `INSERT INTO job_openings (company_id, funnel_id, title, department, status, priority, responsible_user_id)
       VALUES ($1, $2, $3, 'Engenharia', 'Aberta', 'Alta', $4)
       RETURNING id`,
      [companyId, funnelId, `Backend Lead ${suffix}`, actorUserId],
    );
    jobId = Number(job.rows[0].id);

    for (const i of [1, 2]) {
      const cand = await pool.query(
        `INSERT INTO candidates (full_name, email, status)
         VALUES ($1, $2, 'Ativo') RETURNING id`,
        [`Cand Proc ${i} ${suffix}`, `pw3-pc${i}-${suffix}@example.com`],
      );
      candidateIds.push(Number(cand.rows[0].id));
    }
  });

  test.afterAll(async () => {
    if (processIds.length > 0) {
      await pool.query(`DELETE FROM audit_log WHERE table_name IN ('recruitment_processes', 'offers') AND record_id = ANY($1::bigint[])`, [
        processIds,
      ]);
      await pool.query(`DELETE FROM recruitment_processes WHERE id = ANY($1::bigint[])`, [processIds]);
    }
    if (jobId) await pool.query(`DELETE FROM job_openings WHERE id = $1`, [jobId]);
    if (companyId) await pool.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
    if (candidateIds.length > 0) {
      await pool.query(`DELETE FROM candidates WHERE id = ANY($1::bigint[])`, [candidateIds]);
    }
    if (actorUserId) {
      await pool.query(`DELETE FROM audit_log WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM login_history WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [actorUserId]);
    }
    await pool.end();
  });

  test('executes full Kanban, next-stage, offer->accepted->hired, reject, and timeline flows', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const loginRes = await ctx.post('/api/v1/auth/login', { data: { email: actorEmail, password } });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // Start Process 1
    const p1Res = await ctx.post('/api/v1/processes', {
      headers,
      data: { jobOpeningId: jobId, candidateId: candidateIds[0], feedback: 'Triagem inicial.' },
    });
    expect(p1Res.status()).toBe(201);
    const p1 = (await p1Res.json()).data;
    processIds.push(p1.id);
    expect(p1.currentStageName).toBe('Candidatura Recebida');

    // Duplicate active process for same candidate + job must fail (409)
    const dupProcRes = await ctx.post('/api/v1/processes', {
      headers,
      data: { jobOpeningId: jobId, candidateId: candidateIds[0] },
    });
    expect(dupProcRes.status()).toBe(409);

    // Kanban board returns columns & p1 inside initial column
    const kanbanRes = await ctx.get(`/api/v1/processes/kanban?jobOpeningId=${jobId}`, { headers });
    expect(kanbanRes.status()).toBe(200);
    const kanban = (await kanbanRes.json()).data;
    expect(kanban.totalProcesses).toBe(1);
    const firstCol = kanban.columns.find((c: { stageName: string }) => c.stageName === 'Candidatura Recebida');
    expect(firstCol.processes.some((item: { id: number }) => item.id === p1.id)).toBe(true);

    // Advance next-stage via fn_move_to_next_stage
    const nextRes = await ctx.post(`/api/v1/processes/${p1.id}/next-stage`, {
      headers,
      data: {
        feedback: 'CV alinhado com requisitos.',
        rating: 5,
        strengths: 'PostgreSQL e Node.js',
        recommendation: 'Avançar',
        attachedDocuments: ['portfolio.pdf'],
      },
    });
    expect(nextRes.status()).toBe(200);
    const afterNext = (await nextRes.json()).data;
    expect(afterNext.currentStageName).toBe('Triagem CV');
    expect(afterNext.stages).toHaveLength(2);

    // Create offer -> auto-moves to 'Oferta'
    const offerRes = await ctx.post(`/api/v1/processes/${p1.id}/offer`, {
      headers,
      data: {
        salary: 18500,
        benefits: 'VR + Saúde',
        conditions: 'CLT Remoto',
        sendEmail: false,
      },
    });
    expect(offerRes.status()).toBe(201);
    const offerPayload = (await offerRes.json()).data;
    expect(offerPayload.process.currentStageName).toBe('Oferta');
    expect(offerPayload.offer.status).toBe('Enviada');

    // Mark offer Accepted -> auto-advances to 'Contratado' & trigger concludes process
    const acceptRes = await ctx.patch(`/api/v1/processes/${p1.id}/offer/${offerPayload.offer.id}`, {
      headers,
      data: { status: 'Aceita', advanceToHired: true },
    });
    expect(acceptRes.status()).toBe(200);
    const hired = (await acceptRes.json()).data;
    expect(hired.currentStageName).toBe('Contratado');
    expect(hired.status).toBe('Concluído');
    expect(hired.endDate).toBeTruthy();

    // Timeline has STAGE_CHANGE + OFFER + AUDIT
    const tlRes = await ctx.get(`/api/v1/processes/${p1.id}/timeline`, { headers });
    expect(tlRes.status()).toBe(200);
    const timeline = (await tlRes.json()).data.timeline;
    expect(timeline.some((e: { eventType: string }) => e.eventType === 'STAGE_CHANGE')).toBe(true);
    expect(timeline.some((e: { eventType: string }) => e.eventType === 'OFFER')).toBe(true);

    // Start Process 2 and Reject
    const p2Res = await ctx.post('/api/v1/processes', {
      headers,
      data: { jobOpeningId: jobId, candidateId: candidateIds[1] },
    });
    expect(p2Res.status()).toBe(201);
    const p2 = (await p2Res.json()).data;
    processIds.push(p2.id);

    const rejRes = await ctx.post(`/api/v1/processes/${p2.id}/reject`, {
      headers,
      data: { reason: 'Pretensão salarial acima do orçamento.', rating: 3, sendEmail: false },
    });
    expect(rejRes.status()).toBe(200);
    const rejected = (await rejRes.json()).data.process;
    expect(rejected.currentStageName).toBe('Rejeitado');
    expect(rejected.status).toBe('Concluído');

    await ctx.dispose();
  });
});
