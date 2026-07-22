import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_STOREFRONT_SUBDOMAINS } from './storefrontSubdomains';

// The reserved-slug word list is maintained by hand in three places that
// cannot share a single import at build time: this frontend TS module,
// is_reserved_store_slug() in the SQL migration (Postgres — the real,
// enforced authority; see 097_store_slug_availability.sql), and
// RESERVED_STORE_SLUGS in the create-store-with-owner Deno Edge
// Function. Nothing stops a future edit to one from forgetting the
// other two. Rather than trying to import TypeScript into Postgres (or
// vice versa) — which no tool here supports and would be its own new
// source of fragility — this test reads the other two files as plain
// text and extracts their literal word list with a regex, entirely
// within the existing Vitest run. It proves parity at test time without
// changing what's authoritative at runtime: the SQL migration remains
// the actual enforced rule; this only catches the three copies drifting
// apart before that ships.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function extractQuotedWords(source: string, pattern: RegExp, label: string): string[] {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Could not find the reserved-word list in ${label} — has its shape changed?`);
  }
  return match[1]
    .split(',')
    .map((entry) => entry.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
    .sort();
}

function readReservedWordsFromSql(): string[] {
  const sql = readFileSync(
    resolve(repoRoot, 'supabase/migrations/097_store_slug_availability.sql'),
    'utf-8',
  );
  return extractQuotedWords(
    sql,
    /select lower\(p_slug\) = any \(array\[([\s\S]*?)\]\)/,
    'is_reserved_store_slug() (097_store_slug_availability.sql)',
  );
}

function readReservedWordsFromEdgeFunction(): string[] {
  const source = readFileSync(
    resolve(repoRoot, 'supabase/functions/create-store-with-owner/index.ts'),
    'utf-8',
  );
  return extractQuotedWords(
    source,
    /RESERVED_STORE_SLUGS = new Set\(\[([\s\S]*?)\]\);/,
    'RESERVED_STORE_SLUGS (create-store-with-owner/index.ts)',
  );
}

describe('reserved store slug list — parity across all three copies', () => {
  const frontendWords = [...RESERVED_STOREFRONT_SUBDOMAINS].sort();
  const sqlWords = readReservedWordsFromSql();
  const edgeFunctionWords = readReservedWordsFromEdgeFunction();

  it('frontend and SQL (the enforced authority) list exactly the same words', () => {
    expect(frontendWords).toEqual(sqlWords);
  });

  it('frontend and the create-store-with-owner Edge Function list exactly the same words', () => {
    expect(frontendWords).toEqual(edgeFunctionWords);
  });

  it('none of the three copies is accidentally empty (a parser regression would show as a false pass above)', () => {
    expect(frontendWords.length).toBeGreaterThan(20);
    expect(sqlWords.length).toBeGreaterThan(20);
    expect(edgeFunctionWords.length).toBeGreaterThan(20);
  });
});
