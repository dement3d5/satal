'use client';

import Image from 'next/image';
import {useRef, useState} from 'react';

interface ImageGalleryLabels {
  empty: string;
  previous: string;
  next: string;
  count: string;
  openAll?: string;
  close?: string;
}

export function ImageGallery({
  urls,
  alt,
  labels,
  className = '',
  priority = false,
  layout = 'carousel'
}: {
  urls: string[];
  alt: string;
  labels: ImageGalleryLabels;
  className?: string;
  priority?: boolean;
  layout?: 'carousel' | 'collage';
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const visibleIndex = selectedIndex < urls.length ? selectedIndex : 0;
  const selectedUrl = urls[visibleIndex] ?? null;

  function selectRelative(offset: number) {
    setSelectedIndex((current) => (current + offset + urls.length) % urls.length);
  }

  function openAt(index: number) {
    setSelectedIndex(index);
    dialogRef.current?.showModal();
  }

  if (layout === 'collage') {
    const visibleUrls = urls.slice(0, 5);
    return (
      <section
        className={`media-gallery media-gallery-collage ${className}`.trim()}
        aria-label={alt}
      >
        {visibleUrls.length ? (
          <div className="media-collage-grid" data-count={Math.min(visibleUrls.length, 5)}>
            {visibleUrls.map((url, index) => (
              <button
                aria-label={`${alt} ${index + 1}`}
                className={index === 0 ? 'media-collage-primary' : undefined}
                key={url}
                onClick={() => openAt(index)}
                type="button"
              >
                <Image
                  alt={index === 0 ? alt : ''}
                  fill
                  priority={priority && index === 0}
                  sizes={
                    index === 0 ? '(max-width: 48rem) 100vw, 62vw' : '(max-width: 48rem) 45vw, 22vw'
                  }
                  src={url}
                  unoptimized
                />
                {index === visibleUrls.length - 1 && urls.length > 1 && (
                  <span className="media-collage-open">
                    <GalleryIcon />
                    {labels.openAll ?? `${urls.length}`}
                    <small>{urls.length}</small>
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="media-gallery-stage">
            <div className="media-gallery-empty">
              <span>SATAL</span>
              <strong>{labels.empty}</strong>
            </div>
          </div>
        )}

        {urls.length > 0 && (
          <dialog
            aria-label={alt}
            className="media-lightbox"
            onClick={(event) => {
              if (event.target === event.currentTarget) event.currentTarget.close();
            }}
            ref={dialogRef}
          >
            <div className="media-lightbox-panel">
              <header>
                <span>
                  {visibleIndex + 1} {labels.count} {urls.length}
                </span>
                <button
                  aria-label={labels.close ?? 'Close'}
                  onClick={() => dialogRef.current?.close()}
                  type="button"
                >
                  ×
                </button>
              </header>
              <div className="media-lightbox-stage">
                {selectedUrl && (
                  <Image
                    alt={`${alt} ${visibleIndex + 1}`}
                    fill
                    sizes="100vw"
                    src={selectedUrl}
                    unoptimized
                  />
                )}
                {urls.length > 1 && (
                  <>
                    <button
                      className="media-gallery-arrow media-gallery-arrow-previous"
                      aria-label={labels.previous}
                      onClick={() => selectRelative(-1)}
                      type="button"
                    >
                      ←
                    </button>
                    <button
                      className="media-gallery-arrow media-gallery-arrow-next"
                      aria-label={labels.next}
                      onClick={() => selectRelative(1)}
                      type="button"
                    >
                      →
                    </button>
                  </>
                )}
              </div>
              {urls.length > 1 && (
                <div className="media-lightbox-thumbnails">
                  {urls.map((url, index) => (
                    <button
                      aria-label={`${alt} ${index + 1}`}
                      aria-pressed={visibleIndex === index}
                      className={visibleIndex === index ? 'is-active' : undefined}
                      key={url}
                      onClick={() => setSelectedIndex(index)}
                      type="button"
                    >
                      <Image alt="" fill sizes="80px" src={url} unoptimized />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </dialog>
        )}
      </section>
    );
  }

  return (
    <section className={`media-gallery ${className}`.trim()} aria-label={alt}>
      <div className="media-gallery-stage">
        {selectedUrl ? (
          <Image
            alt={`${alt} ${visibleIndex + 1}`}
            fill
            priority={priority && visibleIndex === 0}
            sizes="(max-width: 62rem) 100vw, 72vw"
            src={selectedUrl}
            unoptimized
          />
        ) : (
          <div className="media-gallery-empty">
            <span>SATAL</span>
            <strong>{labels.empty}</strong>
          </div>
        )}
        {urls.length > 1 && (
          <>
            <button
              className="media-gallery-arrow media-gallery-arrow-previous"
              aria-label={labels.previous}
              onClick={() => selectRelative(-1)}
              type="button"
            >
              ←
            </button>
            <button
              className="media-gallery-arrow media-gallery-arrow-next"
              aria-label={labels.next}
              onClick={() => selectRelative(1)}
              type="button"
            >
              →
            </button>
            <span className="media-gallery-counter">
              {visibleIndex + 1} {labels.count} {urls.length}
            </span>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="media-gallery-thumbnails">
          {urls.map((url, index) => (
            <button
              aria-label={`${alt} ${index + 1}`}
              aria-pressed={visibleIndex === index}
              className={visibleIndex === index ? 'is-active' : undefined}
              key={url}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <Image alt="" fill sizes="84px" src={url} unoptimized />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function GalleryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m6.5 17 4.5-4 3 2.5 2-2 2.5 3.5" />
    </svg>
  );
}
