'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useEffect, useState, type FormEvent} from 'react';

import type {AppLocale} from '@/i18n/routing';
import type {LocationContract} from '@/modules/geography/contracts';

interface BusinessHour {
  weekday: number;
  isClosed: boolean;
  opensAtMinute: number | null;
  closesAtMinute: number | null;
}

interface ManagedShop {
  id: string;
  slug: string;
  name: string;
  description: string;
  locationId: string | null;
  publicAddress: string | null;
  publicPhone: string | null;
  status: 'active' | 'suspended' | 'closed';
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  version: number;
  role: 'owner' | 'manager' | 'listing_manager';
  logoUrl: string | null;
  coverUrl: string | null;
  businessHours: BusinessHour[];
}

interface ShopMember {
  userId: string;
  name: string;
  email: string;
  role: ManagedShop['role'];
}

interface VerificationItem {
  id: string;
  shopName: string;
  shopSlug: string;
  legalName: string;
  registryNumber: string | null;
  statement: string;
  createdAt: string;
}

type LoadState = 'loading' | 'ready' | 'auth' | 'error';

export function ShopManager() {
  const t = useTranslations('shop');
  const locale = useLocale() as AppLocale;
  const [state, setState] = useState<LoadState>('loading');
  const [shop, setShop] = useState<ManagedShop | null>(null);
  const [members, setMembers] = useState<ShopMember[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<VerificationItem[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>(defaultHours());

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/shops', {cache: 'no-store'});
      if (response.status === 401) return setState('auth');
      if (!response.ok) throw new Error('load failed');
      const body = (await response.json()) as {data: ManagedShop[]};
      const current = body.data[0] ?? null;
      setShop(current);
      setLocationId(current?.locationId ?? null);
      setHours(current?.businessHours.length ? current.businessHours : defaultHours());
      setState('ready');
      if (current?.role === 'owner') {
        const membersResponse = await fetch(`/api/v1/shops/${current.id}/members`, {
          cache: 'no-store'
        });
        if (membersResponse.ok) {
          const membersBody = (await membersResponse.json()) as {data: ShopMember[]};
          setMembers(membersBody.data);
        }
      }
      const queueResponse = await fetch('/api/v1/shop-verifications', {cache: 'no-store'});
      if (queueResponse.ok) {
        const queueBody = (await queueResponse.json()) as {data: VerificationItem[]};
        setVerificationQueue(queueBody.data);
      }
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
      publicAddress: optionalString(form.get('publicAddress')),
      publicPhone: optionalString(form.get('publicPhone')),
      locationId,
      businessHours: hours.map((item) =>
        item.isClosed
          ? {weekday: item.weekday, isClosed: true}
          : {
              weekday: item.weekday,
              isClosed: false,
              opensAtMinute: item.opensAtMinute,
              closesAtMinute: item.closesAtMinute
            }
      )
    };
    try {
      const response = await fetch(shop ? `/api/v1/shops/${shop.id}` : '/api/v1/shops', {
        method: shop ? 'PATCH' : 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(shop ? {...input, version: shop.version} : input)
      });
      const body = (await response.json()) as {data?: ManagedShop; error?: {message?: string}};
      if (!response.ok || !body.data) throw new Error(body.error?.message || t('saveError'));
      setShop(body.data);
      setMessage(t('saved'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('saveError'));
    } finally {
      setPending(false);
    }
  }

  async function uploadMedia(kind: 'logo' | 'cover', file: File | undefined) {
    if (!shop || !file) return;
    setPending(true);
    setMessage(t('mediaUploading'));
    try {
      const bytes = await file.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('');
      const authorization = await fetch(`/api/v1/shops/${shop.id}/media/${kind}`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({mediaType: file.type, bytes: file.size, sha256})
      });
      const authorizationBody = (await authorization.json()) as {
        data?: {upload: {url: string; token: string}};
        error?: {message?: string};
      };
      if (!authorization.ok || !authorizationBody.data) {
        throw new Error(authorizationBody.error?.message || t('mediaError'));
      }
      const upload = await fetch(authorizationBody.data.upload.url, {
        method: 'PUT',
        headers: {
          'content-type': file.type,
          'x-satal-upload-token': authorizationBody.data.upload.token
        },
        body: file
      });
      if (!upload.ok) throw new Error(t('mediaError'));
      setShop((current) =>
        current
          ? {...current, [kind === 'logo' ? 'logoUrl' : 'coverUrl']: URL.createObjectURL(file)}
          : current
      );
      setMessage(t('mediaQueued'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('mediaError'));
    } finally {
      setPending(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/shops/${shop.id}/members`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email: form.get('email'), role: form.get('role')})
      });
      const body = (await response.json()) as {data?: ShopMember; error?: {message?: string}};
      if (!response.ok || !body.data) throw new Error(body.error?.message || t('memberError'));
      setMembers((current) => [
        ...current.filter((item) => item.userId !== body.data!.userId),
        body.data!
      ]);
      event.currentTarget.reset();
      setMessage(t('memberSaved'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('memberError'));
    } finally {
      setPending(false);
    }
  }

  async function removeMember(member: ShopMember) {
    if (!shop || !window.confirm(t('memberRemoveConfirm', {name: member.name}))) return;
    const response = await fetch(`/api/v1/shops/${shop.id}/members/${member.userId}`, {
      method: 'DELETE'
    });
    if (response.ok)
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
    else setMessage(t('memberError'));
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop || !window.confirm(t('verificationConfirm'))) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(`/api/v1/shops/${shop.id}/verification`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          legalName: form.get('legalName'),
          registryNumber: optionalString(form.get('registryNumber')),
          statement: form.get('statement')
        })
      });
      const body = (await response.json()) as {error?: {message?: string}};
      if (!response.ok) throw new Error(body.error?.message || t('verificationError'));
      setShop((current) => (current ? {...current, verificationStatus: 'pending'} : current));
      setMessage(t('verificationSent'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('verificationError'));
    } finally {
      setPending(false);
    }
  }

  async function decideVerification(item: VerificationItem, decision: 'approve' | 'reject') {
    if (!window.confirm(t(decision === 'approve' ? 'approveConfirm' : 'rejectConfirm'))) return;
    const reviewerNote = window.prompt(t('reviewerNotePrompt'))?.trim();
    if (!reviewerNote || reviewerNote.length < 10) return;
    const response = await fetch(`/api/v1/shop-verifications/${item.id}/decision`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({decision, reviewerNote})
    });
    if (response.ok)
      setVerificationQueue((current) => current.filter((entry) => entry.id !== item.id));
    else setMessage(t('verificationDecisionError'));
  }

  if (state === 'loading') return <div className="shop-state-card">{t('loading')}</div>;
  if (state === 'auth') {
    return (
      <div className="shop-state-card">
        <h2>{t('authTitle')}</h2>
        <p>{t('authText')}</p>
        <a className="button button-primary" href={`/${locale}/auth?returnTo=/${locale}/shop`}>
          {t('signIn')}
        </a>
      </div>
    );
  }
  if (state === 'error') return <p className="notice notice-error">{t('loadError')}</p>;

  const canEdit = !shop || shop.role === 'owner' || shop.role === 'manager';
  return (
    <div className="shop-manager">
      {shop && (
        <section className="shop-manager-hero">
          {shop.coverUrl && (
            <div
              aria-hidden="true"
              className="shop-manager-cover"
              style={{backgroundImage: `url(${JSON.stringify(shop.coverUrl)})`}}
            />
          )}
          <div className="shop-manager-identity">
            <div className="shop-manager-logo">
              {shop.logoUrl ? (
                <span
                  aria-hidden="true"
                  className="shop-logo-image"
                  style={{backgroundImage: `url(${JSON.stringify(shop.logoUrl)})`}}
                />
              ) : (
                shop.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <span className={`shop-verification shop-verification-${shop.verificationStatus}`}>
                {t(`verificationStatuses.${shop.verificationStatus}`)}
              </span>
              <h2>{shop.name}</h2>
              <p>{t(`roles.${shop.role}`)}</p>
            </div>
            <a className="button" href={`/${locale}/shops/${shop.slug}`}>
              {t('openStorefront')}
            </a>
          </div>
        </section>
      )}

      {canEdit && (
        <form className="shop-form-grid" onSubmit={saveShop}>
          <section className="shop-card shop-card-main">
            <div className="shop-card-heading">
              <span>{shop ? t('profileKicker') : t('createKicker')}</span>
              <h2>{shop ? t('profileTitle') : t('createTitle')}</h2>
              <p>{shop ? t('profileText') : t('createText')}</p>
            </div>
            <label>
              {t('name')}
              <input
                defaultValue={shop?.name ?? ''}
                name="name"
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label>
              {t('profileDescription')}
              <textarea
                defaultValue={shop?.description ?? ''}
                name="description"
                maxLength={3000}
              />
            </label>
            <div className="shop-field-row">
              <label>
                {t('publicPhone')}
                <input defaultValue={shop?.publicPhone ?? ''} name="publicPhone" maxLength={32} />
              </label>
              <label>
                {t('publicAddress')}
                <input
                  defaultValue={shop?.publicAddress ?? ''}
                  name="publicAddress"
                  maxLength={300}
                />
              </label>
            </div>
            <ShopLocationPicker locale={locale} onChange={setLocationId} selectedId={locationId} />
            <BusinessHoursEditor hours={hours} onChange={setHours} />
            <button className="button button-primary" disabled={pending} type="submit">
              {pending ? t('saving') : shop ? t('save') : t('createAction')}
            </button>
          </section>
        </form>
      )}

      {shop && canEdit && (
        <section className="shop-card shop-media-card">
          <div className="shop-card-heading">
            <span>{t('mediaKicker')}</span>
            <h2>{t('mediaTitle')}</h2>
            <p>{t('mediaText')}</p>
          </div>
          <div className="shop-media-inputs">
            <label className="shop-media-input">
              <strong>{t('logo')}</strong>
              <span>{t('logoHint')}</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(event) => void uploadMedia('logo', event.target.files?.[0])}
                type="file"
              />
            </label>
            <label className="shop-media-input">
              <strong>{t('cover')}</strong>
              <span>{t('coverHint')}</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(event) => void uploadMedia('cover', event.target.files?.[0])}
                type="file"
              />
            </label>
          </div>
        </section>
      )}

      {shop?.role === 'owner' && (
        <section className="shop-card">
          <div className="shop-card-heading">
            <span>{t('teamKicker')}</span>
            <h2>{t('teamTitle')}</h2>
            <p>{t('teamText')}</p>
          </div>
          <div className="shop-member-list">
            {members.map((member) => (
              <div key={member.userId}>
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </span>
                <span>{t(`roles.${member.role}`)}</span>
                {member.role !== 'owner' && (
                  <button
                    className="button button-ghost"
                    onClick={() => void removeMember(member)}
                    type="button"
                  >
                    {t('removeMember')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <form className="shop-member-form" onSubmit={addMember}>
            <label>
              {t('memberEmail')}
              <input name="email" required type="email" />
            </label>
            <label>
              {t('memberRole')}
              <select name="role">
                <option value="manager">{t('roles.manager')}</option>
                <option value="listing_manager">{t('roles.listing_manager')}</option>
              </select>
            </label>
            <button className="button" disabled={pending} type="submit">
              {t('addMember')}
            </button>
          </form>
        </section>
      )}

      {shop &&
        canEdit &&
        shop.verificationStatus !== 'verified' &&
        shop.verificationStatus !== 'pending' && (
          <section className="shop-card shop-verification-card">
            <div className="shop-card-heading">
              <span>{t('verificationKicker')}</span>
              <h2>{t('verificationTitle')}</h2>
              <p>{t('verificationText')}</p>
            </div>
            <form onSubmit={submitVerification}>
              <label>
                {t('legalName')}
                <input name="legalName" required minLength={2} maxLength={200} />
              </label>
              <label>
                {t('registryNumber')}
                <input name="registryNumber" maxLength={120} />
              </label>
              <label>
                {t('verificationStatement')}
                <textarea name="statement" required minLength={20} maxLength={2000} />
              </label>
              <button className="button button-primary" disabled={pending} type="submit">
                {t('verificationAction')}
              </button>
            </form>
          </section>
        )}

      {verificationQueue.length > 0 && (
        <section className="shop-card shop-verification-queue">
          <div className="shop-card-heading">
            <span>{t('adminKicker')}</span>
            <h2>{t('adminTitle')}</h2>
            <p>{t('adminText')}</p>
          </div>
          {verificationQueue.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.shopName}</strong>
                <span>{item.legalName}</span>
                <small>{item.registryNumber || t('registryMissing')}</small>
              </div>
              <p>{item.statement}</p>
              <div>
                <a className="button button-ghost" href={`/${locale}/shops/${item.shopSlug}`}>
                  {t('preview')}
                </a>
                <button
                  className="button"
                  onClick={() => void decideVerification(item, 'reject')}
                  type="button"
                >
                  {t('reject')}
                </button>
                <button
                  className="button button-primary"
                  onClick={() => void decideVerification(item, 'approve')}
                  type="button"
                >
                  {t('approve')}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {message && (
        <p className="shop-toast" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function ShopLocationPicker(props: {
  locale: AppLocale;
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations('shop');
  const [trail, setTrail] = useState<LocationContract[]>([]);
  const [options, setOptions] = useState<LocationContract[]>([]);

  const load = useCallback(
    async (parentId: string | null, nextTrail: LocationContract[]) => {
      const query = new URLSearchParams({locale: props.locale});
      if (parentId) query.set('parentId', parentId);
      const response = await fetch(`/api/v1/locations?${query}`);
      if (!response.ok) return;
      const body = (await response.json()) as {data: LocationContract[]};
      setTrail(nextTrail);
      setOptions(body.data);
    },
    [props.locale]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(null, []), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function choose(item: LocationContract) {
    const nextTrail = [...trail, item];
    props.onChange(item.kind === 'country' || item.kind === 'economic_region' ? null : item.id);
    await load(item.id, nextTrail);
  }

  return (
    <fieldset className="shop-location-picker">
      <legend>{t('location')}</legend>
      <div className="shop-location-trail">
        <button onClick={() => void load(null, [])} type="button">
          {t('allAzerbaijan')}
        </button>
        {trail.map((item, index) => (
          <button
            key={item.id}
            onClick={() => void load(item.id, trail.slice(0, index + 1))}
            type="button"
          >
            {item.name}
          </button>
        ))}
      </div>
      {props.selectedId && <small>{t('locationSelected')}</small>}
      <div className="shop-location-options">
        {options.map((item) => (
          <button key={item.id} onClick={() => void choose(item)} type="button">
            {item.name}
            <span>›</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function BusinessHoursEditor({
  hours,
  onChange
}: {
  hours: BusinessHour[];
  onChange: (hours: BusinessHour[]) => void;
}) {
  const t = useTranslations('shop');
  function change(weekday: number, patch: Partial<BusinessHour>) {
    onChange(hours.map((item) => (item.weekday === weekday ? {...item, ...patch} : item)));
  }
  return (
    <fieldset className="shop-hours">
      <legend>{t('hoursTitle')}</legend>
      <p>{t('hoursText')}</p>
      {hours.map((item) => (
        <div key={item.weekday}>
          <strong>{t(`weekdays.${item.weekday}`)}</strong>
          <label>
            <input
              checked={item.isClosed}
              onChange={(event) =>
                change(item.weekday, {
                  isClosed: event.target.checked,
                  opensAtMinute: event.target.checked ? null : 540,
                  closesAtMinute: event.target.checked ? null : 1080
                })
              }
              type="checkbox"
            />
            {t('closed')}
          </label>
          {!item.isClosed && (
            <>
              <input
                aria-label={t('opens')}
                onChange={(event) =>
                  change(item.weekday, {opensAtMinute: timeToMinute(event.target.value)})
                }
                type="time"
                value={minuteToTime(item.opensAtMinute ?? 540)}
              />
              <span>—</span>
              <input
                aria-label={t('closes')}
                onChange={(event) =>
                  change(item.weekday, {closesAtMinute: timeToMinute(event.target.value)})
                }
                type="time"
                value={minuteToTime(item.closesAtMinute ?? 1080)}
              />
            </>
          )}
        </div>
      ))}
    </fieldset>
  );
}

function defaultHours(): BusinessHour[] {
  return Array.from({length: 7}, (_, weekday) => ({
    weekday,
    isClosed: weekday === 0,
    opensAtMinute: weekday === 0 ? null : 540,
    closesAtMinute: weekday === 0 ? null : 1080
  }));
}
function minuteToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function timeToMinute(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}
function optionalString(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
