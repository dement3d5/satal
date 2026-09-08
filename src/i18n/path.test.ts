import {describe, expect, it} from 'vitest';

import {localizePathname} from './path';

describe('localized navigation paths', () => {
  it('keeps the current route while switching locale', () => {
    expect(localizePathname('/ru/messages', 'az')).toBe('/az/messages');
    expect(localizePathname('/en/listings/example', 'ru')).toBe('/ru/listings/example');
  });

  it('adds a locale to an unlocalized path', () => {
    expect(localizePathname('/', 'en')).toBe('/en');
    expect(localizePathname('/account', 'az')).toBe('/az/account');
  });
});
