'use client';

import {useEffect, useState} from 'react';

export function FavoriteButton({
  listingId,
  labels
}: {
  listingId: string;
  labels: {add: string; remove: string; auth: string; error: string};
}) {
  const [favorite, setFavorite] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/favorites/${listingId}`, {cache: 'no-store'})
      .then(async (response) => {
        if (response.status === 401) return {auth: true} as const;
        if (!response.ok) throw new Error('favorite status failed');
        return (await response.json()) as {data: {favorite: boolean}};
      })
      .then((result) => {
        if (!active) return;
        if ('auth' in result) setStatus('auth');
        else {
          setFavorite(result.data.favorite);
          setStatus('ready');
        }
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [listingId]);

  async function toggle() {
    setStatus('loading');
    try {
      const response = await fetch(`/api/v1/favorites/${listingId}`, {
        method: favorite ? 'DELETE' : 'PUT'
      });
      if (response.status === 401) return setStatus('auth');
      if (!response.ok) throw new Error('favorite mutation failed');
      setFavorite(!favorite);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="favorite-action">
      <button className="button" type="button" disabled={status === 'loading'} onClick={toggle}>
        <span aria-hidden="true">{favorite ? '♥' : '♡'}</span>{' '}
        {favorite ? labels.remove : labels.add}
      </button>
      {status === 'auth' && <small>{labels.auth}</small>}
      {status === 'error' && <small>{labels.error}</small>}
    </div>
  );
}
