import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {NotificationCenter} from '@/modules/notifications/ui/notification-center';

export default async function NotificationsPage({params}: {params: Promise<{locale: AppLocale}>}) {
  const [{locale}, t] = await Promise.all([params, getTranslations('notifications')]);
  return (
    <main className="page-shell communication-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        accountLabel={t('accountLink')}
      />
      <header className="search-page-heading">
        <p className="eyebrow">SATAL</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <NotificationCenter
        locale={locale}
        labels={{
          loading: t('loading'),
          authTitle: t('authTitle'),
          authText: t('authText'),
          error: t('error'),
          empty: t('empty'),
          unreadCount: t('unreadCount'),
          chatMessage: t('chatMessage'),
          openConversation: t('openConversation'),
          markRead: t('markRead'),
          preferencesTitle: t('preferencesTitle'),
          inApp: t('inApp'),
          email: t('email'),
          push: t('push'),
          externalUnavailable: t('externalUnavailable'),
          preferenceError: t('preferenceError')
        }}
      />
    </main>
  );
}
