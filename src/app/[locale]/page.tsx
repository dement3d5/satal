import {getTranslations} from 'next-intl/server';
import {Suspense} from 'react';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {PublicListingFeed, PublicListingFeedSkeleton} from '@/modules/listings/ui/public-listings';

export default async function HomePage({params}: {params: Promise<{locale: AppLocale}>}) {
  const {locale} = await params;
  const t = await getTranslations('home');

  return (
    <main className="page-shell home-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        accountLabel={t('accountLink')}
      />

      <Suspense fallback={<PublicListingFeedSkeleton />}>
        <PublicListingFeed locale={locale} />
      </Suspense>
    </main>
  );
}
