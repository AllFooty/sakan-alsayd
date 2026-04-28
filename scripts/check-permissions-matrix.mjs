// Drift guard for the read-only Roles & Permissions matrix.
//
// Verifies these invariants:
//   1. Every UserRole literal in src/lib/auth/types.ts is listed in ALL_ROLES.
//   2. Every group key, row key, scopeNoteKey, and noteKey has a matching
//      translation in BOTH en.json and ar.json.
//   3. Every UserRole has an `admin.topbar.roles.<role>` translation in both
//      locales — the matrix renders these labels at runtime.
//   4. Every row's `source` citation points at a real file, AND when a line
//      range is given (`:N` or `:N-M`), the cited file has at least M lines.
//   5. Source citations under `src/app/api/` reference a file that calls
//      `authenticateApiRequest`, and citations under `supabase/migrations/`
//      end in `.sql`. Catches accidental redirects to a non-gate file.
//
// Run via `npm run check:permissions`.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const errors = [];
function fail(msg) {
  errors.push(msg);
}

function loadTranslations(file) {
  const raw = readFileSync(join(repoRoot, 'src', 'messages', file), 'utf8');
  return JSON.parse(raw);
}

function hasKey(obj, dottedPath) {
  const parts = dottedPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return false;
  }
  return typeof cur === 'string';
}

function extractUserRoleLiterals() {
  // The UserRole union is the canonical source of role identifiers; the
  // matrix-renderer cards/table iterate ALL_ROLES from permissions-matrix.ts
  // and must stay in sync. Currently declared in types.ts and re-exported
  // through providers.tsx — read types.ts directly so a re-export rename
  // doesn't silently break this check.
  const src = readFileSync(
    join(repoRoot, 'src', 'lib', 'auth', 'types.ts'),
    'utf8'
  );
  const match = src.match(/type\s+UserRole\s*=\s*([^;]+);/);
  if (!match) {
    fail('Could not locate UserRole type in src/lib/auth/types.ts');
    return [];
  }
  return Array.from(match[1].matchAll(/'([a-z_]+)'/g)).map((m) => m[1]);
}

function loadMatrixModule() {
  const src = readFileSync(
    join(repoRoot, 'src', 'lib', 'auth', 'permissions-matrix.ts'),
    'utf8'
  );
  const allRoles = Array.from(
    src
      .match(/ALL_ROLES[^=]*=\s*\[([^\]]+)\]/)?.[1]
      .matchAll(/'([a-z_]+)'/g) ?? []
  ).map((m) => m[1]);

  const groupKeys = Array.from(src.matchAll(/key:\s*'([a-z_]+)',\s*\n\s*rows:/g)).map(
    (m) => m[1]
  );

  const rowKeys = Array.from(
    src.matchAll(/key:\s*'([a-z_]+\.[a-zA-Z_]+)'/g)
  ).map((m) => m[1]);

  const scopeKeys = Array.from(
    src.matchAll(/scopeNoteKey:\s*'([a-zA-Z_]+)'/g)
  ).map((m) => m[1]);

  const noteKeys = Array.from(
    src.matchAll(/noteKey:\s*'([a-zA-Z_]+)'/g)
  ).map((m) => m[1]);

  // The bracket class must accept `]` inside quoted strings — citations like
  // `src/app/api/admin/users/[id]/route.ts` contain `]`, so a naive
  // `[^\]]+` body stops short. Allow either a quoted string or any non-bracket,
  // non-quote character to appear between the array delimiters.
  const sourceCitations = Array.from(
    src.matchAll(/source:\s*\[((?:'[^']*'|[^[\]'])+)\]/g)
  ).flatMap((m) =>
    Array.from(m[1].matchAll(/'([^']+)'/g)).map((c) => c[1])
  );

  return { allRoles, groupKeys, rowKeys, scopeKeys, noteKeys, sourceCitations };
}

const userRoles = extractUserRoleLiterals();
const { allRoles, groupKeys, rowKeys, scopeKeys, noteKeys, sourceCitations } =
  loadMatrixModule();

if (userRoles.length === 0) fail('UserRole literal extraction returned empty.');

for (const role of userRoles) {
  if (!allRoles.includes(role)) {
    fail(`ALL_ROLES is missing role '${role}' — defined in providers.tsx`);
  }
}
for (const role of allRoles) {
  if (!userRoles.includes(role)) {
    fail(`ALL_ROLES contains role '${role}' but it's not in the UserRole union`);
  }
}

const en = loadTranslations('en.json');
const ar = loadTranslations('ar.json');
const locales = [
  { name: 'en.json', data: en },
  { name: 'ar.json', data: ar },
];

for (const groupKey of groupKeys) {
  for (const file of locales) {
    if (!hasKey(file.data, `admin.rolesPermissions.groups.${groupKey}`)) {
      fail(`${file.name} missing key admin.rolesPermissions.groups.${groupKey}`);
    }
  }
}

for (const rowKey of rowKeys) {
  for (const file of locales) {
    if (!hasKey(file.data, `admin.rolesPermissions.permissions.${rowKey}`)) {
      fail(`${file.name} missing key admin.rolesPermissions.permissions.${rowKey}`);
    }
  }
}

for (const scopeKey of new Set(scopeKeys)) {
  for (const file of locales) {
    if (!hasKey(file.data, `admin.rolesPermissions.scope.${scopeKey}`)) {
      fail(`${file.name} missing key admin.rolesPermissions.scope.${scopeKey}`);
    }
  }
}

for (const noteKey of new Set(noteKeys)) {
  for (const file of locales) {
    if (!hasKey(file.data, `admin.rolesPermissions.notes.${noteKey}`)) {
      fail(`${file.name} missing key admin.rolesPermissions.notes.${noteKey}`);
    }
  }
}

// Every UserRole must have a topbar role label — the matrix renders tRoles(role)
// for every entry in ALL_ROLES at runtime.
for (const role of allRoles) {
  for (const file of locales) {
    if (!hasKey(file.data, `admin.topbar.roles.${role}`)) {
      fail(`${file.name} missing key admin.topbar.roles.${role}`);
    }
  }
}

const lineCountCache = new Map();
function fileLineCount(absPath) {
  if (lineCountCache.has(absPath)) return lineCountCache.get(absPath);
  const raw = readFileSync(absPath, 'utf8');
  // count newlines + 1 for the last line (if non-empty); good enough for a >= check
  const count = raw.split('\n').length;
  lineCountCache.set(absPath, count);
  return count;
}

const fileContentCache = new Map();
function fileContains(absPath, needle) {
  if (!fileContentCache.has(absPath)) {
    fileContentCache.set(absPath, readFileSync(absPath, 'utf8'));
  }
  return fileContentCache.get(absPath).includes(needle);
}

for (const citation of sourceCitations) {
  const [path, range] = citation.split(':');
  const abs = join(repoRoot, path);
  if (!existsSync(abs)) {
    fail(`Source citation references missing file: ${path}`);
    continue;
  }

  // Content-aware sanity checks: catches the case where a row's source was
  // updated to point at the wrong path (e.g. an unrelated component instead
  // of the API gate file, or a non-SQL file dropped into the migrations dir).
  if (path.startsWith('src/app/api/') && !fileContains(abs, 'authenticateApiRequest')) {
    fail(
      `Source citation ${path} points at an API file that doesn't call authenticateApiRequest — likely the wrong path`
    );
  }
  if (path.startsWith('supabase/migrations/') && !path.endsWith('.sql')) {
    fail(
      `Source citation ${path} is under supabase/migrations/ but isn't a .sql file`
    );
  }

  if (!range) continue;
  const parts = range.split('-').map((s) => parseInt(s, 10));
  const maxLine = parts.length === 2 ? parts[1] : parts[0];
  if (Number.isNaN(maxLine)) {
    fail(`Source citation has malformed line range: ${citation}`);
    continue;
  }
  const lineCount = fileLineCount(abs);
  if (maxLine > lineCount) {
    fail(
      `Source citation ${citation} points past end of file (${path} has ${lineCount} lines)`
    );
  }
}

if (errors.length > 0) {
  console.error('Permissions-matrix drift check failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `Permissions-matrix OK — ${allRoles.length} roles, ${groupKeys.length} groups, ${rowKeys.length} permission rows, ${new Set(scopeKeys).size} scope keys, ${new Set(noteKeys).size} note keys, ${sourceCitations.length} source citations verified.`
);
