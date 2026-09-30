/** Client mirror of `catalog_search_normalize` (migration 161): lower
 * case, no accents, apostrophes/dots dropped, anything else that isn't a
 * letter or digit becomes a single space. Used as the suggestions cache
 * key, so "Perfumería" and "perfumeria " share one request. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`´.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** Folds one character the same way as normalizeSearchText, keeping a
 * 1:1 length mapping with the original so match ranges can be applied
 * back to the text as written ("Perfumería" highlights "ría"). */
function foldChar(char: string): string {
  const folded = char.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return folded.length === 1 ? folded : char.toLowerCase();
}

/** Splits `text` into matched / unmatched segments for every query word
 * (accent and case insensitive). Words of one letter are ignored so a
 * stray "a" doesn't light up the whole name. */
export function highlightSearchMatches(text: string, query: string): HighlightSegment[] {
  const tokens = Array.from(new Set(normalizeSearchText(query).split(' ').filter((token) => token.length >= 2)));
  if (!text || tokens.length === 0) return [{ text, match: false }];

  const folded = Array.from(text).map(foldChar).join('');
  const chars = Array.from(text);
  if (folded.length !== chars.length) return [{ text, match: false }];

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    while (from <= folded.length - token.length) {
      const index = folded.indexOf(token, from);
      if (index === -1) break;
      for (let i = index; i < index + token.length; i++) marked[i] = true;
      from = index + token.length;
    }
  }

  const segments: HighlightSegment[] = [];
  for (let i = 0; i < chars.length; i++) {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[i]) last.text += chars[i];
    else segments.push({ text: chars[i], match: marked[i] });
  }
  return segments;
}
