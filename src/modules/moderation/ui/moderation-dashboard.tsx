'use client';

import Link from 'next/link';
import {useEffect, useState, type FormEvent} from 'react';

import type {AppLocale} from '@/i18n/routing';

interface QueueItem {
  caseId: string;
  listingId: string;
  priority: number;
  riskBand: 'unassessed' | 'low' | 'medium' | 'high';
  openedAt: string;
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  sellerName: string;
  categoryName: string;
  locationName: string;
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
  const [appeals, setAppeals] = useState<AppealQueueItem[]>([]);
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
          fetch(`/api/v1/moderation/appeals?locale=${locale}`, {cache: 'no-store'})
        ]);
        if (responses.some((response) => response.status === 401)) return setState('auth');
        if (responses.some((response) => response.status === 403)) return setState('forbidden');
        if (responses.some((response) => !response.ok)) throw new Error('queue failed');
        const [caseBody, reportBody, appealBody] = (await Promise.all(
          responses.map((response) => response.json())
        )) as [{data: QueueItem[]}, {data: ReportQueueItem[]}, {data: AppealQueueItem[]}];
        setItems(caseBody.data);
        setReports(reportBody.data);
        setAppeals(appealBody.data);
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
  if (items.length === 0 && reports.length === 0 && appeals.length === 0)
    return (
      <div className="empty-state">
        <p>{labels.empty}</p>
      </div>
    );

  return (
    <div className="moderation-workspace">
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
                  {item.riskBand === 'unassessed' ? labels.riskUnassessed : item.riskBand}
                </span>
              </header>
              <p>{item.description}</p>
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
