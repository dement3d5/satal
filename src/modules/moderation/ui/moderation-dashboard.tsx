'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect, useRef, useState, type FormEvent} from 'react';

import {ImageGallery} from '@/components/image-gallery';
import {LocationMap} from '@/components/location-map';
import type {AppLocale} from '@/i18n/routing';
import {formatPrice} from '@/modules/listings/ui/format';

interface QueueItem {
  caseId: string;
  listingId: string;
  priority: number;
  riskBand: 'unassessed' | 'low' | 'medium' | 'high';
  policyVersion: string;
  signals: Array<{
    code: 'new_account' | 'contact_details_in_content';
    weight: number;
  }>;
  openedAt: string;
  assignedAt: string | null;
  assigneeName: string | null;
  isAssignedToActor: boolean;
  ageMinutes: number;
  slaState: 'within_target' | 'due_soon' | 'overdue';
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  sellerName: string;
  categoryName: string;
  locationName: string;
  mapLatitude: number | null;
  mapLongitude: number | null;
  publicLocationLabel: string | null;
  canOverrideAssignment: boolean;
  mediaUrls: string[];
  attributes: Array<{
    attributeId: string;
    label: string;
    value: string | number | boolean | string[];
    unit: string | null;
  }>;
}

interface ModerationOperations {
  generatedAt: string;
  windowDays: 7 | 30;
  queueCounts: Record<
    | 'listings'
    | 'assignedListings'
    | 'unassignedListings'
    | 'dueSoonListings'
    | 'overdueListings'
    | 'listingReports'
    | 'appeals'
    | 'messageReports'
    | 'reviewReports',
    number
  >;
  sla: {
    listingTargetHours: number;
    dueSoonAfterHours: number;
    oldestOpenMinutes: number;
  };
  decisionCounts: Record<
    | 'listingsApproved'
    | 'listingsRejected'
    | 'listingReportsDismissed'
    | 'listingsRemoved'
    | 'appealsAccepted'
    | 'appealsRejected'
    | 'messageReportsDismissed'
    | 'conversationsClosed'
    | 'reviewReportsDismissed'
    | 'reviewsHidden',
    number
  >;
  recentActions: Array<{
    id: string;
    entityType:
      | 'listing'
      | 'moderation_case'
      | 'listing_report'
      | 'listing_appeal'
      | 'message_report'
      | 'review_report';
    entityId: string;
    action: string;
    actorName: string;
    createdAt: string;
  }>;
  staffAccess: Array<{
    actorName: string;
    surface: 'queue' | 'operations';
    accessCount: number;
    lastAccessAt: string;
  }>;
}

interface ReportQueueItem {
  reportId: string;
  listingId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  title: string;
  sellerName: string;
  categoryName: string;
  locationName: string;
  hasDecisionConflict: boolean;
}

interface AppealQueueItem {
  appealId: string;
  listingId: string;
  statement: string;
  originalExplanation: string | null;
  createdAt: string;
  title: string;
  sellerName: string;
  categoryName: string;
  locationName: string;
  hasDecisionConflict: boolean;
}

interface MessageReportQueueItem {
  reportId: string;
  messageId: string;
  conversationId: string;
  listingId: string;
  listingTitle: string;
  messageBody: string;
  senderName: string;
  reason: string;
  details: string | null;
  createdAt: string;
  hasDecisionConflict: boolean;
}

interface ReviewReportQueueItem {
  reportId: string;
  reviewId: string;
  rating: number;
  reviewBody: string | null;
  authorName: string;
  subjectName: string;
  reason: string;
  details: string | null;
  createdAt: string;
  hasDecisionConflict: boolean;
}

type ModerationQueueId =
  'listings' | 'reports' | 'messageReports' | 'reviewReports' | 'appeals' | 'operations';

interface PendingConfirmation {
  title: string;
  tone: 'default' | 'danger';
  action: () => void;
}

interface ModerationLabels {
  loading: string;
  auth: string;
  signIn: string;
  forbidden: string;
  error: string;
  empty: string;
  conflictHidden: string;
  conflictViewOnly: string;
  queueNavigation: string;
  queueDescriptions: Record<ModerationQueueId, string>;
  preview: string;
  backToQueue: string;
  reviewBeforeDecision: string;
  decisionTitle: string;
  confirmationMessage: string;
  confirmationCancel: string;
  confirmationContinue: string;
  listingDetails: string;
  photos: string;
  photoPrevious: string;
  photoNext: string;
  photoCount: string;
  noPhotos: string;
  attributesTitle: string;
  noAttributes: string;
  priceOnRequest: string;
  yes: string;
  no: string;
  seller: string;
  risk: string;
  riskUnassessed: string;
  riskBands: Record<'low' | 'medium' | 'high', string>;
  riskPolicy: string;
  riskSignalsTitle: string;
  riskSignals: Record<'new_account' | 'contact_details_in_content', string>;
  assignedTo: string;
  unassigned: string;
  claim: string;
  claiming: string;
  claimBeforeReview: string;
  release: string;
  releasing: string;
  queueAge: string;
  minutesShort: string;
  hoursShort: string;
  slaStates: Record<'within_target' | 'due_soon' | 'overdue', string>;
  slaTarget: string;
  oldestOpen: string;
  operationsTitle: string;
  operationsError: string;
  operationsWindows: Record<7 | 30, string>;
  openWorkTitle: string;
  decisionsTitle: string;
  recentActionsTitle: string;
  recentActionsEmpty: string;
  staffAccessTitle: string;
  staffAccessEmpty: string;
  staffAccessCount: string;
  accessSurfaces: Record<'queue' | 'operations', string>;
  metricLabels: Record<string, string>;
  actionLabels: Record<string, string>;
  newListingsTitle: string;
  newListingsEmpty: string;
  approve: string;
  approving: string;
  rejectTitle: string;
  reason: string;
  explanation: string;
  explanationHint: string;
  reject: string;
  rejecting: string;
  reportsTitle: string;
  reportsEmpty: string;
  reportDetails: string;
  reportDismiss: string;
  reportRemoveTitle: string;
  reportRemove: string;
  messageReportsTitle: string;
  messageReportsEmpty: string;
  messageReportSender: string;
  messageReportContent: string;
  messageReportDetails: string;
  messageReportDismiss: string;
  messageReportCloseTitle: string;
  messageReportClose: string;
  reviewReportsTitle: string;
  reviewReportsEmpty: string;
  reviewReportAuthor: string;
  reviewReportSubject: string;
  reviewReportContent: string;
  reviewReportDetails: string;
  reviewReportDismiss: string;
  reviewReportHideTitle: string;
  reviewReportHide: string;
  appealsTitle: string;
  appealsEmpty: string;
  appealOriginalDecision: string;
  appealStatement: string;
  appealAccept: string;
  appealRejectTitle: string;
  appealResponse: string;
  appealResponseHint: string;
  appealReject: string;
  actionAuth: string;
  actionForbidden: string;
  actionConflict: string;
  actionError: string;
  reasons: Record<string, string>;
  reportReasons: Record<string, string>;
  messageReportReasons: Record<string, string>;
  reviewReportReasons: Record<string, string>;
}

export function ModerationDashboard({
  locale,
  labels
}: {
  locale: AppLocale;
  labels: ModerationLabels;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  const [messageReports, setMessageReports] = useState<MessageReportQueueItem[]>([]);
  const [reviewReports, setReviewReports] = useState<ReviewReportQueueItem[]>([]);
  const [appeals, setAppeals] = useState<AppealQueueItem[]>([]);
  const [excludedConflicts, setExcludedConflicts] = useState({
    reports: 0,
    messageReports: 0,
    reviewReports: 0,
    appeals: 0
  });
  const [operations, setOperations] = useState<ModerationOperations | null>(null);
  const [operationsState, setOperationsState] = useState<'loading' | 'hidden' | 'ready' | 'error'>(
    'loading'
  );
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'forbidden' | 'error'>(
    'loading'
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<ModerationQueueId>('listings');
  const [reviewingCaseId, setReviewingCaseId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmation) return;
    cancelConfirmationRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirmation(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [confirmation]);

  function requestConfirmation(
    title: string,
    action: () => void,
    tone: PendingConfirmation['tone'] = 'default'
  ) {
    setConfirmation({title, action, tone});
  }

  function actionErrorFor(response: Response) {
    if (response.status === 401) return labels.actionAuth;
    if (response.status === 403) return labels.actionForbidden;
    if (response.status === 404 || response.status === 409) return labels.actionConflict;
    return labels.actionError;
  }

  useEffect(() => {
    void (async () => {
      try {
        const responses = await Promise.all([
          fetch(`/api/v1/moderation/cases?locale=${locale}`, {cache: 'no-store'}),
          fetch(`/api/v1/moderation/reports?locale=${locale}`, {cache: 'no-store'}),
          fetch(`/api/v1/moderation/message-reports?locale=${locale}`, {cache: 'no-store'}),
          fetch(`/api/v1/moderation/review-reports?locale=${locale}`, {cache: 'no-store'}),
          fetch(`/api/v1/moderation/appeals?locale=${locale}`, {cache: 'no-store'}),
          fetch('/api/v1/moderation/operations?windowDays=7&limit=20', {cache: 'no-store'})
        ]);
        const queueResponses = responses.slice(0, 5);
        const operationsResponse = responses[5];
        if (queueResponses.some((response) => response.status === 401)) return setState('auth');
        if (queueResponses.some((response) => response.status === 403))
          return setState('forbidden');
        if (queueResponses.some((response) => !response.ok)) throw new Error('queue failed');
        const [caseBody, reportBody, messageReportBody, reviewReportBody, appealBody] =
          (await Promise.all(queueResponses.map((response) => response.json()))) as [
            {data: QueueItem[]},
            {data: ReportQueueItem[]; meta?: {excludedConflictCount?: number}},
            {data: MessageReportQueueItem[]; meta?: {excludedConflictCount?: number}},
            {data: ReviewReportQueueItem[]; meta?: {excludedConflictCount?: number}},
            {data: AppealQueueItem[]; meta?: {excludedConflictCount?: number}}
          ];
        setItems(caseBody.data);
        setReports(reportBody.data);
        setMessageReports(messageReportBody.data);
        setReviewReports(reviewReportBody.data);
        setAppeals(appealBody.data);
        setExcludedConflicts({
          reports: reportBody.meta?.excludedConflictCount ?? 0,
          messageReports: messageReportBody.meta?.excludedConflictCount ?? 0,
          reviewReports: reviewReportBody.meta?.excludedConflictCount ?? 0,
          appeals: appealBody.meta?.excludedConflictCount ?? 0
        });
        if (operationsResponse?.ok) {
          const operationsBody = (await operationsResponse.json()) as {data: ModerationOperations};
          setOperations(operationsBody.data);
          setOperationsState('ready');
        } else {
          setOperationsState(operationsResponse?.status === 403 ? 'hidden' : 'error');
        }
        setState('ready');
      } catch {
        setState('error');
      }
    })();
  }, [locale]);

  async function decideCase(caseId: string, payload: Record<string, string>) {
    const key = `case:${caseId}`;
    setPendingAction(key);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/cases/${caseId}/decision`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        if (response.status === 401) setState('auth');
        if ([403, 404, 409].includes(response.status)) {
          setItems((current) => current.filter((item) => item.caseId !== caseId));
          setReviewingCaseId(null);
        }
        setActionError(actionErrorFor(response));
        return;
      }
      setItems((current) => current.filter((item) => item.caseId !== caseId));
      setReviewingCaseId(null);
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingAction(null);
    }
  }

  async function changeAssignment(caseId: string, action: 'claim' | 'release') {
    const key = `assignment:${action}:${caseId}`;
    setPendingAction(key);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/cases/${caseId}/assignment`, {
        method: action === 'claim' ? 'PUT' : 'DELETE'
      });
      if (!response.ok) {
        if (response.status === 401) setState('auth');
        if (response.status === 404) {
          setItems((current) => current.filter((item) => item.caseId !== caseId));
        }
        setActionError(actionErrorFor(response));
        return;
      }
      const body = (await response.json()) as {
        data: Pick<QueueItem, 'assigneeName' | 'assignedAt' | 'isAssignedToActor'>;
      };
      setItems((current) =>
        current.map((item) => (item.caseId === caseId ? {...item, ...body.data} : item))
      );
      if (action === 'release') setReviewingCaseId(null);
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingAction(null);
    }
  }

  async function decideReport(reportId: string, action: 'dismiss' | 'remove_listing') {
    const key = `report:${reportId}`;
    setPendingAction(key);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/reports/${reportId}/decision`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({action})
      });
      if (!response.ok) {
        if (response.status === 401) setState('auth');
        if ([403, 404, 409].includes(response.status)) {
          setReports((current) => current.filter((item) => item.reportId !== reportId));
        }
        setActionError(actionErrorFor(response));
        return;
      }
      const body = (await response.json()) as {data: {listingId: string}};
      setReports((current) =>
        action === 'remove_listing'
          ? current.filter((item) => item.listingId !== body.data.listingId)
          : current.filter((item) => item.reportId !== reportId)
      );
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingAction(null);
    }
  }

  async function decideAppeal(appealId: string, payload: Record<string, string>) {
    const key = `appeal:${appealId}`;
    setPendingAction(key);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/appeals/${appealId}/decision`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        if (response.status === 401) setState('auth');
        if ([403, 404, 409].includes(response.status)) {
          setAppeals((current) => current.filter((item) => item.appealId !== appealId));
        }
        setActionError(actionErrorFor(response));
        return;
      }
      setAppeals((current) => current.filter((item) => item.appealId !== appealId));
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingAction(null);
    }
  }

  async function decideMessageReport(reportId: string, action: 'dismiss' | 'close_conversation') {
    const key = `message-report:${reportId}`;
    setPendingAction(key);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/message-reports/${reportId}/decision`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({action})
      });
      if (!response.ok) {
        if (response.status === 401) setState('auth');
        if ([403, 404, 409].includes(response.status)) {
          setMessageReports((current) => current.filter((item) => item.reportId !== reportId));
        }
        setActionError(actionErrorFor(response));
        return;
      }
      const body = (await response.json()) as {data: {conversationId: string}};
      setMessageReports((current) =>
        action === 'close_conversation'
          ? current.filter((item) => item.conversationId !== body.data.conversationId)
          : current.filter((item) => item.reportId !== reportId)
      );
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingAction(null);
    }
  }

  async function decideReviewReport(reportId: string, action: 'dismiss' | 'hide_review') {
    const key = `review-report:${reportId}`;
    setPendingAction(key);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/review-reports/${reportId}/decision`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({action})
      });
      if (!response.ok) {
        if (response.status === 401) setState('auth');
        if ([403, 404, 409].includes(response.status)) {
          setReviewReports((current) => current.filter((item) => item.reportId !== reportId));
        }
        setActionError(actionErrorFor(response));
        return;
      }
      const body = (await response.json()) as {data: {reviewId: string}};
      setReviewReports((current) =>
        action === 'hide_review'
          ? current.filter((item) => item.reviewId !== body.data.reviewId)
          : current.filter((item) => item.reportId !== reportId)
      );
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingAction(null);
    }
  }

  function rejectCase(event: FormEvent<HTMLFormElement>, caseId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      action: 'reject',
      reasonCode: String(data.get('reasonCode') ?? ''),
      publicExplanation: String(data.get('publicExplanation') ?? '')
    };
    requestConfirmation(labels.reject, () => void decideCase(caseId, payload), 'danger');
  }

  function rejectAppeal(event: FormEvent<HTMLFormElement>, appealId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      action: 'reject',
      publicResponse: String(data.get('publicResponse') ?? '')
    };
    requestConfirmation(labels.appealReject, () => void decideAppeal(appealId, payload), 'danger');
  }

  if (state === 'loading') return <p>{labels.loading}</p>;
  if (state === 'auth')
    return (
      <div className="empty-state">
        <p>{labels.auth}</p>
        <Link
          className="button button-primary"
          href={`/${locale}/auth?returnTo=/${locale}/moderation`}
        >
          {labels.signIn}
        </Link>
      </div>
    );
  if (state === 'forbidden') return <p role="alert">{labels.forbidden}</p>;
  if (state === 'error') return <p role="alert">{labels.error}</p>;
  const operationsContent = (
    <>
      {operations && <OperationsOverview locale={locale} labels={labels} data={operations} />}
      {operationsState === 'error' && (
        <p className="notice notice-error" role="alert">
          {labels.operationsError}
        </p>
      )}
    </>
  );
  const queueTabs = [
    {
      id: 'listings' as const,
      label: labels.newListingsTitle,
      description: labels.queueDescriptions.listings,
      count: items.length
    },
    {
      id: 'reports' as const,
      label: labels.reportsTitle,
      description: labels.queueDescriptions.reports,
      count: reports.length
    },
    {
      id: 'messageReports' as const,
      label: labels.messageReportsTitle,
      description: labels.queueDescriptions.messageReports,
      count: messageReports.length
    },
    {
      id: 'reviewReports' as const,
      label: labels.reviewReportsTitle,
      description: labels.queueDescriptions.reviewReports,
      count: reviewReports.length
    },
    {
      id: 'appeals' as const,
      label: labels.appealsTitle,
      description: labels.queueDescriptions.appeals,
      count: appeals.length
    },
    ...(operationsState === 'hidden'
      ? []
      : [
          {
            id: 'operations' as const,
            label: labels.operationsTitle,
            description: labels.queueDescriptions.operations,
            count: null
          }
        ])
  ];

  return (
    <div className="moderation-workspace">
      <aside className="moderation-navigation-panel">
        <strong>{labels.queueNavigation}</strong>
        <nav className="moderation-tabs" aria-label={labels.queueNavigation}>
          {queueTabs.map((tab) => (
            <button
              aria-current={activeQueue === tab.id ? 'page' : undefined}
              className={activeQueue === tab.id ? 'is-active' : undefined}
              key={tab.id}
              onClick={() => {
                setActiveQueue(tab.id);
                setReviewingCaseId(null);
                setActionError(null);
              }}
              type="button"
            >
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.description}</small>
              </span>
              {tab.count !== null && <b>{tab.count}</b>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="moderation-queue-surface">
        {actionError && (
          <p className="notice notice-error" role="alert">
            {actionError}
          </p>
        )}

        {activeQueue === 'operations' && operationsContent}

        {activeQueue === 'listings' && (
          <QueueSection
            title={labels.newListingsTitle}
            description={labels.queueDescriptions.listings}
            empty={labels.newListingsEmpty}
          >
            <ListingModerationQueue
              items={items}
              labels={labels}
              locale={locale}
              pendingAction={pendingAction}
              reviewingCaseId={reviewingCaseId}
              onReview={setReviewingCaseId}
              onBack={() => setReviewingCaseId(null)}
              onAssignment={(caseId, action) => void changeAssignment(caseId, action)}
              onApprove={(item) =>
                requestConfirmation(
                  labels.approve,
                  () =>
                    void decideCase(item.caseId, {
                      action: 'approve',
                      reasonCode: 'policy_compliant'
                    })
                )
              }
              onReject={rejectCase}
            />
          </QueueSection>
        )}

        {activeQueue === 'reports' && (
          <QueueSection
            title={labels.reportsTitle}
            description={labels.queueDescriptions.reports}
            empty={labels.reportsEmpty}
            conflictNotice={
              excludedConflicts.reports
                ? labels.conflictHidden.replace('__COUNT__', String(excludedConflicts.reports))
                : undefined
            }
          >
            {reports.map((report) => {
              const pending = pendingAction === `report:${report.reportId}`;
              return (
                <article className="moderation-card" key={report.reportId}>
                  <header>
                    <div>
                      <span>
                        {report.categoryName} · {report.locationName}
                      </span>
                      <h3>{report.title}</h3>
                    </div>
                    <span className="status-chip">
                      {labels.reportReasons[report.reason] ?? report.reason}
                    </span>
                  </header>
                  {report.details && (
                    <p>
                      <strong>{labels.reportDetails}:</strong> {report.details}
                    </p>
                  )}
                  <small>
                    {labels.seller}: {report.sellerName}
                  </small>
                  {report.hasDecisionConflict && (
                    <p className="notice notice-warm">{labels.conflictViewOnly}</p>
                  )}
                  <div className="moderation-actions">
                    <button
                      className="button"
                      disabled={pending || report.hasDecisionConflict}
                      onClick={() =>
                        requestConfirmation(
                          labels.reportDismiss,
                          () => void decideReport(report.reportId, 'dismiss')
                        )
                      }
                      type="button"
                    >
                      {labels.reportDismiss}
                    </button>
                    <details>
                      <summary>{labels.reportRemoveTitle}</summary>
                      <button
                        className="button button-danger"
                        disabled={pending || report.hasDecisionConflict}
                        onClick={() =>
                          requestConfirmation(
                            labels.reportRemove,
                            () => void decideReport(report.reportId, 'remove_listing'),
                            'danger'
                          )
                        }
                        type="button"
                      >
                        {labels.reportRemove}
                      </button>
                    </details>
                    <Link href={`/${locale}/listings/${report.listingId}`}>↗</Link>
                  </div>
                </article>
              );
            })}
          </QueueSection>
        )}

        {activeQueue === 'messageReports' && (
          <QueueSection
            title={labels.messageReportsTitle}
            description={labels.queueDescriptions.messageReports}
            empty={labels.messageReportsEmpty}
            conflictNotice={
              excludedConflicts.messageReports
                ? labels.conflictHidden.replace(
                    '__COUNT__',
                    String(excludedConflicts.messageReports)
                  )
                : undefined
            }
          >
            {messageReports.map((report) => {
              const pending = pendingAction === `message-report:${report.reportId}`;
              return (
                <article className="moderation-card" key={report.reportId}>
                  <header>
                    <div>
                      <span>{report.listingTitle}</span>
                      <h3>{labels.messageReportContent}</h3>
                    </div>
                    <span className="status-chip">
                      {labels.messageReportReasons[report.reason] ?? report.reason}
                    </span>
                  </header>
                  <p className="moderation-message-quote">{report.messageBody}</p>
                  <small>
                    {labels.messageReportSender}: {report.senderName}
                  </small>
                  {report.details && (
                    <p>
                      <strong>{labels.messageReportDetails}:</strong> {report.details}
                    </p>
                  )}
                  {report.hasDecisionConflict && (
                    <p className="notice notice-warm">{labels.conflictViewOnly}</p>
                  )}
                  <div className="moderation-actions">
                    <button
                      className="button"
                      disabled={pending || report.hasDecisionConflict}
                      onClick={() =>
                        requestConfirmation(
                          labels.messageReportDismiss,
                          () => void decideMessageReport(report.reportId, 'dismiss')
                        )
                      }
                      type="button"
                    >
                      {labels.messageReportDismiss}
                    </button>
                    <details>
                      <summary>{labels.messageReportCloseTitle}</summary>
                      <button
                        className="button button-danger"
                        disabled={pending || report.hasDecisionConflict}
                        onClick={() =>
                          requestConfirmation(
                            labels.messageReportClose,
                            () => void decideMessageReport(report.reportId, 'close_conversation'),
                            'danger'
                          )
                        }
                        type="button"
                      >
                        {labels.messageReportClose}
                      </button>
                    </details>
                  </div>
                </article>
              );
            })}
          </QueueSection>
        )}

        {activeQueue === 'reviewReports' && (
          <QueueSection
            title={labels.reviewReportsTitle}
            description={labels.queueDescriptions.reviewReports}
            empty={labels.reviewReportsEmpty}
            conflictNotice={
              excludedConflicts.reviewReports
                ? labels.conflictHidden.replace(
                    '__COUNT__',
                    String(excludedConflicts.reviewReports)
                  )
                : undefined
            }
          >
            {reviewReports.map((report) => {
              const pending = pendingAction === `review-report:${report.reportId}`;
              return (
                <article className="moderation-card" key={report.reportId}>
                  <header>
                    <div>
                      <span>
                        {labels.reviewReportSubject}: {report.subjectName}
                      </span>
                      <h3>{labels.reviewReportContent}</h3>
                    </div>
                    <span className="status-chip">
                      {labels.reviewReportReasons[report.reason] ?? report.reason}
                    </span>
                  </header>
                  <p className="moderation-message-quote">
                    {'★'.repeat(report.rating)}
                    {'☆'.repeat(5 - report.rating)}
                    {report.reviewBody ? ` — ${report.reviewBody}` : ''}
                  </p>
                  <small>
                    {labels.reviewReportAuthor}: {report.authorName}
                  </small>
                  {report.details && (
                    <p>
                      <strong>{labels.reviewReportDetails}:</strong> {report.details}
                    </p>
                  )}
                  {report.hasDecisionConflict && (
                    <p className="notice notice-warm">{labels.conflictViewOnly}</p>
                  )}
                  <div className="moderation-actions">
                    <button
                      className="button"
                      disabled={pending || report.hasDecisionConflict}
                      onClick={() =>
                        requestConfirmation(
                          labels.reviewReportDismiss,
                          () => void decideReviewReport(report.reportId, 'dismiss')
                        )
                      }
                      type="button"
                    >
                      {labels.reviewReportDismiss}
                    </button>
                    <details>
                      <summary>{labels.reviewReportHideTitle}</summary>
                      <button
                        className="button button-danger"
                        disabled={pending || report.hasDecisionConflict}
                        onClick={() =>
                          requestConfirmation(
                            labels.reviewReportHide,
                            () => void decideReviewReport(report.reportId, 'hide_review'),
                            'danger'
                          )
                        }
                        type="button"
                      >
                        {labels.reviewReportHide}
                      </button>
                    </details>
                  </div>
                </article>
              );
            })}
          </QueueSection>
        )}

        {activeQueue === 'appeals' && (
          <QueueSection
            title={labels.appealsTitle}
            description={labels.queueDescriptions.appeals}
            empty={labels.appealsEmpty}
            conflictNotice={
              excludedConflicts.appeals
                ? labels.conflictHidden.replace('__COUNT__', String(excludedConflicts.appeals))
                : undefined
            }
          >
            {appeals.map((appeal) => {
              const pending = pendingAction === `appeal:${appeal.appealId}`;
              return (
                <article className="moderation-card" key={appeal.appealId}>
                  <header>
                    <div>
                      <span>
                        {appeal.categoryName} · {appeal.locationName}
                      </span>
                      <h3>{appeal.title}</h3>
                    </div>
                  </header>
                  {appeal.originalExplanation && (
                    <p>
                      <strong>{labels.appealOriginalDecision}:</strong> {appeal.originalExplanation}
                    </p>
                  )}
                  <p>
                    <strong>{labels.appealStatement}:</strong> {appeal.statement}
                  </p>
                  <small>
                    {labels.seller}: {appeal.sellerName}
                  </small>
                  {appeal.hasDecisionConflict && (
                    <p className="notice notice-warm">{labels.conflictViewOnly}</p>
                  )}
                  <div className="moderation-actions">
                    <button
                      className="button button-primary"
                      disabled={pending || appeal.hasDecisionConflict}
                      onClick={() =>
                        requestConfirmation(
                          labels.appealAccept,
                          () => void decideAppeal(appeal.appealId, {action: 'accept'})
                        )
                      }
                      type="button"
                    >
                      {labels.appealAccept}
                    </button>
                    <details>
                      <summary>{labels.appealRejectTitle}</summary>
                      <form onSubmit={(event) => rejectAppeal(event, appeal.appealId)}>
                        <label>
                          {labels.appealResponse}
                          <textarea
                            name="publicResponse"
                            required
                            minLength={10}
                            maxLength={500}
                            placeholder={labels.appealResponseHint}
                          />
                        </label>
                        <button
                          className="button"
                          disabled={pending || appeal.hasDecisionConflict}
                          type="submit"
                        >
                          {labels.appealReject}
                        </button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </QueueSection>
        )}
      </div>
      {confirmation && (
        <ConfirmationDialog
          cancelRef={cancelConfirmationRef}
          labels={labels}
          pending={pendingAction !== null}
          title={confirmation.title}
          tone={confirmation.tone}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.action;
            setConfirmation(null);
            action();
          }}
        />
      )}
    </div>
  );
}

function ListingModerationQueue({
  items,
  locale,
  labels,
  pendingAction,
  reviewingCaseId,
  onReview,
  onBack,
  onAssignment,
  onApprove,
  onReject
}: {
  items: QueueItem[];
  locale: AppLocale;
  labels: ModerationLabels;
  pendingAction: string | null;
  reviewingCaseId: string | null;
  onReview: (caseId: string) => void;
  onBack: () => void;
  onAssignment: (caseId: string, action: 'claim' | 'release') => void;
  onApprove: (item: QueueItem) => void;
  onReject: (event: FormEvent<HTMLFormElement>, caseId: string) => void;
}) {
  const reviewingItem = items.find((item) => item.caseId === reviewingCaseId) ?? null;

  if (reviewingItem) {
    const item = reviewingItem;
    const pending = pendingAction?.endsWith(item.caseId) ?? false;
    const canDecide = item.isAssignedToActor;
    const ageValue = formatModerationAge(item, labels);
    return (
      <article className="moderation-review-workspace">
        <button className="moderation-back-button" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> {labels.backToQueue}
        </button>

        <header className="moderation-review-header">
          <div>
            <span>
              {item.categoryName} · {item.locationName}
            </span>
            <h3>{item.title}</h3>
          </div>
          <span className={`status-chip moderation-risk-${item.riskBand}`}>
            {labels.risk}:{' '}
            {item.riskBand === 'unassessed'
              ? labels.riskUnassessed
              : labels.riskBands[item.riskBand]}
          </span>
        </header>

        <div className="moderation-review-layout">
          <section className="moderation-review-listing" aria-label={labels.preview}>
            <div className="moderation-listing-price">
              <span>{labels.listingDetails}</span>
              <strong>
                {formatPrice(item.priceMinor, item.currency, locale, labels.priceOnRequest)}
              </strong>
            </div>
            <ImageGallery
              alt={`${labels.photos}: ${item.title}`}
              className="moderation-media-gallery"
              labels={{
                empty: labels.noPhotos,
                previous: labels.photoPrevious,
                next: labels.photoNext,
                count: labels.photoCount
              }}
              urls={item.mediaUrls}
            />
            <section className="moderation-preview-description">
              <h4>{labels.listingDetails}</h4>
              <p>{item.description}</p>
            </section>
            {item.mapLatitude !== null && item.mapLongitude !== null && (
              <section className="moderation-preview-location">
                <h4>{item.locationName}</h4>
                {item.publicLocationLabel && <p>{item.publicLocationLabel}</p>}
                <LocationMap
                  label={item.locationName}
                  point={{latitude: item.mapLatitude, longitude: item.mapLongitude}}
                />
              </section>
            )}
            <section className="moderation-preview-attributes">
              <h4>{labels.attributesTitle}</h4>
              {item.attributes.length === 0 ? (
                <p>{labels.noAttributes}</p>
              ) : (
                <dl>
                  {item.attributes.map((attribute) => (
                    <div key={attribute.attributeId}>
                      <dt>{attribute.label}</dt>
                      <dd>
                        {Array.isArray(attribute.value)
                          ? attribute.value.join(', ')
                          : typeof attribute.value === 'boolean'
                            ? attribute.value
                              ? labels.yes
                              : labels.no
                            : String(attribute.value)}
                        {attribute.unit ? ` ${attribute.unit}` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </section>

          <aside className="moderation-review-sidebar">
            <section className="moderation-case-panel">
              <div className="moderation-case-row">
                <span>{labels.seller}</span>
                <strong>{item.sellerName}</strong>
              </div>
              <div className="moderation-case-row">
                <span>{labels.queueAge}</span>
                <strong>{ageValue}</strong>
              </div>
              <div className="moderation-case-row">
                <span>{labels.assignedTo}</span>
                <strong>{item.assigneeName ?? labels.unassigned}</strong>
              </div>
              <div className="moderation-case-sla">
                <span className={`status-chip moderation-sla-${item.slaState.replace('_', '-')}`}>
                  {labels.slaStates[item.slaState]}
                </span>
              </div>
              <div className="moderation-risk-signals">
                <strong>{labels.riskSignalsTitle}</strong>
                {item.signals.map((signal) => (
                  <span className="status-chip" key={signal.code}>
                    {labels.riskSignals[signal.code]} · +{signal.weight}
                  </span>
                ))}
                <small>
                  {labels.riskPolicy}: {item.policyVersion}
                </small>
              </div>
              <AssignmentButton
                item={item}
                labels={labels}
                pending={pending}
                pendingAction={pendingAction}
                onAssignment={onAssignment}
              />
            </section>

            <section className="moderation-decision-panel">
              <div>
                <p className="eyebrow">SATAL CONTROL</p>
                <h3>{labels.decisionTitle}</h3>
                <p>{labels.reviewBeforeDecision}</p>
              </div>
              <button
                className="button button-primary"
                disabled={pending || !canDecide}
                onClick={() => onApprove(item)}
                type="button"
              >
                {pending ? labels.approving : labels.approve}
              </button>
              <details className="moderation-rejection-panel">
                <summary>{labels.rejectTitle}</summary>
                <form onSubmit={(event) => onReject(event, item.caseId)}>
                  <label>
                    {labels.reason}
                    <select name="reasonCode" required defaultValue="insufficient_information">
                      {Object.entries(labels.reasons).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {labels.explanation}
                    <textarea
                      name="publicExplanation"
                      required
                      minLength={10}
                      maxLength={500}
                      placeholder={labels.explanationHint}
                    />
                  </label>
                  <button
                    className="button button-danger"
                    disabled={pending || !canDecide}
                    type="submit"
                  >
                    {pending ? labels.rejecting : labels.reject}
                  </button>
                </form>
              </details>
            </section>
          </aside>
        </div>
      </article>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state moderation-empty-state">
        <p>{labels.newListingsEmpty}</p>
      </div>
    );
  }

  return (
    <div className="moderation-inbox-list">
      {items.map((item) => {
        const pending = pendingAction?.endsWith(item.caseId) ?? false;
        return (
          <article className="moderation-inbox-card" key={item.caseId}>
            <div className="moderation-inbox-media">
              {item.mediaUrls[0] ? (
                <Image alt="" fill sizes="112px" src={item.mediaUrls[0]} unoptimized />
              ) : (
                <span>S</span>
              )}
            </div>
            <div className="moderation-inbox-main">
              <div className="moderation-inbox-meta">
                <span>
                  {item.categoryName} · {item.locationName}
                </span>
                <span className={`status-chip moderation-sla-${item.slaState.replace('_', '-')}`}>
                  {labels.slaStates[item.slaState]}
                </span>
              </div>
              <h3>{item.title}</h3>
              <div className="moderation-inbox-facts">
                <span>
                  {labels.seller}: <strong>{item.sellerName}</strong>
                </span>
                <span>
                  {labels.queueAge}: <strong>{formatModerationAge(item, labels)}</strong>
                </span>
                <span>
                  {labels.assignedTo}: <strong>{item.assigneeName ?? labels.unassigned}</strong>
                </span>
              </div>
            </div>
            <div className="moderation-inbox-actions">
              <button
                className="button button-primary"
                disabled={pending || !item.isAssignedToActor}
                onClick={() => onReview(item.caseId)}
                type="button"
              >
                {labels.preview}
              </button>
              <AssignmentButton
                item={item}
                labels={labels}
                pending={pending}
                pendingAction={pendingAction}
                onAssignment={onAssignment}
              />
              {!item.isAssignedToActor && (
                <small className="moderation-claim-hint">{labels.claimBeforeReview}</small>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AssignmentButton({
  item,
  labels,
  pending,
  pendingAction,
  onAssignment
}: {
  item: QueueItem;
  labels: ModerationLabels;
  pending: boolean;
  pendingAction: string | null;
  onAssignment: (caseId: string, action: 'claim' | 'release') => void;
}) {
  if (item.assigneeName === null) {
    return (
      <button
        className="button button-quiet"
        disabled={pending}
        onClick={() => onAssignment(item.caseId, 'claim')}
        type="button"
      >
        {pendingAction === `assignment:claim:${item.caseId}` ? labels.claiming : labels.claim}
      </button>
    );
  }
  if (!item.isAssignedToActor && !item.canOverrideAssignment) return null;
  return (
    <button
      className="button button-quiet"
      disabled={pending}
      onClick={() => onAssignment(item.caseId, 'release')}
      type="button"
    >
      {pendingAction === `assignment:release:${item.caseId}` ? labels.releasing : labels.release}
    </button>
  );
}

function formatModerationAge(item: QueueItem, labels: ModerationLabels) {
  return item.ageMinutes >= 60
    ? `${Math.floor(item.ageMinutes / 60)} ${labels.hoursShort}`
    : `${item.ageMinutes} ${labels.minutesShort}`;
}

function ConfirmationDialog({
  title,
  tone,
  pending,
  labels,
  cancelRef,
  onCancel,
  onConfirm
}: {
  title: string;
  tone: PendingConfirmation['tone'];
  pending: boolean;
  labels: ModerationLabels;
  cancelRef: React.RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="moderation-confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        aria-describedby="moderation-confirmation-description"
        aria-labelledby="moderation-confirmation-title"
        aria-modal="true"
        className="moderation-confirmation-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <span className={`moderation-confirmation-icon is-${tone}`} aria-hidden="true">
          {tone === 'danger' ? '!' : '✓'}
        </span>
        <div>
          <p className="eyebrow">SATAL CONTROL</p>
          <h2 id="moderation-confirmation-title">{title}</h2>
          <p id="moderation-confirmation-description">{labels.confirmationMessage}</p>
        </div>
        <div className="moderation-confirmation-actions">
          <button
            className="button"
            disabled={pending}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {labels.confirmationCancel}
          </button>
          <button
            className={`button ${tone === 'danger' ? 'button-danger' : 'button-primary'}`}
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {labels.confirmationContinue}
          </button>
        </div>
      </section>
    </div>
  );
}

function OperationsOverview({
  locale,
  labels,
  data
}: {
  locale: AppLocale;
  labels: ModerationLabels;
  data: ModerationOperations;
}) {
  const formatter = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'});
  const oldestOpenValue =
    data.sla.oldestOpenMinutes >= 60
      ? `${Math.floor(data.sla.oldestOpenMinutes / 60)} ${labels.hoursShort}`
      : `${data.sla.oldestOpenMinutes} ${labels.minutesShort}`;
  return (
    <section className="moderation-operations" aria-labelledby="moderation-operations-title">
      <header>
        <div>
          <p className="eyebrow">SATAL CONTROL</p>
          <h2 id="moderation-operations-title">{labels.operationsTitle}</h2>
        </div>
        <span className="status-chip">{labels.operationsWindows[data.windowDays]}</span>
      </header>
      <div className="moderation-metrics-group">
        <h3>{labels.openWorkTitle}</h3>
        <div className="moderation-metrics-grid">
          {Object.entries(data.queueCounts).map(([key, value]) => (
            <div className="moderation-metric" key={key}>
              <strong>{value}</strong>
              <span>{labels.metricLabels[key] ?? key}</span>
            </div>
          ))}
        </div>
        <p className="moderation-sla-summary">
          <span>
            {labels.slaTarget}:{' '}
            <strong>
              {data.sla.listingTargetHours} {labels.hoursShort}
            </strong>
          </span>
          <span>
            {labels.oldestOpen}: <strong>{oldestOpenValue}</strong>
          </span>
        </p>
      </div>
      <div className="moderation-metrics-group">
        <h3>{labels.decisionsTitle}</h3>
        <div className="moderation-metrics-grid">
          {Object.entries(data.decisionCounts).map(([key, value]) => (
            <div className="moderation-metric" key={key}>
              <strong>{value}</strong>
              <span>{labels.metricLabels[key] ?? key}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="moderation-audit">
        <h3>{labels.recentActionsTitle}</h3>
        {data.recentActions.length === 0 ? (
          <p>{labels.recentActionsEmpty}</p>
        ) : (
          <ol>
            {data.recentActions.map((action) => (
              <li key={`${action.entityType}:${action.id}`}>
                <span>
                  <strong>{action.actorName}</strong>{' '}
                  {labels.actionLabels[`${action.entityType}.${action.action}`] ?? action.action}
                </span>
                <time dateTime={action.createdAt}>
                  {formatter.format(new Date(action.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="moderation-audit">
        <h3>{labels.staffAccessTitle}</h3>
        {data.staffAccess.length === 0 ? (
          <p>{labels.staffAccessEmpty}</p>
        ) : (
          <ol>
            {data.staffAccess.map((entry) => (
              <li key={`${entry.actorName}:${entry.surface}`}>
                <span>
                  <strong>{entry.actorName}</strong> · {labels.accessSurfaces[entry.surface]} ·{' '}
                  {labels.staffAccessCount}: {entry.accessCount}
                </span>
                <time dateTime={entry.lastAccessAt}>
                  {formatter.format(new Date(entry.lastAccessAt))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function QueueSection({
  title,
  description,
  empty,
  conflictNotice,
  children
}: {
  title: string;
  description: string;
  empty: string;
  conflictNotice?: string | undefined;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <section className="moderation-queue" aria-label={title}>
      <header className="moderation-queue-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {conflictNotice && <p className="notice notice-warm">{conflictNotice}</p>}
      {count === 0 ? <p>{empty}</p> : children}
    </section>
  );
}
