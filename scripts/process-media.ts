import {getDatabase} from '../src/server/db/client';
import {processNextMediaBatch} from '../src/modules/media/processor';

async function main() {
  const result = await processNextMediaBatch(getDatabase(), 25);
  console.log(JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Media worker failed');
    process.exit(1);
  });
