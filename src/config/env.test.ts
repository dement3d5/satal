import {describe, expect, it} from 'vitest';

import {parseServerEnvironment} from './env';

const validEnvironment = {
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://satal:satal@localhost:5432/satal',
  AUTH_SECRET: 'a-development-only-secret-with-32-chars',
  SMS_PROVIDER: 'disabled',
  EMAIL_PROVIDER: 'disabled',
  OBJECT_STORAGE_PROVIDER: 'local',
  SEARCH_PROVIDER: 'postgres'
};

describe('parseServerEnvironment', () => {
  it('accepts an explicit safe local configuration', () => {
    expect(parseServerEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'test',
      OBJECT_STORAGE_PROVIDER: 'local'
    });
  });

  it('rejects short authentication secrets', () => {
    expect(() => parseServerEnvironment({...validEnvironment, AUTH_SECRET: 'too-short'})).toThrow();
  });

  it('rejects non-PostgreSQL database URLs', () => {
    expect(() =>
      parseServerEnvironment({...validEnvironment, DATABASE_URL: 'mysql://localhost/satal'})
    ).toThrow();
  });

  it('requires explicit Typesense credentials when selected', () => {
    expect(() =>
      parseServerEnvironment({...validEnvironment, SEARCH_PROVIDER: 'typesense'})
    ).toThrow();
    expect(
      parseServerEnvironment({
        ...validEnvironment,
        SEARCH_PROVIDER: 'typesense',
        TYPESENSE_URL: 'https://search.example.test',
        TYPESENSE_API_KEY: 'typesense-test-key'
      })
    ).toMatchObject({SEARCH_PROVIDER: 'typesense'});
  });
});
