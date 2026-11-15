#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function walkJs(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJs(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

function checkSyntax() {
  const files = [
    ...walkJs(path.join(ROOT, 'backend')),
    ...walkJs(path.join(ROOT, 'database')),
    ...walkJs(path.join(ROOT, 'scripts')),
  ];
  for (const file of files) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
  console.log(`[verify:syntax] OK (${files.length} JS files verified)`);
}

function checkSql() {
  const migDir = path.join(ROOT, 'database', 'migrations');
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error('[verify:sql] No .sql migrations found');
  }

  const forbidden = [
    { name: 'MSSQL GO batch separator', regex: /^\s*GO\s*;?\s*$/im },
    { name: 'MSSQL IDENTITY(1,1)', regex: /\bIDENTITY\s*\(\s*1\s*,\s*1\s*\)/i },
    { name: 'MSSQL NVARCHAR', regex: /\bNVARCHAR\b/i },
    { name: 'MSSQL GETDATE()', regex: /\bGETDATE\s*\(\s*\)/i },
  ];

  files.forEach((file, index) => {
    const expectedPrefix = String(index + 1).padStart(3, '0');
    if (!file.startsWith(expectedPrefix)) {
      throw new Error(`[verify:sql] Expected migration ${index + 1} to start with ${expectedPrefix}, got ${file}`);
    }
    const content = fs.readFileSync(path.join(migDir, file), 'utf8').trim();
    if (!content) {
      throw new Error(`[verify:sql] Empty migration file: ${file}`);
    }
    for (const rule of forbidden) {
      if (rule.regex.test(content)) {
        throw new Error(`[verify:sql] Forbidden pattern (${rule.name}) found in ${file}`);
      }
    }
  });

  console.log(`[verify:sql] OK (${files.length} PostgreSQL migrations verified)`);
}

function checkSecurity() {
  let tracked = [];
  try {
    const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
    tracked = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    throw new Error('[verify:security] git ls-files failed');
  }

  const forbiddenFiles = tracked.filter((f) => {
    const base = path.basename(f);
    if (base === '.env.example') return false;
    return base === '.env' || base.startsWith('.env.') || /\.(pem|key)$/i.test(base);
  });
  if (forbiddenFiles.length > 0) {
    throw new Error(`[verify:security] Forbidden tracked files: ${forbiddenFiles.join(', ')}`);
  }

  const privateKeyMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const dbUriRx = /postgresql:\/\/postgres:([^@\s'"\]]+)@db\.[a-z0-9]+\.supabase\.co/gi;
  const jwtAssignRx = /(?:SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|JWT_REFRESH_SECRET)\s*=\s*['"]?eyJ[A-Za-z0-9_-]{25,}/i;
  const placeholderValues = new Set(['[DB_PASSWORD]', 'password', 'placeholder', 'replace_me', 'test']);

  const hits = [];
  for (const rel of tracked) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    if (/\.(png|jpe?g|webp|gif|ico|pdf|woff2?)$/i.test(rel)) continue;
    const content = fs.readFileSync(abs, 'utf8');

    if (rel !== 'scripts/verify.js' && content.includes(privateKeyMarker)) {
      hits.push(`${rel}: private key block`);
    }
    if (jwtAssignRx.test(content)) {
      hits.push(`${rel}: hardcoded JWT/service key assignment`);
    }
    for (const match of content.matchAll(dbUriRx)) {
      const pw = match[1];
      if (!placeholderValues.has(pw) && !pw.startsWith('${')) {
        hits.push(`${rel}: literal PostgreSQL URI credential`);
      }
    }
  }

  if (hits.length > 0) {
    throw new Error(`[verify:security] Potential secrets detected:\n - ${hits.join('\n - ')}`);
  }

  console.log(`[verify:security] OK (${tracked.length} tracked files scanned, 0 secret leaks)`);
}

function checkDocs() {
  const docsDir = path.join(ROOT, 'docs');
  const mdFiles = [
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'CHANGELOG.md'),
    ...fs
      .readdirSync(docsDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => path.join(docsDir, f)),
  ];

  const broken = [];
  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)#?\s]+)(?:#[^)]+)?\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|file:)/i.test(target)) continue;
      const resolved = path.resolve(dir, target);
      if (!fs.existsSync(resolved)) {
        broken.push(`${path.relative(ROOT, file)} -> ${target}`);
      }
    }
  }

  if (broken.length > 0) {
    throw new Error(`[verify:docs] Broken relative links:\n - ${broken.join('\n - ')}`);
  }

  console.log(`[verify:docs] OK (${mdFiles.length} Markdown files checked, 0 broken links)`);
}

function checkSwagger() {
  const swaggerSpec = require(path.join(ROOT, 'backend', 'config', 'swagger'));
  const paths = Object.keys(swaggerSpec.paths || {});
  let operations = 0;
  for (const p of paths) {
    for (const m of Object.keys(swaggerSpec.paths[p])) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) operations += 1;
    }
  }

  if (swaggerSpec.openapi !== '3.0.3' || paths.length < 68 || operations < 95) {
    throw new Error(
      `[verify:swagger] Unexpected OpenAPI metrics: openapi=${swaggerSpec.openapi}, paths=${paths.length}, ops=${operations}`,
    );
  }

  console.log(`[verify:swagger] OK (OpenAPI ${swaggerSpec.openapi}, ${paths.length} paths, ${operations} operations)`);
}

const args = new Set(process.argv.slice(2));
const runAll = args.size === 0 || args.has('--all');

try {
  if (runAll || args.has('--syntax')) checkSyntax();
  if (runAll || args.has('--sql')) checkSql();
  if (runAll || args.has('--security')) checkSecurity();
  if (runAll || args.has('--docs')) checkDocs();
  if (runAll || args.has('--swagger')) checkSwagger();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
