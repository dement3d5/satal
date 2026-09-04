import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {AccountPanel} from '@/modules/identity/ui/account-panel';

export default async function AccountPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const [{locale}, t] = await Promise.all([params, getTranslations('account')]);
  return (
    <main className="page-shell identity-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        accountLabel={t('title')}
      />
      <header className="search-page-heading">
        <p className="eyebrow">SATAL ID</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <AccountPanel
        locale={locale}
        labels={{
          loading: t('loading'),
          signIn: t('signIn'),
          error: t('error'),
          name: t('name'),
          email: t('email'),
          phone: t('phone'),
          verified: t('verified'),
          emailUnverified: t('emailUnverified'),
          phoneUnverified: t('phoneUnverified'),
          notAdded: t('notAdded'),
          save: t('save'),
          saved: t('saved'),
          saveError: t('saveError'),
          signOut: t('signOut')
        }}
      />
    </main>
  );
}
