const { query } = require('../config/database');
const { mapRow, mapRows, normalizeOptionalString } = require('../utils/dbMapper');

async function getDashboardKpis(filters = {}) {
  const startDate = normalizeOptionalString(filters.startDate);
  const endDate = normalizeOptionalString(filters.endDate);
  const companyId = filters.companyId ? Number(filters.companyId) : null;
  const department = normalizeOptionalString(filters.department);

  const res = await query(
    `SELECT * FROM fn_get_dashboard_kpis($1::timestamptz, $2::timestamptz, $3::bigint, $4::varchar)`,
    [startDate, endDate, companyId, department],
  );

  const row = mapRow(res.rows[0] || {});
  return {
    totalCompanies: Number(row.totalCompanies || 0),
    activeJobOpenings: Number(row.activeJobOpenings || 0),
    totalCandidates: Number(row.totalCandidates || 0),
    ongoingProcesses: Number(row.ongoingProcesses || 0),
    pendingOffers: Number(row.pendingOffers || 0),
    hiredCount: Number(row.hiredCount || 0),
    newJobOpenings: Number(row.newJobOpenings || 0),
    conversionRate: Number(row.conversionRate || 0),
    avgDaysToFill: Number(row.avgDaysToFill || 0),
    filters: { startDate, endDate, companyId, department },
  };
}

async function getDashboardAnalytics(filters = {}) {
  const startDate = normalizeOptionalString(filters.startDate);
  const endDate = normalizeOptionalString(filters.endDate);
  const companyId = filters.companyId ? Number(filters.companyId) : null;
  const department = normalizeOptionalString(filters.department);
  const jobOpeningId = filters.jobOpeningId ? Number(filters.jobOpeningId) : null;

  const [analyticsRes, stageRes, topCompaniesRes] = await Promise.all([
    query(`SELECT * FROM fn_get_dashboard_analytics($1::timestamptz, $2::timestamptz, $3::bigint)`, [
      startDate,
      endDate,
      companyId,
    ]),
    query(`SELECT * FROM fn_get_candidates_by_stage($1::bigint, $2::bigint)`, [
      jobOpeningId,
      companyId,
    ]),
    query(
      `SELECT * FROM vw_recruitment_metrics
       ${companyId ? 'WHERE company_id = $1' : ''}
       ORDER BY active_job_openings DESC, total_candidates_applied DESC
       LIMIT 5`,
      companyId ? [companyId] : [],
    ),
  ]);

  const rawAnalytics = mapRows(analyticsRes.rows);
  const candidatesByDepartment = rawAnalytics
    .filter((r) => r.chartType === 'CandidatesByDepartment')
    .filter((r) => !department || r.label.toLowerCase() === department.toLowerCase())
    .map((r) => ({ department: r.label, total: Number(r.total || 0) }));

  const jobStatusDistribution = rawAnalytics
    .filter((r) => r.chartType === 'JobStatusDistribution')
    .map((r) => ({ status: r.label, total: Number(r.total || 0) }));

  const candidateEvolution = rawAnalytics
    .filter((r) => r.chartType === 'CandidateEvolution')
    .map((r) => ({ date: r.label, total: Number(r.total || 0) }));

  const candidatesByStage = mapRows(stageRes.rows).map((r) => ({
    stageId: Number(r.stageId),
    stageName: r.stageName,
    stageOrder: Number(r.stageOrder),
    candidateCount: Number(r.candidateCount || 0),
    averageRating: r.averageRating !== null ? Number(r.averageRating) : null,
  }));

  const topCompanies = mapRows(topCompaniesRes.rows).map((r) => ({
    companyId: Number(r.companyId),
    companyName: r.companyName,
    totalJobOpenings: Number(r.totalJobOpenings || 0),
    activeJobOpenings: Number(r.activeJobOpenings || 0),
    totalCandidatesApplied: Number(r.totalCandidatesApplied || 0),
    candidatesInProcess: Number(r.candidatesInProcess || 0),
    avgProcessDays: r.avgProcessDays !== null ? Number(r.avgProcessDays) : null,
  }));

  return {
    candidatesByDepartment,
    jobStatusDistribution,
    candidateEvolution,
    candidatesByStage,
    topCompanies,
  };
}

async function getCriticalProcesses(filters = {}) {
  const companyId = filters.companyId ? Number(filters.companyId) : null;
  const res = await query(`SELECT * FROM fn_get_critical_processes($1::bigint)`, [companyId]);

  const items = mapRows(res.rows).map((r) => ({
    criticalType: r.criticalType,
    jobOpeningId: Number(r.jobOpeningId),
    title: r.title,
    companyName: r.companyName,
    daysElapsed: Number(r.daysElapsed || 0),
    candidateCount: Number(r.candidateCount || 0),
  }));

  return {
    items,
    total: items.length,
    longOpenJobsCount: items.filter((i) => i.criticalType === 'Vaga Aberta Há Longo Tempo').length,
    stalledProcessesCount: items.filter((i) => i.criticalType === 'Processo Parado').length,
  };
}

module.exports = {
  getDashboardKpis,
  getDashboardAnalytics,
  getCriticalProcesses,
};
