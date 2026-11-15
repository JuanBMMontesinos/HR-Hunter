const PDFDocument = require('pdfkit');
const { query } = require('../config/database');
const { escapeCsvCell } = require('../utils/sanitizer');
const { logAction } = require('./auditService');

function buildDateFilter(columnName, { startDate, endDate }, startIndex = 1) {
  const conditions = [];
  const params = [];
  let idx = startIndex;

  if (startDate) {
    params.push(startDate);
    conditions.push(`${columnName} >= $${idx}::timestamptz`);
    idx += 1;
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`${columnName} <= $${idx}::timestamptz`);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function buildSemicolonCsv(headers, rows) {
  const lines = [headers.map((h) => escapeCsvCell(h, ';')).join(';')];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvCell(cell, ';')).join(';'));
  }
  return `\uFEFF${lines.join('\n')}`;
}

async function exportUnauthorizedLogsCsv({
  startDate,
  endDate,
  actorUserId,
  ipAddress = null,
  userAgent = null,
}) {
  const { whereSql, params } = buildDateFilter('created_at', { startDate, endDate });
  const res = await query(
    `SELECT id, user_id, user_email, resource, action, endpoint, ip_address, user_agent, created_at
     FROM unauthorized_access_log
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 5000`,
    params,
  );

  const csv = buildSemicolonCsv(
    ['ID', 'UserID', 'Email', 'Resource', 'Action', 'Endpoint', 'IP', 'UserAgent', 'CreatedAt'],
    res.rows.map((r) => [
      r.id,
      r.user_id || '',
      r.user_email || '',
      r.resource,
      r.action,
      r.endpoint || '',
      r.ip_address || '',
      r.user_agent || '',
      r.created_at ? new Date(r.created_at).toISOString() : '',
    ]),
  );

  await logAction({
    userId: actorUserId,
    action: 'EXPORT',
    tableName: 'unauthorized_access_log',
    newValue: { format: 'CSV', rowCount: res.rows.length },
    ipAddress,
    userAgent,
  });

  return csv;
}

async function exportSecurityAlertsCsv({
  status,
  severity,
  actorUserId,
  ipAddress = null,
  userAgent = null,
}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (severity) {
    params.push(severity);
    conditions.push(`severity = $${params.length}`);
  }
  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT id, alert_type, severity, status, user_email, ip_address, message, created_at, resolved_at
     FROM security_alerts
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 5000`,
    params,
  );

  const csv = buildSemicolonCsv(
    ['ID', 'AlertType', 'Severity', 'Status', 'UserEmail', 'IP', 'Message', 'CreatedAt', 'ResolvedAt'],
    res.rows.map((r) => [
      r.id,
      r.alert_type,
      r.severity,
      r.status,
      r.user_email || '',
      r.ip_address || '',
      r.message,
      r.created_at ? new Date(r.created_at).toISOString() : '',
      r.resolved_at ? new Date(r.resolved_at).toISOString() : '',
    ]),
  );

  await logAction({
    userId: actorUserId,
    action: 'EXPORT',
    tableName: 'security_alerts',
    newValue: { format: 'CSV', rowCount: res.rows.length },
    ipAddress,
    userAgent,
  });

  return csv;
}

function renderPdfBuffer(rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('HR Hunter — Relatório de Tentativas de Acesso Não Autorizado', {
      align: 'left',
    });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Gerado em: ${new Date().toISOString()} • Total de registros: ${rows.length}`);
    doc.moveDown(1);

    if (rows.length === 0) {
      doc.fontSize(11).text('Nenhum registro encontrado para o período informado.');
    } else {
      for (const row of rows.slice(0, 200)) {
        const ts = row.created_at ? new Date(row.created_at).toISOString() : '-';
        doc
          .fontSize(9)
          .text(
            `[#${row.id}] ${ts} | ${row.user_email || 'anonymous'} | ${row.resource}:${row.action} | ${row.endpoint || '-'} | IP: ${row.ip_address || '-'}`,
          );
        doc.moveDown(0.35);
      }
    }

    doc.end();
  });
}

async function exportUnauthorizedLogsPdf({
  startDate,
  endDate,
  actorUserId,
  ipAddress = null,
  userAgent = null,
}) {
  const { whereSql, params } = buildDateFilter('created_at', { startDate, endDate });
  const res = await query(
    `SELECT id, user_email, resource, action, endpoint, ip_address, created_at
     FROM unauthorized_access_log
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 1000`,
    params,
  );

  const buffer = await renderPdfBuffer(res.rows);

  await logAction({
    userId: actorUserId,
    action: 'EXPORT',
    tableName: 'unauthorized_access_log',
    newValue: { format: 'PDF', rowCount: res.rows.length },
    ipAddress,
    userAgent,
  });

  return buffer;
}

module.exports = {
  buildSemicolonCsv,
  exportUnauthorizedLogsCsv,
  exportSecurityAlertsCsv,
  exportUnauthorizedLogsPdf,
};
