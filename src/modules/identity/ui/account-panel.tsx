'use client';

import {useEffect, useState, type FormEvent} from 'react';

import type {AppLocale} from '@/i18n/routing';
import {authClient} from '@/modules/identity/auth-client';

interface Profile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  createdAt: string;
  staffRoles: Array<'moderator' | 'admin' | 'owner'>;
}

interface ReputationSummary {
  average: number;
  count: number;
}

interface OwnedListing {
  id: string;
  title: string;
  status: 'pending_review' | 'active' | 'sold' | 'expired' | 'removed' | 'rejected';
  updatedAt: string;
  categoryName: string;
  locationName: string;
  reasonCode: string | null;
  publicExplanation: string | null;
  appealId: string | null;
  appealStatus: 'open' | 'accepted' | 'rejected' | null;
  appealPublicResponse: string | null;
}

interface AccountLabels {
  loading: string;
  signIn: string;
  error: string;
  overview: string;
  memberSince: string;
  publicProfile: string;
  createListing: string;
  totalListings: string;
  activeListings: string;
  reviewingListings: string;
  rating: string;
  noRating: string;
  reviews: string;
  quickActions: string;
  messages: string;
  saved: string;
  notifications: string;
  personalDetails: string;
  personalDetailsHint: string;
  name: string;
  email: string;
  phone: string;
  verified: string;
  emailUnverified: string;
  phoneUnverified: string;
  notAdded: string;
  save: string;
  savedMessage: string;
  saveError: string;
  security: string;
  securityHint: string;
  currentSession: string;
  signOut: string;
  switchAccount: string;
  signingOut: string;
  signOutError: string;
  staffAccess: string;
  moderation: string;
  roleLabels: Record<Profile['staffRoles'][number], string>;
  listingsTitle: string;
  listingsEmpty: string;
  listingOpen: string;
  appealAction: string;
  appealTitle: string;
  appealHint: string;
  appealSubmit: string;
  appealSubmitting: string;
  appealOpen: string;
  appealAccepted: string;
  appealRejected: string;
  appealResponse: string;
  appealError: string;
  statuses: Record<OwnedListing['status'], string>;
}

export function AccountPanel({locale, labels}: {locale: AppLocale; labels: AccountLabels}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [listings, setListings] = useState<OwnedListing[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [pendingAppeal, setPendingAppeal] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [profileResponse, listingsResponse] = await Promise.all([
          fetch('/api/v1/profile', {cache: 'no-store', credentials: 'same-origin'}),
          fetch(`/api/v1/profile/listings?locale=${locale}`, {
            cache: 'no-store',
            credentials: 'same-origin'
          })
        ]);
        if (profileResponse.status === 401) return setState('auth');
        if (!profileResponse.ok || !listingsResponse.ok) throw new Error('account failed');
        const [profileBody, listingsBody] = (await Promise.all([
          profileResponse.json(),
          listingsResponse.json()
        ])) as [{data: Profile}, {data: OwnedListing[]}];
        setProfile(profileBody.data);
        setListings(listingsBody.data);
        setState('ready');

        const reputationResponse = await fetch(
          `/api/v1/users/${profileBody.data.id}/reputation?limit=1`,
          {cache: 'no-store'}
        );
        if (reputationResponse.ok) {
          const body = (await reputationResponse.json()) as {data: {summary: ReputationSummary}};
          setReputation(body.data.summary);
        }
      } catch {
        setState('error');
      }
    })();
  }, [locale]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const name = String(new FormData(event.currentTarget).get('name') ?? '');
    try {
      const response = await fetch('/api/v1/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name})
      });
      if (!response.ok) return setMessage(labels.saveError);
      const body = (await response.json()) as {data: {name: string}};
      setProfile((current) => (current ? {...current, name: body.data.name} : current));
      setMessage(labels.savedMessage);
    } catch {
      setMessage(labels.saveError);
    }
  }

  async function signOut(destination: 'home' | 'switch') {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('sign out failed');

      const sessionCheck = await fetch('/api/v1/profile', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (sessionCheck.status !== 401) throw new Error('session is still active');

      const nextUrl = destination === 'switch' ? `/${locale}/auth?signedOut=1` : `/${locale}`;
      window.location.replace(nextUrl);
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  async function appeal(event: FormEvent<HTMLFormElement>, listingId: string) {
    event.preventDefault();
    const statement = String(new FormData(event.currentTarget).get('statement') ?? '');
    setPendingAppeal(listingId);
    setAppealError(null);
    try {
      const response = await fetch(`/api/v1/listings/${listingId}/appeals`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({statement})
      });
      if (!response.ok) return setAppealError(listingId);
      const body = (await response.json()) as {
        data: {id: string; status: 'open' | 'accepted' | 'rejected'};
      };
      setListings((current) =>
        current.map((item) =>
          item.id === listingId
            ? {
                ...item,
                appealId: body.data.id,
                appealStatus: body.data.status,
                appealPublicResponse: null
              }
            : item
        )
      );
    } catch {
      setAppealError(listingId);
    } finally {
      setPendingAppeal(null);
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

  const activeCount = listings.filter((item) => item.status === 'active').length;
  const reviewCount = listings.filter((item) => item.status === 'pending_review').length;
  const memberSince = labels.memberSince.replace(
    '{date}',
    new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(profile.createdAt))
  );
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase(locale))
    .join('');

  return (
    <div className="account-panel">
      <section className="account-profile-hero" aria-labelledby="account-overview-title">
        <div className="account-profile-main">
          <div className="account-avatar" aria-hidden="true">
            {initials || 'S'}
          </div>
          <div>
            <p className="eyebrow">{labels.overview}</p>
            <h2 id="account-overview-title">{profile.name}</h2>
            <p>{memberSince}</p>
            <div className="account-role-list">
              {profile.staffRoles.map((role) => (
                <span key={role}>{labels.roleLabels[role]}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="account-profile-actions">
          <a className="button" href={`/${locale}/users/${profile.id}`}>
            {labels.publicProfile}
          </a>
          <a className="button button-primary" href={`/${locale}/sell`}>
            {labels.createListing}
          </a>
        </div>
      </section>

      <section className="account-summary-grid" aria-label={labels.overview}>
        <article>
          <strong>{listings.length}</strong>
          <span>{labels.totalListings}</span>
        </article>
        <article>
          <strong>{activeCount}</strong>
          <span>{labels.activeListings}</span>
        </article>
        <article>
          <strong>{reviewCount}</strong>
          <span>{labels.reviewingListings}</span>
        </article>
        <article>
          <strong>
            {reputation && reputation.count > 0 ? `${reputation.average.toFixed(1)} ★` : '—'}
          </strong>
          <span>
            {reputation && reputation.count > 0
              ? `${labels.rating} · ${labels.reviews}: ${reputation.count}`
              : labels.noRating}
          </span>
        </article>
      </section>

      <nav className="account-shortcuts" aria-label={labels.quickActions}>
        <a href={`/${locale}/messages`}>{labels.messages}</a>
        <a href={`/${locale}/saved`}>{labels.saved}</a>
        <a href={`/${locale}/notifications`}>{labels.notifications}</a>
        {profile.staffRoles.length > 0 && <a href={`/${locale}/moderation`}>{labels.moderation}</a>}
      </nav>

      <div className="account-settings-grid">
        <form className="account-card account-profile-form auth-form" onSubmit={save}>
          <div className="account-card-heading">
            <h2>{labels.personalDetails}</h2>
            <p>{labels.personalDetailsHint}</p>
          </div>
          <label>
            {labels.name}
            <input name="name" defaultValue={profile.name} required minLength={2} maxLength={120} />
          </label>
          <label>
            {labels.email}
            <input value={profile.email} readOnly />
          </label>
          <small className={profile.emailVerified ? 'is-verified' : undefined}>
            {profile.emailVerified ? labels.verified : labels.emailUnverified}
          </small>
          <label>
            {labels.phone}
            <input value={profile.phoneNumber ?? labels.notAdded} readOnly />
          </label>
          <small className={profile.phoneNumberVerified ? 'is-verified' : undefined}>
            {profile.phoneNumberVerified ? labels.verified : labels.phoneUnverified}
          </small>
          <button className="button button-primary" type="submit">
            {labels.save}
          </button>
          {message && <p aria-live="polite">{message}</p>}
        </form>

        <aside className="account-card account-security-card">
          <div className="account-card-heading">
            <h2>{labels.security}</h2>
            <p>{labels.securityHint}</p>
          </div>
          <div className="account-current-session">
            <span>{labels.currentSession}</span>
            <strong>{profile.email}</strong>
          </div>
          {profile.staffRoles.length > 0 && (
            <div className="account-staff-access">
              <span>{labels.staffAccess}</span>
              <strong>
                {profile.staffRoles.map((role) => labels.roleLabels[role]).join(', ')}
              </strong>
            </div>
          )}
          <div className="account-session-actions">
            <button
              className="button"
              type="button"
              disabled={signingOut}
              onClick={() => signOut('home')}
            >
              {signingOut ? labels.signingOut : labels.signOut}
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={signingOut}
              onClick={() => signOut('switch')}
            >
              {labels.switchAccount}
            </button>
          </div>
          {signOutError && (
            <p className="notice notice-error" role="alert">
              {labels.signOutError}
            </p>
          )}
        </aside>
      </div>

      <section className="account-listings" aria-labelledby="account-listings-title">
        <h2 id="account-listings-title">{labels.listingsTitle}</h2>
        {listings.length === 0 ? (
          <p>{labels.listingsEmpty}</p>
        ) : (
          <div className="account-listing-grid">
            {listings.map((item) => (
              <article key={item.id}>
                <div>
                  <span>
                    {item.categoryName} · {item.locationName}
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <strong className={`listing-status listing-status-${item.status}`}>
                  {labels.statuses[item.status]}
                </strong>
                {item.status === 'rejected' && item.publicExplanation && (
                  <p className="notice notice-error">{item.publicExplanation}</p>
                )}
                {item.appealPublicResponse && (
                  <p className="notice">
                    <strong>{labels.appealResponse}</strong> {item.appealPublicResponse}
                  </p>
                )}
                {item.status === 'rejected' && item.appealStatus === null && (
                  <details className="listing-appeal">
                    <summary>{labels.appealAction}</summary>
                    <form onSubmit={(event) => appeal(event, item.id)}>
                      <label>
                        {labels.appealTitle}
                        <textarea
                          name="statement"
                          required
                          minLength={20}
                          maxLength={1000}
                          placeholder={labels.appealHint}
                        />
                      </label>
                      <button className="button" disabled={pendingAppeal === item.id} type="submit">
                        {pendingAppeal === item.id ? labels.appealSubmitting : labels.appealSubmit}
                      </button>
                    </form>
                  </details>
                )}
                {item.appealStatus === 'open' && (
                  <p className="notice notice-warm">{labels.appealOpen}</p>
                )}
                {item.appealStatus === 'accepted' && (
                  <p className="notice notice-success">{labels.appealAccepted}</p>
                )}
                {item.appealStatus === 'rejected' && (
                  <p className="notice notice-error">{labels.appealRejected}</p>
                )}
                {appealError === item.id && (
                  <p className="notice notice-error" role="alert">
                    {labels.appealError}
                  </p>
                )}
                {item.status === 'active' && (
                  <a href={`/${locale}/listings/${item.id}`}>{labels.listingOpen}</a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
