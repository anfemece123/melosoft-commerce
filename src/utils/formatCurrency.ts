export function formatCurrency(
  amount: number,
  locale = 'es-CO',
  currency = 'COP'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}
