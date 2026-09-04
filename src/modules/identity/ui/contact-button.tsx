'use client';

import Link from 'next/link';
import {useState} from 'react';

import type {AppLocale} from '@/i18n/routing';

interface ContactLabels {
  action: string;
  loading: string;
  signIn: string;
  unavailable: string;
  limit: string;
  error: string;
  privacy: string;
}

export function ContactButton({
  listingId,
  locale,
  labels
}: {
  listingId: string;
  locale: AppLocale;
  labels: ContactLabels;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<
    'idle' | 'loading' | 'auth' | 'unavailable' | 'limit' | 'error'
  >('idle');

  async function reveal() {
    setState('loading');
    try {
      const response = await fetch(`/api/v1/listings/${listingId}/contact`, {method: 'POST'});
      if (response.status === 401) return setState('auth');
      if (response.status === 409) return setState('unavailable');
      if (response.status === 429) return setState('limit');
      if (!response.ok) return setState('error');
      const body = (await response.json()) as {data: {phoneNumber: string}};
      setPhone(body.data.phoneNumber);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  if (phone)
    return (
      <a className="button button-primary" href={`tel:${phone}`}>
        {phone}
      </a>
    );
  return (
    <div className="contact-action">
      <button type="button" onClick={reveal} disabled={state === 'loading'}>
        {state === 'loading' ? labels.loading : labels.action}
      </button>
      {state === 'auth' && (
        <Link href={`/${locale}/auth?returnTo=/${locale}/listings/${listingId}`}>
          {labels.signIn}
        </Link>
      )}
      {state === 'unavailable' && <small>{labels.unavailable}</small>}
      {state === 'limit' && <small>{labels.limit}</small>}
      {state === 'error' && <small>{labels.error}</small>}
      <small>{labels.privacy}</small>
    </div>
  );
}
