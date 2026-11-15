const { AppError, ErrorCodes } = require('./errorCodes');

function parsePagination({ page = 1, limit = 20 } = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const numericLimit = Number(limit);
  const safeLimit = Number.isFinite(numericLimit) && numericLimit > 0
    ? Math.min(Math.floor(numericLimit), maxLimit)
    : Math.min(defaultLimit, maxLimit);
  const numericPage = Number(page);
  const safePage = Number.isFinite(numericPage) && numericPage > 0 ? Math.floor(numericPage) : 1;
  const offset = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, offset };
}

function buildPaginatedResult({ items, total, page, limit }) {
  const safeTotal = Number(total || 0);
  return {
    items,
    total: safeTotal,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(safeTotal / limit)),
  };
}

function parsePositiveInt(value, label = 'ID') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${label} inválido.`, 400, ErrorCodes.VALIDATION_ERROR);
  }
  return parsed;
}

class SqlFilterBuilder {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  addRaw(sql, ...values) {
    const mappedValues = values.map((val) => {
      this.params.push(val);
      return `$${this.params.length}`;
    });
    let index = 0;
    const formatted = sql.replace(/\?/g, () => mappedValues[index++]);
    this.clauses.push(formatted);
    return this;
  }

  addEq(column, value) {
    if (value === undefined || value === null || value === '') return this;
    this.params.push(value);
    this.clauses.push(`${column} = $${this.params.length}`);
    return this;
  }

  addBool(column, value) {
    if (value === undefined || value === null || value === '') return this;
    const boolVal = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
    this.params.push(boolVal);
    this.clauses.push(`${column} = $${this.params.length}`);
    return this;
  }

  addIlikeAny(columns, term) {
    if (term === undefined || term === null || String(term).trim() === '') return this;
    this.params.push(`%${String(term).trim()}%`);
    const placeholder = `$${this.params.length}`;
    const orParts = columns.map((col) => `${col} ILIKE ${placeholder}`);
    this.clauses.push(`(${orParts.join(' OR ')})`);
    return this;
  }

  addDateRange(column, startDate, endDate) {
    if (startDate) {
      this.params.push(startDate);
      this.clauses.push(`${column} >= $${this.params.length}`);
    }
    if (endDate) {
      this.params.push(endDate);
      this.clauses.push(`${column} <= $${this.params.length}`);
    }
    return this;
  }

  whereClause() {
    return this.clauses.length > 0 ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }

  nextIndex(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

function handlePgError(err, constraintMap = {}) {
  if (err instanceof AppError) throw err;

  if (err && err.code === '23505') {
    const mapped = constraintMap[err.constraint];
    if (mapped) {
      throw new AppError(mapped.message, mapped.statusCode || 409, mapped.errorCode || ErrorCodes.RESOURCE_CONFLICT);
    }
    throw new AppError('Registro duplicado viola restrição de unicidade.', 409, ErrorCodes.RESOURCE_CONFLICT);
  }

  if (err && err.code === '23503') {
    const mapped = constraintMap[err.constraint];
    if (mapped) {
      throw new AppError(mapped.message, mapped.statusCode || 400, mapped.errorCode || ErrorCodes.VALIDATION_ERROR);
    }
    throw new AppError('Referência inválida ou registro ainda possui vínculos ativos.', 409, ErrorCodes.RESOURCE_CONFLICT);
  }

  if (err && err.code === '23514') {
    throw new AppError('Valor informado viola restrição de domínio.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (err && err.code === 'P0001') {
    throw new AppError(err.message, 409, ErrorCodes.RESOURCE_CONFLICT);
  }

  throw err;
}

function buildDynamicUpdate(payload, fieldColumnMap) {
  const sets = [];
  const values = [];
  for (const [dtoKey, spec] of Object.entries(fieldColumnMap)) {
    if (!Object.prototype.hasOwnProperty.call(payload, dtoKey)) continue;
    const column = typeof spec === 'string' ? spec : spec.column;
    const transform = typeof spec === 'object' && typeof spec.transform === 'function' ? spec.transform : (v) => v;
    values.push(transform(payload[dtoKey]));
    sets.push(`${column} = $${values.length}`);
  }
  return { sets, values };
}

module.exports = {
  parsePagination,
  buildPaginatedResult,
  parsePositiveInt,
  SqlFilterBuilder,
  handlePgError,
  buildDynamicUpdate,
};
