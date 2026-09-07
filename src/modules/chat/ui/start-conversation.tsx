'use client';

import {useRouter} from 'next/navigation';
import {FormEvent, useState} from 'react';

import type {AppLocale} from '@/i18n/routing';

interface StartConversationLabels {
  action: string;
  title: string;
  placeholder: string;
  send: string;
  sending: string;
  signIn: string;
  unavailable: string;
  rateLimit: string;
  error: string;
  safety: string;
}

export function StartConversation({
  listingId,
  locale,
  labels
}: {
  listingId: string;
  locale: AppLocale;
  labels: StartConversationLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || state === 'sending') return;
    setState('sending');
    setMessage('');
    try {
      const response = await fetch('/api/v1/conversations', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({listingId, clientMessageId: crypto.randomUUID(), body})
      });
      const result = (await response.json()) as {
        data?: {conversationId: string};
        error?: {code?: string};
      };
      if (response.status === 401) return setMessage(labels.signIn);
      if (response.status === 403 || response.status === 404 || response.status === 409)
        return setMessage(labels.unavailable);
      if (response.status === 429) return setMessage(labels.rateLimit);
      if (!response.ok || !result.data) return setMessage(labels.error);
      router.push(`/${locale}/messages?conversation=${result.data.conversationId}`);
    } catch {
      setMessage(labels.error);
    } finally {
      setState('idle');
    }
  }

  return (
    <div className="start-conversation">
      <button className="button button-secondary" type="button" onClick={() => setOpen(!open)}>
        {labels.action}
      </button>
      {open && (
        <form onSubmit={submit}>
          <label htmlFor={`conversation-${listingId}`}>{labels.title}</label>
          <textarea
            id={`conversation-${listingId}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={labels.placeholder}
            minLength={1}
            maxLength={2000}
            required
          />
          <small>{labels.safety}</small>
          <button className="button button-primary" type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? labels.sending : labels.send}
          </button>
          {message && <p aria-live="polite">{message}</p>}
        </form>
      )}
    </div>
  );
}
