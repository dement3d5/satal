'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';

import type {AppLocale} from '@/i18n/routing';

interface Profile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}

interface AccountLabels {
  loading: string;
  signIn: string;
  error: string;
  name: string;
  email: string;
  phone: string;
  verified: string;
  emailUnverified: string;
  phoneUnverified: string;
  notAdded: string;
  save: string;
  saved: string;
  saveError: string;
  signOut: string;
}

export function AccountPanel({locale, labels}: {locale: AppLocale; labels: AccountLabels}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/profile', {cache: 'no-store'})
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('profile failed');
        return ((await response.json()) as {data: Profile}).data;
      })
      .then((data) => {
        if (!data) return setState('auth');
        setProfile(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '');
    try {
      const response = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name})
      });
      if (!response.ok) return setMessage(labels.saveError);
      const body = (await response.json()) as {data: {name: string}};
      setProfile((current) => (current ? {...current, name: body.data.name} : current));
      setMessage(labels.saved);
    } catch {
      setMessage(labels.saveError);
    }
  }

  async function signOut() {
    try {
      const response = await fetch('/api/auth/sign-out', {method: 'POST'});
      if (!response.ok) return setState('error');
      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setState('error');
    }
  }

  if (state === 'loading') return <p>{labels.loading}</p>;
  if (state === 'auth')
    return (
      <a className="button button-primary" href={`/${locale}/auth?returnTo=/${locale}/account`}>
        {labels.signIn}
      </a>
    );
  if (state === 'error' || !profile) return <p role="alert">{labels.error}</p>;

  return (
    <div className="account-panel">
      <form className="auth-form" onSubmit={save}>
        <label>
          {labels.name}
          <input name="name" defaultValue={profile.name} required minLength={2} maxLength={120} />
        </label>
        <label>
          {labels.email}
          <input value={profile.email} readOnly />
        </label>
        <small>{profile.emailVerified ? labels.verified : labels.emailUnverified}</small>
        <label>
          {labels.phone}
          <input value={profile.phoneNumber ?? labels.notAdded} readOnly />
        </label>
        <small>{profile.phoneNumberVerified ? labels.verified : labels.phoneUnverified}</small>
        <button className="button button-primary" type="submit">
          {labels.save}
        </button>
        {message && <p aria-live="polite">{message}</p>}
      </form>
      <button className="button" type="button" onClick={signOut}>
        {labels.signOut}
      </button>
    </div>
  );
}
