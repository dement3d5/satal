import {randomUUID} from 'node:crypto';

import {processNextSearchEvent} from '../src/modules/search/index-worker';
import {configuredSearchGateway} from '../src/modules/search/search-service';
import {getDatabase} from '../src/server/db/client';
import {logger} from '../src/server/logging/logger';

const gateway = configuredSearchGateway();
const workerId = `search-${randomUUID()}`;
let processed = 0;
while (await processNextSearchEvent(getDatabase(), gateway, workerId)) processed += 1;
logger.info({processed}, 'Search outbox processing completed');
