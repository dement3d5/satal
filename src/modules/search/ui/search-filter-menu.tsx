'use client';

import {useEffect, useRef} from 'react';

export function SearchFilterMenu({
  label,
  summary,
  children,
  className = '',
  popoverClassName = ''
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
  className?: string;
  popoverClassName?: string;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.removeAttribute('open');
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') menuRef.current?.removeAttribute('open');
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function closeSiblingMenus() {
    const menu = menuRef.current;
    if (!menu?.open) return;
    document
      .querySelectorAll<HTMLDetailsElement>('details[data-search-filter][open]')
      .forEach((candidate) => {
        if (candidate !== menu) candidate.removeAttribute('open');
      });
  }

  return (
    <details
      className={`search-filter-menu ${className}`.trim()}
      data-search-filter
      name="satal-search-filter"
      onToggle={closeSiblingMenus}
      ref={menuRef}
    >
      <summary>
        <span>
          <small>{label}</small>
          <strong>{summary}</strong>
        </span>
        <ChevronIcon />
      </summary>
      <div className={`search-filter-popover ${popoverClassName}`.trim()}>{children}</div>
    </details>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}
