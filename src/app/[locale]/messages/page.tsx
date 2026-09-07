import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {ChatInbox} from '@/modules/chat/ui/chat-inbox';

export default async function MessagesPage({
  params,
  searchParams
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<{conversation?: string}>;
}) {
  const [{locale}, query, t] = await Promise.all([params, searchParams, getTranslations('chat')]);
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
      <ChatInbox
        locale={locale}
        {...(query.conversation ? {initialConversationId: query.conversation} : {})}
        labels={{
          loading: t('loading'),
          authTitle: t('authTitle'),
          authText: t('authText'),
          error: t('error'),
          empty: t('empty'),
          listing: t('listing'),
          unread: t('unread'),
          me: t('me'),
          loadOlder: t('loadOlder'),
          placeholder: t('placeholder'),
          send: t('send'),
          sending: t('sending'),
          rateLimit: t('rateLimit'),
          unavailable: t('unavailable'),
          block: t('block'),
          unblock: t('unblock'),
          blockedByYou: t('blockedByYou'),
          blockedByOther: t('blockedByOther'),
          safety: t('safety')
        }}
      />
    </main>
  );
}
