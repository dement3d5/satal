'use client';

import {useState, type FormEvent} from 'react';

import {authClient} from '@/modules/identity/auth-client';

interface ReviewReportLabels {
  action: string;
  title: string;
  reason: string;
  details: string;
  detailsHint: string;
  submit: string;
  submitting: string;
  received: string;
  limit: string;
  error: string;
  reasons: Record<string, string>;
}

export function ReviewReportControl({
  reviewId,
  authorId,
  labels
}: {
  reviewId: string;
  authorId: string;
  labels: ReviewReportLabels;
}) {
  const session = authClient.useSession();
  const [state, setState] = useState<'idle' | 'submitting' | 'received' | 'limit' | 'error'>(
    'idle'
  );

  if (session.isPending || !session.data || session.data.user.id === authorId) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const details = String(data.get('details') ?? '').trim();
    const reason = String(data.get('reason') ?? '');
    setState('submitting');
    try {
      const response = await fetch(`/api/v1/reviews/${reviewId}/reports`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({reason, ...(details ? {details} : {})})
      });
      if (response.status === 429) return setState('limit');
      if (!response.ok) return setState('error');
      setState('received');
    } catch {
      setState('error');
    }
  }

  if (state === 'received') {
    return <small className="review-report-success">{labels.received}</small>;
  }

  return (
    <details className="review-report-control">
      <summary>{labels.action}</summary>
      <form onSubmit={submit}>
        <strong>{labels.title}</strong>
        <label>
          {labels.reason}
          <select name="reason" required defaultValue="spam">
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
        {state === 'limit' && <small role="alert">{labels.limit}</small>}
        {state === 'error' && <small role="alert">{labels.error}</small>}
      </form>
    </details>
  );
}
