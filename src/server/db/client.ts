import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {getServerEnvironment} from '@/config/env';

import * as schema from './schema';

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

const globalDatabase = globalThis as typeof globalThis & {
  satalDatabase?: DatabaseClient;
};

function createDatabaseClient() {
  const environment = getServerEnvironment();
  const client = postgres(environment.DATABASE_URL, {
    max: environment.NODE_ENV === 'production' ? 10 : 3,
    prepare: false,
    idle_timeout: 20
  });

  return drizzle(client, {schema});
}

export function getDatabase(): DatabaseClient {
  globalDatabase.satalDatabase ??= createDatabaseClient();
  return globalDatabase.satalDatabase;
}
