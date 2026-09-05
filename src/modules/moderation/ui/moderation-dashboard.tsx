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
  approve: string;
  approving: string;
  rejectTitle: string;
  reason: string;
  explanation: string;
  explanationHint: string;
  reject: string;
  rejecting: string;
  actionError: string;
  reasons: Record<string, string>;
}

export function ModerationDashboard({
  locale,
  labels
}: {
  locale: AppLocale;
  labels: ModerationLabels;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'forbidden' | 'error'>(
    'loading'
  );
  const [pendingCase, setPendingCase] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/moderation/cases?locale=${locale}`, {cache: 'no-store'})
      .then(async (response) => {
        if (response.status === 401) return setState('auth');
        if (response.status === 403) return setState('forbidden');
        if (!response.ok) throw new Error('queue failed');
        const body = (await response.json()) as {data: QueueItem[]};
        setItems(body.data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [locale]);

  async function decide(caseId: string, payload: Record<string, string>) {
    setPendingCase(caseId);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/moderation/cases/${caseId}/decision`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('decision failed');
      setItems((current) => current.filter((item) => item.caseId !== caseId));
    } catch {
      setActionError(labels.actionError);
    } finally {
      setPendingCase(null);
    }
  }

  function reject(event: FormEvent<HTMLFormElement>, caseId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void decide(caseId, {
      action: 'reject',
      reasonCode: String(data.get('reasonCode') ?? ''),
      publicExplanation: String(data.get('publicExplanation') ?? '')
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
  if (items.length === 0)
    return (
      <div className="empty-state">
        <p>{labels.empty}</p>
      </div>
    );

  return (
    <div className="moderation-queue">
      {actionError && (
        <p className="notice notice-error" role="alert">
          {actionError}
        </p>
      )}
      {items.map((item) => (
        <article className="moderation-card" key={item.caseId}>
          <header>
            <div>
              <span>
                {item.categoryName} · {item.locationName}
              </span>
              <h2>{item.title}</h2>
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
              disabled={pendingCase === item.caseId}
              onClick={() =>
                void decide(item.caseId, {action: 'approve', reasonCode: 'policy_compliant'})
              }
              type="button"
            >
              {pendingCase === item.caseId ? labels.approving : labels.approve}
            </button>
            <details>
              <summary>{labels.rejectTitle}</summary>
              <form onSubmit={(event) => reject(event, item.caseId)}>
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
                <button className="button" disabled={pendingCase === item.caseId} type="submit">
                  {pendingCase === item.caseId ? labels.rejecting : labels.reject}
                </button>
              </form>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}
