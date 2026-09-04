import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {AuthForm} from '@/modules/identity/ui/auth-form';

export default async function AuthPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const [{locale}, t] = await Promise.all([params, getTranslations('auth')]);
  return (
    <main className="page-shell identity-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        accountLabel={t('accountLink')}
      />
      <header className="search-page-heading">
        <p className="eyebrow">SATAL ID</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <AuthForm
        locale={locale}
        labels={{
          signIn: t('signIn'),
          signUp: t('signUp'),
          name: t('name'),
          email: t('email'),
          password: t('password'),
          passwordHint: t('passwordHint'),
          submitSignIn: t('submitSignIn'),
          submitSignUp: t('submitSignUp'),
          pending: t('pending'),
          invalid: t('invalid'),
          duplicate: t('duplicate'),
          genericError: t('genericError'),
          phoneTitle: t('phoneTitle'),
          phoneUnavailable: t('phoneUnavailable')
        }}
      />
    </main>
  );
}
