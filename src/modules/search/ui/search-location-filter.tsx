'use client';

import {useMemo, useState} from 'react';

import type {LocationContract} from '@/modules/geography/contracts';

interface LocationChoice {
  id: string;
  name: string;
  kind: LocationContract['kind'];
}

export function SearchLocationFilter({
  groups,
  selected,
  searchPlaceholder,
  emptyLabel
}: {
  groups: Array<{label: string; options: LocationChoice[]}>;
  selected: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState('');
  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          option.name.toLocaleLowerCase().includes(normalized)
        )
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  return (
    <div className="search-location-picker">
      <label className="search-option-query">
        <SearchIcon />
        <span className="sr-only">{searchPlaceholder}</span>
        <input
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={query}
        />
      </label>
      <div className="search-location-groups">
        {visibleGroups.map((group) => (
          <section key={group.label}>
            <h3>{group.label}</h3>
            <div className="search-location-options">
              {group.options.map((option) => (
                <label className="search-location-choice" key={option.id}>
                  <input
                    defaultChecked={selected === option.id}
                    name="locationId"
                    type="radio"
                    value={option.id}
                  />
                  <span>
                    {option.kind === 'metro' ? <MetroIcon /> : <PinIcon />}
                    <strong>{option.name}</strong>
                    <CheckIcon />
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!visibleGroups.length && <p className="search-option-empty">{emptyLabel}</p>}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function MetroIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 17h10l-1-10H8L7 17Zm2 0-2 4m8-4 2 4M9 11h6M10 7l2-4 2 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="search-choice-check" viewBox="0 0 24 24">
      <path d="m7 12 3 3 7-7" />
    </svg>
  );
}
