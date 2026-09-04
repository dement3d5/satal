import type {AppLocale} from '@/i18n/routing';

export function formatPrice(
  priceMinor: number | null,
  currency: string,
  locale: AppLocale,
  fallback: string
): string {
  if (priceMinor === null) return fallback;
  return new Intl.NumberFormat(locale === 'az' ? 'az-AZ' : locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: priceMinor % 100 === 0 ? 0 : 2
  }).format(priceMinor / 100);
}
