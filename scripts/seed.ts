import {sql} from 'drizzle-orm';

import {getDatabase} from '../src/server/db/client';
import {supportedLocale} from '../src/server/db/schema';

async function seed(): Promise<void> {
  const database = getDatabase();

  await database
    .insert(supportedLocale)
    .values([
      {code: 'az', isDefault: true},
      {code: 'ru', isDefault: false},
      {code: 'en', isDefault: false}
    ])
    .onConflictDoUpdate({
      target: supportedLocale.code,
      set: {enabled: true, updatedAt: sql`now()`}
    });
}

seed()
  .then(() => {
    process.stdout.write('Foundation seed completed.\n');
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`Foundation seed failed: ${String(error)}\n`);
    process.exit(1);
  });
