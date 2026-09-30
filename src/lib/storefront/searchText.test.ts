import { describe, expect, it } from 'vitest';
import { highlightSearchMatches, normalizeSearchText } from './searchText';

describe('normalizeSearchText', () => {
  it('matches the SQL normalizer rules', () => {
    expect(normalizeSearchText('  Perfumería  ')).toBe('perfumeria');
    expect(normalizeSearchText('Dolce & Gabbana')).toBe('dolce gabbana');
    expect(normalizeSearchText('Victoria’s Secret')).toBe('victorias secret');
    expect(normalizeSearchText('A.LAB')).toBe('alab');
  });
});

describe('highlightSearchMatches', () => {
  it('highlights every query word in any order, ignoring accents and case', () => {
    expect(highlightSearchMatches('Dolce & Gabbana Light Blue', 'blue dolce')).toEqual([
      { text: 'Dolce', match: true },
      { text: ' & Gabbana Light ', match: false },
      { text: 'Blue', match: true },
    ]);
    expect(highlightSearchMatches('Perfumería', 'RIA')).toEqual([
      { text: 'Perfume', match: false },
      { text: 'ría', match: true },
    ]);
  });

  it('returns the text untouched when nothing useful to highlight', () => {
    expect(highlightSearchMatches('Lattafa Asad', 'a')).toEqual([{ text: 'Lattafa Asad', match: false }]);
    expect(highlightSearchMatches('Lattafa Asad', 'latafa')).toEqual([{ text: 'Lattafa Asad', match: false }]);
  });
});
