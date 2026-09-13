import {cleanupMediaRetention, processNextMediaBatch} from '../src/modules/media/processor';
import {getDatabase} from '../src/server/db/client';
import {loadLocalEnvironment} from './support/load-environment';

loadLocalEnvironment();

async function main() {
  const db = getDatabase();
  const processed = await processNextMediaBatch(db, 25);
  const retention = await cleanupMediaRetention(db);
  console.log(JSON.stringify({processed, retention}));
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Media worker failed');
    process.exit(1);
  });
