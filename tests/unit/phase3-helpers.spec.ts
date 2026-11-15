import { test, expect } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseCsvText } = require('../../backend/utils/csvParser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parsePagination,
  buildPaginatedResult,
  SqlFilterBuilder,
  buildDynamicUpdate,
  handlePgError,
} = require('../../backend/utils/queryHelpers');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderTemplate, sanitizeHtml } = require('../../backend/utils/sanitizer');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createJobOpeningSchema } = require('../../backend/validators/jobOpeningValidator');

test.describe('Backend Unit — Phase 3 Helpers (CSV, Pagination, Filters, Templates, Validators)', () => {
  test('parseCsvText handles UTF-8 BOM, semicolon delimiter, quoted commas and empty input', () => {
    const csv =
      '\uFEFFfullName;email;desiredPosition;notes\r\n' +
      '"Ana Clara; Silva";ana@example.com;Tech Lead;"Escaped ""quote"" test"\r\n' +
      'Bruno Costa;bruno@example.com;Backend;Sem observacoes';

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].fullName).toBe('Ana Clara; Silva');
    expect(rows[0].email).toBe('ana@example.com');
    expect(rows[0].notes).toBe('Escaped "quote" test');
    expect(rows[1].desiredPosition).toBe('Backend');
    expect(parseCsvText('')).toEqual([]);
  });

  test('queryHelpers caps pagination cleanly, builds parameterized filters and dynamic SQL updates', () => {
    const paged = parsePagination({ page: 2, limit: 99 }, { defaultLimit: 20, maxLimit: 20 });
    expect(paged).toEqual({ page: 2, limit: 20, offset: 20 });

    const summary = buildPaginatedResult({ items: [1, 2], total: 45, page: 1, limit: 20 });
    expect(summary.totalPages).toBe(3);

    const fb = new SqlFilterBuilder();
    fb.addEq('status', 'Ativo')
      .addIlikeAny(['legal_name', 'trade_name'], 'Tech')
      .addEq('ignored', '');
    expect(fb.whereClause()).toBe('WHERE status = $1 AND (legal_name ILIKE $2 OR trade_name ILIKE $2)');
    expect(fb.params).toEqual(['Ativo', '%Tech%']);

    const upd = buildDynamicUpdate(
      { legalName: 'Acme SA', tradeName: '   ' },
      { legalName: 'legal_name', tradeName: { column: 'trade_name', transform: (v: string) => v.trim() || null } },
    );
    expect(upd.sets).toEqual(['legal_name = $1', 'trade_name = $2']);
    expect(upd.values).toEqual(['Acme SA', null]);

    expect(() =>
      handlePgError({ code: '23505', constraint: 'companies_cnpj_key' }, {
        companies_cnpj_key: { message: 'CNPJ duplicado', statusCode: 409, errorCode: 'VAL_003' },
      }),
    ).toThrow('CNPJ duplicado');
  });

  test('renderTemplate escapes HTML variables against XSS inside sanitized templates', () => {
    const rawHtml = '<p>Olá {{candidateName}}, <script>alert(1)</script>vaga {{jobTitle}}</p>';
    const rendered = renderTemplate(rawHtml, {
      candidateName: '<img src=x onerror=alert(2)>Maria',
      jobTitle: 'Dev Senior',
    });
    expect(rendered).toContain('&lt;img src=x onerror=alert(2)&gt;Maria');
    expect(rendered).toContain('Dev Senior');
    expect(rendered).not.toContain('<script>');
    expect(rendered).not.toContain('alert(1)');
  });

  test('createJobOpeningSchema normalizes salaryMin/salaryMax aliases and rejects invalid range', () => {
    const ok = createJobOpeningSchema.validate({
      companyId: 1,
      title: 'Engenheiro de Software',
      salaryMin: 8000,
      salaryMax: 12000,
    });
    expect(ok.error).toBeUndefined();
    expect(ok.value.minSalary).toBe(8000);
    expect(ok.value.maxSalary).toBe(12000);
    expect(ok.value.salaryMin).toBeUndefined();

    const invalid = createJobOpeningSchema.validate({
      companyId: 1,
      title: 'Engenheiro de Software',
      salaryMin: 15000,
      minSalary: undefined,
      salaryMax: 9000,
    });
    expect(invalid.error).toBeTruthy();
  });
});
