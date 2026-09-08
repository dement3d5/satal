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
          overview: t('overview'),
          memberSince: t.raw('memberSince') as string,
          publicProfile: t('publicProfile'),
          createListing: t('createListing'),
          totalListings: t('totalListings'),
          activeListings: t('activeListings'),
          reviewingListings: t('reviewingListings'),
          rating: t('rating'),
          noRating: t('noRating'),
          reviews: t('reviews'),
          quickActions: t('quickActions'),
          messages: t('messages'),
          saved: t('saved'),
          notifications: t('notifications'),
          personalDetails: t('personalDetails'),
          personalDetailsHint: t('personalDetailsHint'),
          name: t('name'),
          email: t('email'),
          phone: t('phone'),
          verified: t('verified'),
          emailUnverified: t('emailUnverified'),
          phoneUnverified: t('phoneUnverified'),
          notAdded: t('notAdded'),
          save: t('save'),
          savedMessage: t('savedMessage'),
          saveError: t('saveError'),
          security: t('security'),
          securityHint: t('securityHint'),
          currentSession: t('currentSession'),
          signOut: t('signOut'),
          switchAccount: t('switchAccount'),
          signingOut: t('signingOut'),
          signOutError: t('signOutError'),
          staffAccess: t('staffAccess'),
          moderation: t('moderation'),
          roleLabels: {
            moderator: t('roles.moderator'),
            admin: t('roles.admin'),
            owner: t('roles.owner')
          },
          listingsTitle: t('listingsTitle'),
          listingsEmpty: t('listingsEmpty'),
          listingOpen: t('listingOpen'),
          appealAction: t('appealAction'),
          appealTitle: t('appealTitle'),
          appealHint: t('appealHint'),
          appealSubmit: t('appealSubmit'),
          appealSubmitting: t('appealSubmitting'),
          appealOpen: t('appealOpen'),
          appealAccepted: t('appealAccepted'),
          appealRejected: t('appealRejected'),
          appealResponse: t('appealResponse'),
          appealError: t('appealError'),
          statuses: {
            pending_review: t('statuses.pendingReview'),
            active: t('statuses.active'),
            sold: t('statuses.sold'),
            expired: t('statuses.expired'),
            removed: t('statuses.removed'),
            rejected: t('statuses.rejected')
          }
        }}
      />
    </main>
  );
}
