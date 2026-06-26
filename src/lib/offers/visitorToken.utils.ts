const STORAGE_KEY = 'msc_visitor_token';

export function getOrCreateVisitorToken(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.length >= 16) return stored;
  const token = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, token);
  return token;
}
