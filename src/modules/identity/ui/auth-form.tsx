'use client';

import {useState, type FormEvent} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';

import type {AppLocale} from '@/i18n/routing';

interface AuthLabels {
  signIn: string;
  signUp: string;
  name: string;
  email: string;
  password: string;
  passwordHint: string;
  submitSignIn: string;
  submitSignUp: string;
  pending: string;
  invalid: string;
  duplicate: string;
  genericError: string;
  phoneTitle: string;
  phoneUnavailable: string;
}

export function AuthForm({locale, labels}: {locale: AppLocale; labels: AuthLabels}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') ?? '')
        .trim()
        .toLowerCase(),
      password: String(form.get('password') ?? ''),
      ...(mode === 'sign-up' ? {name: String(form.get('name') ?? '').trim()} : {}),
      rememberMe: true
    };
    try {
      const response = await fetch(
        `/api/auth/${mode === 'sign-up' ? 'sign-up' : 'sign-in'}/email`,
        {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(payload)
        }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {code?: string} | null;
        setMessage(
          body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
            ? labels.duplicate
            : response.status === 401
              ? labels.invalid
              : labels.genericError
        );
        return;
      }
      const requested = searchParams.get('returnTo');
      const destination = requested?.startsWith(`/${locale}/`) ? requested : `/${locale}/account`;
      router.push(destination);
      router.refresh();
    } catch {
      setMessage(labels.genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sign-in'}
          onClick={() => setMode('sign-in')}
        >
          {labels.signIn}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sign-up'}
          onClick={() => setMode('sign-up')}
        >
          {labels.signUp}
        </button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'sign-up' && (
          <label>
            {labels.name}
            <input name="name" required minLength={2} maxLength={120} autoComplete="name" />
          </label>
        )}
        <label>
          {labels.email}
          <input name="email" required type="email" maxLength={320} autoComplete="email" />
        </label>
        <label>
          {labels.password}
          <input
            name="password"
            required
            type="password"
            minLength={mode === 'sign-up' ? 10 : 1}
            maxLength={128}
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          />
          {mode === 'sign-up' && <small>{labels.passwordHint}</small>}
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending
            ? labels.pending
            : mode === 'sign-up'
              ? labels.submitSignUp
              : labels.submitSignIn}
        </button>
        {message && (
          <p className="auth-error" role="alert">
            {message}
          </p>
        )}
      </form>
      <aside className="auth-phone-note">
        <strong>{labels.phoneTitle}</strong>
        <p>{labels.phoneUnavailable}</p>
      </aside>
    </div>
  );
}
