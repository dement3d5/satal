import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['az', 'ru', 'en'],
  defaultLocale: 'az',
  localePrefix: 'always'
});

export type AppLocale = (typeof routing.locales)[number];
