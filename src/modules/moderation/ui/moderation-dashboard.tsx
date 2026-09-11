'use client';

import Link from 'next/link';
import {useEffect, useState, type FormEvent} from 'react';

import type {AppLocale} from '@/i18n/routing';

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
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  sellerName: string;
  categoryName: string;
  locationName: string;
}

interface ModerationOperations {
  generatedAt: string;
  windowDays: 7 | 30;
  queueCounts: Record<
    'listings' | 'listingReports' | 'appeals' | 'messageReports' | 'reviewReports',
    number
  >;
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
      'listing' | 'listing_report' | 'listing_appeal' | 'message_report' | 'review_report';
    entityId: string;
    action: string;
    actorName: string;
    createdAt: string;
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
}

interface ModerationLabels {
  loading: string;
  auth: string;
  signIn: string;
  forbidden: string;
  error: string;
  empty: string;
  seller: string;
  risk: string;
  riskUnassessed: string;
  riskBands: Record<'low' | 'medium' | 'high', string>;
  riskPolicy: string;
  riskSignalsTitle: string;
  riskSignals: Record<'new_account' | 'contact_details_in_content', string>;
  operationsTitle: string;
  operationsError: string;
  operationsWindows: Record<7 | 30, string>;
  openWorkTitle: string;
  decisionsTitle: string;
  recentActionsTitle: string;
  recentActionsEmpty: string;
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
  const [operations, setOperations] = useState<ModerationOperations | null>(null);
  const [operationsState, setOperationsState] = useState<'loading' | 'hidden' | 'ready' | 'error'>(
    'loading'
  );
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'forbidden' | 'error'>(
    'loading'
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
            {data: ReportQueueItem[]},
            {data: MessageReportQueueItem[]},
            {data: ReviewReportQueueItem[]},
            {data: AppealQueueItem[]}
          ];
        setItems(caseBody.data);
        setReports(reportBody.data);
        setMessageReports(messageReportBody.data);
        setReviewReports(reviewReportBody.data);
        setAppeals(appealBody.data);
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
        }
        setActionError(actionErrorFor(response));
        return;
      }
      setItems((current) => current.filter((item) => item.caseId !== caseId));
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
    void decideCase(caseId, {
      action: 'reject',
      reasonCode: String(data.get('reasonCode') ?? ''),
      publicExplanation: String(data.get('publicExplanation') ?? '')
    });
  }

  function rejectAppeal(event: FormEvent<HTMLFormElement>, appealId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void decideAppeal(appealId, {
      action: 'reject',
      publicResponse: String(data.get('publicResponse') ?? '')
    });
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
  const queuesEmpty =
    items.length === 0 &&
    reports.length === 0 &&
    messageReports.length === 0 &&
    reviewReports.length === 0 &&
    appeals.length === 0;
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

  if (queuesEmpty)
    return (
      <div className="moderation-workspace">
        {operationsContent}
        <div className="empty-state">
          <p>{labels.empty}</p>
        </div>
      </div>
    );

  return (
    <div className="moderation-workspace">
      {operationsContent}
      {actionError && (
        <p className="notice notice-error" role="alert">
          {actionError}
        </p>
      )}

      <QueueSection title={labels.newListingsTitle} empty={labels.newListingsEmpty}>
        {items.map((item) => {
          const pending = pendingAction === `case:${item.caseId}`;
          return (
            <article className="moderation-card" key={item.caseId}>
              <header>
                <div>
                  <span>
                    {item.categoryName} · {item.locationName}
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <span className="status-chip">
                  {labels.risk}:{' '}
                  {item.riskBand === 'unassessed'
                    ? labels.riskUnassessed
                    : labels.riskBands[item.riskBand]}
                </span>
              </header>
              <p>{item.description}</p>
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
              <small>
                {labels.seller}: {item.sellerName}
              </small>
              <div className="moderation-actions">
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={() =>
                    void decideCase(item.caseId, {
                      action: 'approve',
                      reasonCode: 'policy_compliant'
                    })
                  }
                  type="button"
                >
                  {pending ? labels.approving : labels.approve}
                </button>
                <details>
                  <summary>{labels.rejectTitle}</summary>
                  <form onSubmit={(event) => rejectCase(event, item.caseId)}>
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
                    <button className="button" disabled={pending} type="submit">
                      {pending ? labels.rejecting : labels.reject}
                    </button>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
      </QueueSection>

      <QueueSection title={labels.reportsTitle} empty={labels.reportsEmpty}>
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
              <div className="moderation-actions">
                <button
                  className="button"
                  disabled={pending}
                  onClick={() => void decideReport(report.reportId, 'dismiss')}
                  type="button"
                >
                  {labels.reportDismiss}
                </button>
                <details>
                  <summary>{labels.reportRemoveTitle}</summary>
                  <button
                    className="button button-danger"
                    disabled={pending}
                    onClick={() => void decideReport(report.reportId, 'remove_listing')}
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

      <QueueSection title={labels.messageReportsTitle} empty={labels.messageReportsEmpty}>
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
              <div className="moderation-actions">
                <button
                  className="button"
                  disabled={pending}
                  onClick={() => void decideMessageReport(report.reportId, 'dismiss')}
                  type="button"
                >
                  {labels.messageReportDismiss}
                </button>
                <details>
                  <summary>{labels.messageReportCloseTitle}</summary>
                  <button
                    className="button button-danger"
                    disabled={pending}
                    onClick={() => void decideMessageReport(report.reportId, 'close_conversation')}
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

      <QueueSection title={labels.reviewReportsTitle} empty={labels.reviewReportsEmpty}>
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
              <div className="moderation-actions">
                <button
                  className="button"
                  disabled={pending}
                  onClick={() => void decideReviewReport(report.reportId, 'dismiss')}
                  type="button"
                >
                  {labels.reviewReportDismiss}
                </button>
                <details>
                  <summary>{labels.reviewReportHideTitle}</summary>
                  <button
                    className="button button-danger"
                    disabled={pending}
                    onClick={() => void decideReviewReport(report.reportId, 'hide_review')}
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

      <QueueSection title={labels.appealsTitle} empty={labels.appealsEmpty}>
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
              <div className="moderation-actions">
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={() => void decideAppeal(appeal.appealId, {action: 'accept'})}
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
                    <button className="button" disabled={pending} type="submit">
                      {labels.appealReject}
                    </button>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
      </QueueSection>
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
    </section>
  );
}

function QueueSection({
  title,
  empty,
  children
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <section className="moderation-queue" aria-label={title}>
      <h2>{title}</h2>
      {count === 0 ? <p>{empty}</p> : children}
    </section>
  );
}
