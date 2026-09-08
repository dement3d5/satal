import {routing, type AppLocale} from './routing';

export function localizePathname(pathname: string, locale: AppLocale): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = normalized.split('/');
  if (routing.locales.includes(segments[1] as AppLocale)) {
    segments[1] = locale;
    return segments.join('/') || `/${locale}`;
  }
  return `/${locale}${normalized === '/' ? '' : normalized}`;
}
