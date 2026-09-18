import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {ShopManager} from '@/modules/shops/ui/shop-manager';

export default async function ShopPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const [{locale}, t] = await Promise.all([params, getTranslations('shop')]);
  return (
    <main className="page-shell shop-page">
      <SiteHeader
        accountLabel={t('accountLink')}
        languageLabel={t('languageNavigation')}
        locale={locale}
        sellLabel={t('sellAction')}
      />
      <header className="shop-page-heading">
        <p className="eyebrow">SATAL BUSINESS</p>
        <h1>{t('title')}</h1>
        <p>{t('pageDescription')}</p>
      </header>
      <ShopManager />
    </main>
  );
}
