/**
 * Sanitizes plain-text or rich HTML strings against XSS payloads and protects
 * exported CSV cells from spreadsheet formula injection.
 */

const DANGEROUS_BLOCK_REGEX = /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_TAG_REGEX = /<\s*\/?\s*(script|iframe|object|embed|form|style|link|meta)[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URI_REGEX = /(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\2/gi;

function sanitizeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(DANGEROUS_BLOCK_REGEX, '')
    .replace(DANGEROUS_TAG_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .replace(JS_URI_REGEX, '$1=$2#$2')
    .trim();
}

function stripHtmlTags(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeCsvCell(value, delimiter = ';') {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Guard against Excel/Sheets formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  const mustQuote =
    text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r');
  if (mustQuote) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtmlText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplate(template, variables = {}) {
  if (!template) return '';
  const cleanTemplate = sanitizeHtml(template);
  return cleanTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : '';
    return escapeHtmlText(val);
  });
}

module.exports = {
  sanitizeHtml,
  stripHtmlTags,
  escapeCsvCell,
  escapeHtmlText,
  renderTemplate,
};
