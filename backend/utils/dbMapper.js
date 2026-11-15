function snakeToCamel(key) {
  return String(key).replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function camelToSnake(key) {
  return String(key)
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
    .replace(/^_/, '');
}

function mapRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }
  const mapped = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[snakeToCamel(key)] = value;
  }
  return mapped;
}

function mapRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapRow);
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

module.exports = {
  snakeToCamel,
  camelToSnake,
  mapRow,
  mapRows,
  normalizeOptionalString,
};
