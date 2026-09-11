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
          riskBands: {
            low: t('riskBands.low'),
            medium: t('riskBands.medium'),
            high: t('riskBands.high')
          },
          riskPolicy: t('riskPolicy'),
          riskSignalsTitle: t('riskSignalsTitle'),
          riskSignals: {
            new_account: t('riskSignals.newAccount'),
            contact_details_in_content: t('riskSignals.contactDetailsInContent')
          },
          operationsTitle: t('operationsTitle'),
          operationsError: t('operationsError'),
          operationsWindows: {
            7: t('operationsWindow', {days: 7}),
            30: t('operationsWindow', {days: 30})
          },
          openWorkTitle: t('openWorkTitle'),
          decisionsTitle: t('decisionsTitle'),
          recentActionsTitle: t('recentActionsTitle'),
          recentActionsEmpty: t('recentActionsEmpty'),
          metricLabels: {
            listings: t('metrics.listings'),
            listingReports: t('metrics.listingReports'),
            appeals: t('metrics.appeals'),
            messageReports: t('metrics.messageReports'),
            reviewReports: t('metrics.reviewReports'),
            listingsApproved: t('metrics.listingsApproved'),
            listingsRejected: t('metrics.listingsRejected'),
            listingReportsDismissed: t('metrics.listingReportsDismissed'),
            listingsRemoved: t('metrics.listingsRemoved'),
            appealsAccepted: t('metrics.appealsAccepted'),
            appealsRejected: t('metrics.appealsRejected'),
            messageReportsDismissed: t('metrics.messageReportsDismissed'),
            conversationsClosed: t('metrics.conversationsClosed'),
            reviewReportsDismissed: t('metrics.reviewReportsDismissed'),
            reviewsHidden: t('metrics.reviewsHidden')
          },
          actionLabels: {
            'listing.approve': t('actions.listingApproved'),
            'listing.reject': t('actions.listingRejected'),
            'listing_report.dismiss': t('actions.listingReportDismissed'),
            'listing_report.remove_listing': t('actions.listingRemoved'),
            'listing_appeal.accept': t('actions.appealAccepted'),
            'listing_appeal.reject': t('actions.appealRejected'),
            'message_report.dismiss': t('actions.messageReportDismissed'),
            'message_report.close_conversation': t('actions.conversationClosed'),
            'review_report.dismiss': t('actions.reviewReportDismissed'),
            'review_report.hide_review': t('actions.reviewHidden')
          },
          newListingsTitle: t('newListingsTitle'),
          newListingsEmpty: t('newListingsEmpty'),
          approve: t('approve'),
          approving: t('approving'),
          rejectTitle: t('rejectTitle'),
          reason: t('reason'),
          explanation: t('explanation'),
          explanationHint: t('explanationHint'),
          reject: t('reject'),
          rejecting: t('rejecting'),
          reportsTitle: t('reportsTitle'),
          reportsEmpty: t('reportsEmpty'),
          reportDetails: t('reportDetails'),
          reportDismiss: t('reportDismiss'),
          reportRemoveTitle: t('reportRemoveTitle'),
          reportRemove: t('reportRemove'),
          messageReportsTitle: t('messageReportsTitle'),
          messageReportsEmpty: t('messageReportsEmpty'),
          messageReportSender: t('messageReportSender'),
          messageReportContent: t('messageReportContent'),
          messageReportDetails: t('messageReportDetails'),
          messageReportDismiss: t('messageReportDismiss'),
          messageReportCloseTitle: t('messageReportCloseTitle'),
          messageReportClose: t('messageReportClose'),
          reviewReportsTitle: t('reviewReportsTitle'),
          reviewReportsEmpty: t('reviewReportsEmpty'),
          reviewReportAuthor: t('reviewReportAuthor'),
          reviewReportSubject: t('reviewReportSubject'),
          reviewReportContent: t('reviewReportContent'),
          reviewReportDetails: t('reviewReportDetails'),
          reviewReportDismiss: t('reviewReportDismiss'),
          reviewReportHideTitle: t('reviewReportHideTitle'),
          reviewReportHide: t('reviewReportHide'),
          appealsTitle: t('appealsTitle'),
          appealsEmpty: t('appealsEmpty'),
          appealOriginalDecision: t('appealOriginalDecision'),
          appealStatement: t('appealStatement'),
          appealAccept: t('appealAccept'),
          appealRejectTitle: t('appealRejectTitle'),
          appealResponse: t('appealResponse'),
          appealResponseHint: t('appealResponseHint'),
          appealReject: t('appealReject'),
          actionAuth: t('actionAuth'),
          actionForbidden: t('actionForbidden'),
          actionConflict: t('actionConflict'),
          actionError: t('actionError'),
          reasons: {
            prohibited_item: t('reasons.prohibitedItem'),
            fraud_risk: t('reasons.fraudRisk'),
            duplicate: t('reasons.duplicate'),
            wrong_category: t('reasons.wrongCategory'),
            insufficient_information: t('reasons.insufficientInformation'),
            policy_other: t('reasons.other')
          },
          reportReasons: {
            fraud: t('reportReasons.fraud'),
            wrong_category: t('reportReasons.wrongCategory'),
            prohibited_item: t('reportReasons.prohibitedItem'),
            duplicate: t('reportReasons.duplicate'),
            misleading_price: t('reportReasons.misleadingPrice'),
            stale_listing: t('reportReasons.staleListing'),
            other: t('reportReasons.other')
          },
          messageReportReasons: {
            spam: t('messageReportReasons.spam'),
            fraud: t('messageReportReasons.fraud'),
            harassment: t('messageReportReasons.harassment'),
            prohibited_content: t('messageReportReasons.prohibitedContent'),
            personal_data: t('messageReportReasons.personalData'),
            other: t('messageReportReasons.other')
          },
          reviewReportReasons: {
            spam: t('reviewReportReasons.spam'),
            harassment: t('reviewReportReasons.harassment'),
            personal_data: t('reviewReportReasons.personalData'),
            irrelevant: t('reviewReportReasons.irrelevant'),
            prohibited_content: t('reviewReportReasons.prohibitedContent'),
            other: t('reviewReportReasons.other')
          }
        }}
      />
    </main>
  );
}
