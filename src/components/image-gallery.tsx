'use client';

import Image from 'next/image';
import {useState} from 'react';

interface ImageGalleryLabels {
  empty: string;
  previous: string;
  next: string;
  count: string;
}

export function ImageGallery({
  urls,
  alt,
  labels,
  className = '',
  priority = false
}: {
  urls: string[];
  alt: string;
  labels: ImageGalleryLabels;
  className?: string;
  priority?: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const visibleIndex = selectedIndex < urls.length ? selectedIndex : 0;
  const selectedUrl = urls[visibleIndex] ?? null;

  function selectRelative(offset: number) {
    setSelectedIndex((current) => (current + offset + urls.length) % urls.length);
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
