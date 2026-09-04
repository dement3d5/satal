'use client';

import {useState, type FormEvent} from 'react';

import type {AppLocale} from '@/i18n/routing';

export function SaveSearchForm({
  locale,
  query,
  labels
}: {
  locale: AppLocale;
  query: string;
  labels: {name: string; action: string; saved: string; auth: string; error: string};
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'auth' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState('saving');
    try {
      const response = await fetch('/api/v1/saved-searches', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name: form.get('name'), locale, query})
      });
      if (response.status === 401) return setState('auth');
      if (!response.ok) return setState('error');
      setState('saved');
      event.currentTarget.reset();
    } catch {
      setState('error');
    }
  }

  return (
    <form className="save-search-form" onSubmit={submit}>
      <input name="name" required maxLength={100} placeholder={labels.name} />
      <button className="button" type="submit" disabled={state === 'saving'}>
        {state === 'saved' ? labels.saved : labels.action}
      </button>
      {state === 'auth' && <small>{labels.auth}</small>}
      {state === 'error' && <small>{labels.error}</small>}
    </form>
  );
}
