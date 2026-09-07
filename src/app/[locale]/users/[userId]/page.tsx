import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {getPublicReputation} from '@/modules/reputation/service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {parseUuid} from '@/server/http/params';

type PageProps = {params: Promise<{locale: AppLocale; userId: string}>};

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {userId: rawUserId} = await params;
  try {
    const result = await getPublicReputation(getDatabase(), parseUuid(rawUserId, 'userId'), {
      limit: 1
    });
    return {title: `${result.profile.name} — Satal`};
  } catch {
    return {title: 'Satal'};
  }
}

export default async function PublicUserPage({params}: PageProps) {
  const [{locale, userId: rawUserId}, t] = await Promise.all([
    params,
    getTranslations('reputation')
  ]);
  let result;
  try {
    result = await getPublicReputation(getDatabase(), parseUuid(rawUserId, 'userId'), {limit: 20});
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <main className="page-shell reputation-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        accountLabel={t('accountLink')}
      />
      <header className="reputation-profile-card">
        <p className="eyebrow">SATAL</p>
        <h1>{result.profile.name}</h1>
        <p>
          {t('memberSince', {
            date: new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(
              new Date(result.profile.createdAt)
            )
          })}
        </p>
        <strong className="reputation-score">
          {result.summary.count > 0
            ? `${result.summary.average.toFixed(1)} ★ · ${t('reviewCount', {count: result.summary.count})}`
            : t('noRating')}
        </strong>
      </header>
      <section className="reputation-reviews" aria-labelledby="reputation-reviews-title">
        <h2 id="reputation-reviews-title">{t('reviewsTitle')}</h2>
        {result.reviews.length === 0 ? (
          <p className="listing-empty">{t('reviewsEmpty')}</p>
        ) : (
          result.reviews.map((review) => (
            <article key={review.id}>
              <div>
                <strong>{review.authorName}</strong>
                <span aria-label={t('ratingLabel', {rating: review.rating})}>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </span>
              </div>
              {review.body && <p>{review.body}</p>}
              <small>
                {new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(
                  new Date(review.createdAt)
                )}
              </small>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
