import {randomUUID} from 'node:crypto';

import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const origin = 'http://localhost:3000';
let client: ReturnType<typeof postgres> | undefined;

function sessionCookieFrom(setCookie: string): string {
  const match = setCookie.match(/(?:^|,\s*)better-auth\.session_token=([^;]+)/);
  if (!match?.[1]) throw new Error('Better Auth session cookie was not returned');
  return `better-auth.session_token=${match[1]}`;
}

integration('Better Auth session lifecycle', () => {
  beforeAll(() => {
    process.env.APP_ORIGIN = origin;
    process.env.DATABASE_URL = databaseUrl!;
    process.env.AUTH_SECRET = 'integration-session-secret-at-least-32-characters';
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('deletes the database session and expires its cookie on sign-out', async () => {
    const email = `session-${randomUUID()}@example.test`;
    const {auth} = await import('./auth');

    try {
      const signUpResponse = await auth.handler(
        new Request(`${origin}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {'content-type': 'application/json', origin},
          body: JSON.stringify({
            name: 'Session test user',
            email,
            password: 'logout-test-password'
          })
        })
      );
      expect(signUpResponse.status).toBe(200);
      const cookie = sessionCookieFrom(signUpResponse.headers.get('set-cookie') ?? '');

      await expect(auth.api.getSession({headers: new Headers({cookie})})).resolves.toMatchObject({
        user: {email}
      });

      const signOutResponse = await auth.handler(
        new Request(`${origin}/api/auth/sign-out`, {
          method: 'POST',
          headers: {'content-type': 'application/json', cookie, origin},
          body: '{}'
        })
      );
      expect(signOutResponse.status).toBe(200);
      await expect(signOutResponse.json()).resolves.toEqual({success: true});
      expect(signOutResponse.headers.get('set-cookie')).toMatch(
        /better-auth\.session_token=;.*(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i
      );
      await expect(auth.api.getSession({headers: new Headers({cookie})})).resolves.toBeNull();

      const [remaining] = await client!`
          select count(*)::int as count
          from session
          inner join "user" on "user".id = session.user_id
          where "user".email = ${email}
        `;
      expect(remaining?.count).toBe(0);
    } finally {
      await client!`delete from "user" where email = ${email}`;
    }
  }, 20_000);
});
