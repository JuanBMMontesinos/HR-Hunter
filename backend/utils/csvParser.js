/**
 * Lightweight RFC-4180 style CSV parser supporting UTF-8 BOM, auto-detected
 * comma (,) or semicolon (;) delimiters, quoted values, and escaped quotes ("").
 */

function detectDelimiter(headerLine) {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;

  for (let i = 0; i < headerLine.length; i += 1) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ';') semicolons += 1;
      if (ch === ',') commas += 1;
    }
  }

  return semicolons > commas ? ';' : ',';
}

function splitCsvLines(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      current += ch;
      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (ch === '\r' || ch === '\n')) {
      if (ch === '\r' && next === '\n') i += 1;
      if (current.trim().length > 0) rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) rows.push(current);
  return rows;
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const lines = splitCsvLines(cleaned);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());

  const records = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i], delimiter);
    const row = { _rowNumber: i + 1 };
    headers.forEach((header, idx) => {
      if (header) row[header] = values[idx] !== undefined ? values[idx] : '';
    });
    records.push(row);
  }

  return records;
}

module.exports = {
  detectDelimiter,
  parseCsvLine,
  parseCsvText,
};
