import {describe, expect, it} from 'vitest';

import {emailSignInSchema, emailSignUpSchema, updateProfileSchema} from './contracts';

describe('identity contracts', () => {
  it('normalizes identity input and enforces bounded passwords', () => {
    expect(
      emailSignUpSchema.parse({
        name: '  Aysel  ',
        email: 'AYSEL@EXAMPLE.COM ',
        password: 'long-password'
      })
    ).toEqual({name: 'Aysel', email: 'aysel@example.com', password: 'long-password'});
    expect(emailSignInSchema.parse({email: 'USER@example.com', password: 'x'})).toEqual({
      email: 'user@example.com',
      password: 'x',
      rememberMe: true
    });
  });

  it('rejects short passwords and blank profile names', () => {
    expect(() =>
      emailSignUpSchema.parse({name: 'Aysel', email: 'a@example.com', password: 'short'})
    ).toThrow();
    expect(() => updateProfileSchema.parse({name: ' '})).toThrow();
  });
});
