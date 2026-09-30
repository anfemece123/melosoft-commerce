import { describe, expect, it } from 'vitest';
import catalog from './velaireCatalog.json';
import type { VelaireCatalogRow } from './velaireImport.types';
import { inferBrandFromProductName, normalizeVelaireBrand, rankVelaireBrands } from './velaireBrands';

describe('normalizeVelaireBrand', () => {
  it('maps sub-lines and old names to the house', () => {
    expect(normalizeVelaireBrand('Rave / Lattafa')).toBe('Lattafa');
    expect(normalizeVelaireBrand('Paco Rabanne')).toBe('Rabanne');
    expect(normalizeVelaireBrand('Orientica Premium')).toBe('Orientica');
  });

  it('keeps regular brands and drops unknown ones', () => {
    expect(normalizeVelaireBrand('Dolce & Gabbana')).toBe('Dolce & Gabbana');
    expect(normalizeVelaireBrand('Por confirmar')).toBeNull();
    expect(normalizeVelaireBrand('  ')).toBeNull();
  });
});

describe('rankVelaireBrands', () => {
  it('puts Lattafa first with every Lattafa reference, Rave included', () => {
    const ranked = rankVelaireBrands(catalog as VelaireCatalogRow[]);
    expect(ranked[0]).toEqual({ brand: 'Lattafa', count: 46 });
    expect(ranked.some((entry) => entry.brand === 'Rave / Lattafa' || entry.brand === 'Por confirmar')).toBe(false);
  });
});

describe('inferBrandFromProductName', () => {
  const brands = ['Paris Corner', 'Paris Hilton', 'Emper', 'Lattafa'];

  it('uses a brand the owner already put at the start of the name', () => {
    expect(inferBrandFromProductName('Emper Haya Crush', brands)).toBe('Emper');
    expect(inferBrandFromProductName('paris hilton Heiress', brands)).toBe('Paris Hilton');
  });

  it('does not guess from partial words', () => {
    expect(inferBrandFromProductName('Haya Crush', brands)).toBeNull();
    expect(inferBrandFromProductName('Emperador', brands)).toBeNull();
  });
});
