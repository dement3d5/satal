import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {ListingCreation} from '@/modules/listings/ui/listing-creation';

export default async function SellPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const {locale} = await params;
  const home = await getTranslations('home');

  return (
    <main className="page-shell sell-page">
      <SiteHeader
        locale={locale}
        languageLabel={home('languageNavigation')}
        sellLabel={home('sellAction')}
        accountLabel={home('accountLink')}
      />
      <ListingCreation />
    </main>
  );
}
