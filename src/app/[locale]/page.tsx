import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/az" aria-label="Satal">
          Satal
        </Link>
        <nav aria-label={t('languageNavigation')}>
          <Link href="/az">AZ</Link>
          <Link href="/ru">RU</Link>
          <Link href="/en">EN</Link>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 id="hero-title">{t('title')}</h1>
        <p>{t('description')}</p>
        <form className="search" role="search">
          <label className="sr-only" htmlFor="marketplace-search">
            {t('searchLabel')}
          </label>
          <input id="marketplace-search" name="q" placeholder={t('searchPlaceholder')} />
          <button type="submit">{t('searchAction')}</button>
        </form>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <h2 id="foundation-title">{t('foundationTitle')}</h2>
        <p>{t('foundationDescription')}</p>
      </section>
    </main>
  );
}
