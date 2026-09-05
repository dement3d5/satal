import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {ModerationDashboard} from '@/modules/moderation/ui/moderation-dashboard';

export default async function ModerationPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const [{locale}, t] = await Promise.all([params, getTranslations('moderation')]);
  return (
    <main className="page-shell moderation-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        accountLabel={t('accountLink')}
      />
      <header className="search-page-heading">
        <p className="eyebrow">SATAL CONTROL</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <ModerationDashboard
        locale={locale}
        labels={{
          loading: t('loading'),
          auth: t('auth'),
          signIn: t('signIn'),
          forbidden: t('forbidden'),
          error: t('error'),
          empty: t('empty'),
          seller: t('seller'),
          risk: t('risk'),
          riskUnassessed: t('riskUnassessed'),
          approve: t('approve'),
          approving: t('approving'),
          rejectTitle: t('rejectTitle'),
          reason: t('reason'),
          explanation: t('explanation'),
          explanationHint: t('explanationHint'),
          reject: t('reject'),
          rejecting: t('rejecting'),
          actionError: t('actionError'),
          reasons: {
            prohibited_item: t('reasons.prohibitedItem'),
            fraud_risk: t('reasons.fraudRisk'),
            duplicate: t('reasons.duplicate'),
            wrong_category: t('reasons.wrongCategory'),
            insufficient_information: t('reasons.insufficientInformation'),
            policy_other: t('reasons.other')
          }
        }}
      />
    </main>
  );
}
