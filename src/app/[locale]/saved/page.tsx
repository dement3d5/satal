import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {SavedDashboard} from '@/modules/engagement/ui/saved-dashboard';

export default async function SavedPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const [{locale}, t] = await Promise.all([params, getTranslations('saved')]);
  return (
    <main className="page-shell saved-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        savedLabel={t('title')}
        accountLabel={t('accountLink')}
      />
      <header className="search-page-heading">
        <p className="eyebrow">SATAL</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <SavedDashboard
        locale={locale}
        labels={{
          loading: t('loading'),
          authTitle: t('authTitle'),
          authText: t('authText'),
          error: t('error'),
          searchesTitle: t('searchesTitle'),
          searchesEmpty: t('searchesEmpty'),
          favoritesTitle: t('favoritesTitle'),
          favoritesEmpty: t('favoritesEmpty'),
          remove: t('remove'),
          priceOnRequest: t('priceOnRequest')
        }}
      />
    </main>
  );
}
