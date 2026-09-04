'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';

import type {AppLocale} from '@/i18n/routing';
import type {PublicListingCard} from '@/modules/listings/public-listing-service';
import {formatPrice} from '@/modules/listings/ui/format';

interface SavedSearchItem {
  id: string;
  name: string;
  href: string;
  updatedAt: string;
}

interface SavedLabels {
  loading: string;
  authTitle: string;
  authText: string;
  error: string;
  searchesTitle: string;
  searchesEmpty: string;
  favoritesTitle: string;
  favoritesEmpty: string;
  remove: string;
  priceOnRequest: string;
}

export function SavedDashboard({locale, labels}: {locale: AppLocale; labels: SavedLabels}) {
  const [favorites, setFavorites] = useState<PublicListingCard[]>([]);
  const [searches, setSearches] = useState<SavedSearchItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/favorites?locale=${locale}`, {cache: 'no-store'}),
      fetch(`/api/v1/saved-searches?locale=${locale}`, {cache: 'no-store'})
    ])
      .then(async ([favoriteResponse, searchResponse]) => {
        if (favoriteResponse.status === 401 || searchResponse.status === 401) return null;
        if (!favoriteResponse.ok || !searchResponse.ok) throw new Error('saved data failed');
        const favoriteBody = (await favoriteResponse.json()) as {data: PublicListingCard[]};
        const searchBody = (await searchResponse.json()) as {data: SavedSearchItem[]};
        return {favorites: favoriteBody.data, searches: searchBody.data};
      })
      .then((result) => {
        if (!result) return setState('auth');
        setFavorites(result.favorites);
        setSearches(result.searches);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [locale]);

  async function removeFavorite(listingId: string) {
    const response = await fetch(`/api/v1/favorites/${listingId}`, {method: 'DELETE'});
    if (response.ok) setFavorites((items) => items.filter((item) => item.id !== listingId));
  }

  async function removeSearch(id: string) {
    const response = await fetch(`/api/v1/saved-searches/${id}`, {method: 'DELETE'});
    if (response.ok) setSearches((items) => items.filter((item) => item.id !== id));
  }

  if (state === 'loading') return <p>{labels.loading}</p>;
  if (state === 'auth')
    return (
      <div className="listing-empty">
        <strong>{labels.authTitle}</strong>
        <span>{labels.authText}</span>
      </div>
    );
  if (state === 'error')
    return (
      <div className="listing-empty">
        <strong>{labels.error}</strong>
      </div>
    );

  return (
    <div className="saved-dashboard">
      <section>
        <h2>{labels.searchesTitle}</h2>
        {searches.length ? (
          <div className="saved-search-list">
            {searches.map((item) => (
              <article key={item.id}>
                <Link href={item.href}>{item.name}</Link>
                <button type="button" onClick={() => removeSearch(item.id)}>
                  {labels.remove}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>{labels.searchesEmpty}</p>
        )}
      </section>
      <section>
        <h2>{labels.favoritesTitle}</h2>
        {favorites.length ? (
          <div className="listing-grid">
            {favorites.map((item) => (
              <article className="listing-card" key={item.id}>
                <Link href={`/${locale}/listings/${item.id}`}>
                  <div
                    className={item.mediaUrl ? 'listing-card-media has-photo' : 'listing-card-media'}
                    aria-hidden="true"
                    style={
                      item.mediaUrl
                        ? {backgroundImage: `url(${JSON.stringify(item.mediaUrl)})`}
                        : undefined
                    }
                  />
                  <div className="listing-card-body">
                    <strong>
                      {formatPrice(item.priceMinor, item.currency, locale, labels.priceOnRequest)}
                    </strong>
                    <h3>{item.title}</h3>
                    <p>{item.locationName}</p>
                  </div>
                </Link>
                <button
                  className="saved-remove"
                  type="button"
                  onClick={() => removeFavorite(item.id)}
                >
                  {labels.remove}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>{labels.favoritesEmpty}</p>
        )}
      </section>
    </div>
  );
}
