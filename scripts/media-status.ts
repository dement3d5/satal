import {getMediaWorkerHealth} from '../src/modules/media/processor';
import {getDatabase} from '../src/server/db/client';
import {loadLocalEnvironment} from './support/load-environment';

loadLocalEnvironment();

getMediaWorkerHealth(getDatabase())
  .then((health) => {
    console.log(JSON.stringify(health));
    process.exit(health.healthy ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Media health check failed');
    process.exit(1);
  });
