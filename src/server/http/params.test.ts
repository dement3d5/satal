import {describe, expect, it} from 'vitest';

import {parseLocale, parseUuid} from './params';

describe('HTTP parameter validation', () => {
  it('defaults locale to Azerbaijani and supports all contract locales', () => {
    expect(parseLocale(null)).toBe('az');
    expect(parseLocale('ru')).toBe('ru');
    expect(parseLocale('en')).toBe('en');
  });

  it('turns invalid locale and UUID values into safe client errors', () => {
    expect(() => parseLocale('de')).toThrow(/locale/i);
    expect(() => parseUuid('not-a-uuid', 'draftId')).toThrow(/draftId/i);
  });
});
