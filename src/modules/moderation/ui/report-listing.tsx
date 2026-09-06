'use client';

import Link from 'next/link';
import {useState, type FormEvent} from 'react';

import type {AppLocale} from '@/i18n/routing';

interface ReportLabels {
  action: string;
  title: string;
  reason: string;
  details: string;
  detailsHint: string;
  submit: string;
  submitting: string;
  received: string;
  signIn: string;
  limit: string;
  error: string;
  reasons: Record<string, string>;
}

export function ReportListing({
  listingId,
  locale,
  labels
}: {
  listingId: string;
  locale: AppLocale;
  labels: ReportLabels;
}) {
  const [state, setState] = useState<
    'idle' | 'submitting' | 'received' | 'auth' | 'limit' | 'error'
  >('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const details = String(data.get('details') ?? '').trim();
    setState('submitting');
    try {
      const response = await fetch(`/api/v1/listings/${listingId}/reports`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          reason: String(data.get('reason') ?? ''),
          ...(details ? {details} : {})
        })
      });
      if (response.status === 401) return setState('auth');
      if (response.status === 429) return setState('limit');
      if (!response.ok) return setState('error');
      setState('received');
    } catch {
      setState('error');
    }
  }

  if (state === 'received') return <p className="notice notice-success">{labels.received}</p>;

  return (
    <details className="report-listing">
      <summary>{labels.action}</summary>
      <form onSubmit={submit}>
        <strong>{labels.title}</strong>
        <label>
          {labels.reason}
          <select name="reason" required defaultValue="fraud">
            {Object.entries(labels.reasons).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labels.details}
          <textarea
            name="details"
            minLength={10}
            maxLength={1000}
            placeholder={labels.detailsHint}
          />
        </label>
        <button className="button" disabled={state === 'submitting'} type="submit">
          {state === 'submitting' ? labels.submitting : labels.submit}
        </button>
        {state === 'auth' && (
          <Link href={`/${locale}/auth?returnTo=/${locale}/listings/${listingId}`}>
            {labels.signIn}
          </Link>
        )}
        {state === 'limit' && <small role="alert">{labels.limit}</small>}
        {state === 'error' && <small role="alert">{labels.error}</small>}
      </form>
    </details>
  );
}
