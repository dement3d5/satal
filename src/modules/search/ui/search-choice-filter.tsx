'use client';

import {useMemo, useState} from 'react';

import type {AttributeOptionContract} from '@/modules/catalog/contracts';

export function SearchChoiceFilter({
  name,
  options,
  selected,
  anyLabel,
  searchPlaceholder,
  emptyLabel,
  mode = 'pills'
}: {
  name: string;
  options: AttributeOptionContract[];
  selected: string | null;
  anyLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  mode?: 'pills' | 'list' | 'body';
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalized))
      : options;
  }, [options, query]);
  const searchable = mode === 'list' || options.length > 12;

  return (
    <div className={`search-option-picker is-${mode}`}>
      {searchable && (
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
      )}
      <div className="search-option-grid">
        {!query && (
          <Choice defaultChecked={!selected} label={anyLabel} mode={mode} name={name} value="" />
        )}
        {filtered.map((option) => (
          <Choice
            defaultChecked={selected === option.id}
            key={option.id}
            label={option.label}
            mode={mode}
            name={name}
            optionKey={option.key}
            value={option.id}
          />
        ))}
      </div>
      {!filtered.length && <p className="search-option-empty">{emptyLabel}</p>}
    </div>
  );
}

export function SearchBooleanFilter({
  name,
  selected,
  labels
}: {
  name: string;
  selected: string | null;
  labels: {any: string; yes: string; no: string};
}) {
  return (
    <div className="search-boolean-picker">
      <Choice defaultChecked={!selected} label={labels.any} mode="pills" name={name} value="" />
      <Choice
        defaultChecked={selected === 'true'}
        label={labels.yes}
        mode="pills"
        name={name}
        value="true"
      />
      <Choice
        defaultChecked={selected === 'false'}
        label={labels.no}
        mode="pills"
        name={name}
        value="false"
      />
    </div>
  );
}

function Choice({
  name,
  value,
  label,
  defaultChecked,
  mode,
  optionKey
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
  mode: 'pills' | 'list' | 'body';
  optionKey?: string;
}) {
  return (
    <label className="search-option-choice">
      <input defaultChecked={defaultChecked} name={name} type="radio" value={value} />
      <span>
        {mode === 'body' && optionKey && <BodyStyleIcon kind={optionKey} />}
        <strong>{label}</strong>
        {mode !== 'body' && <CheckIcon />}
      </span>
    </label>
  );
}

function BodyStyleIcon({kind}: {kind: string}) {
  const outlines: Record<string, string> = {
    sedan: 'M10 31h10l10-13h40l17 13h23v7H10zM35 19l-8 12M66 19l15 12',
    suv: 'M9 31h9l7-16h55l13 16h18v7H9zM32 16l-7 15M72 16l14 15',
    hatchback: 'M10 31h10l9-14h43l17 4 10 10h11v7H10zM35 18l-8 13M72 18l19 13',
    coupe: 'M10 31h12l17-14h33l19 14h19v7H10zM44 18 29 31M68 18l17 13',
    wagon: 'M9 31h10l10-15h53l13 15h16v7H9zM35 17l-9 14M76 17l13 14',
    minivan: 'M9 31h9l9-17h59l11 17h14v7H9zM34 15l-9 16M82 15l10 16',
    pickup: 'M9 31h10l10-14h31l12 14h39v7H9zM35 18l-9 13M64 23h39v8',
    liftback: 'M10 31h10l13-14h39l25 14h13v7H10zM39 18 27 31M69 18l20 13',
    cabriolet: 'M10 31h14l9-9h34l13 9h30v7H10zM34 22h31M73 21l9 10',
    roadster: 'M10 31h14l12-10h27l15 10h32v7H10zM38 22h23M69 22l10 9'
  };
  return (
    <svg aria-hidden="true" className="search-body-icon" viewBox="0 0 120 48">
      <path d={outlines[kind] ?? outlines.sedan} />
      <circle cx="30" cy="37" r="6" />
      <circle cx="91" cy="37" r="6" />
    </svg>
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="search-choice-check" viewBox="0 0 24 24">
      <path d="m7 12 3 3 7-7" />
    </svg>
  );
}
