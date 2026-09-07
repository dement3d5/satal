import {describe, expect, it} from 'vitest';

import {createReviewSchema, publicReputationQuerySchema} from './contracts';

describe('reputation contracts', () => {
  it('accepts a bounded rating and optional meaningful review', () => {
    expect(createReviewSchema.parse({rating: 5, body: '  Great communication.  '})).toEqual({
      rating: 5,
      body: 'Great communication.'
    });
    expect(createReviewSchema.parse({rating: 4})).toEqual({rating: 4});
  });

  it('rejects invalid ratings and low-information review text', () => {
    expect(() => createReviewSchema.parse({rating: 0})).toThrow();
    expect(() => createReviewSchema.parse({rating: 6})).toThrow();
    expect(() => createReviewSchema.parse({rating: 5, body: 'Too short'})).toThrow();
  });

  it('bounds public review pages', () => {
    expect(publicReputationQuerySchema.parse({})).toEqual({limit: 20});
    expect(() => publicReputationQuerySchema.parse({limit: 51})).toThrow();
  });
});
