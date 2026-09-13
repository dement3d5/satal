import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

import {
  cleanupMediaRetention,
  getMediaWorkerHealth,
  processNextMediaBatch
} from '../src/modules/media/processor';
import {getServerEnvironment} from '../src/config/env';
import {getDatabase} from '../src/server/db/client';
import {logger} from '../src/server/logging/logger';
import {loadLocalEnvironment} from './support/load-environment';

loadLocalEnvironment();

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => controller.abort());
}

async function main(): Promise<void> {
  const environment = getServerEnvironment();
  const db = getDatabase();
  const workerId = `media-${randomUUID()}`;
  const log = logger.child({component: 'media-worker', workerId});
  let nextHeartbeatAt = 0;
  let nextMaintenanceAt = 0;

  log.info(
    {
      batchSize: environment.MEDIA_WORKER_BATCH_SIZE,
      pollMs: environment.MEDIA_WORKER_POLL_MS
    },
    'Media worker started'
  );

  while (!controller.signal.aborted) {
    try {
      const result = await processNextMediaBatch(db, environment.MEDIA_WORKER_BATCH_SIZE, {
        workerId
      });
      if (result.claimed > 0) log.info({result}, 'Media batch completed');

      const now = Date.now();
      if (now >= nextMaintenanceAt) {
        const retention = await cleanupMediaRetention(db);
        log.info({retention}, 'Media retention sweep completed');
        nextMaintenanceAt = now + environment.MEDIA_WORKER_MAINTENANCE_MS;
      }
      if (now >= nextHeartbeatAt) {
        const health = await getMediaWorkerHealth(db);
        const method = health.healthy ? log.info.bind(log) : log.warn.bind(log);
        method({health}, 'Media worker heartbeat');
        nextHeartbeatAt = now + environment.MEDIA_WORKER_HEARTBEAT_MS;
      }
      if (result.claimed === 0) {
        await wait(environment.MEDIA_WORKER_POLL_MS, controller.signal);
      }
    } catch (error) {
      log.error({error: safeWorkerError(error)}, 'Media worker cycle failed');
      await wait(environment.MEDIA_WORKER_POLL_MS, controller.signal);
    }
  }

  log.info('Media worker stopped');
}

async function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  try {
    await delay(milliseconds, undefined, {signal});
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}

function safeWorkerError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown media worker error';
  return message.replace(/[\r\n]/g, ' ').slice(0, 240);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    logger.fatal({error: safeWorkerError(error)}, 'Media worker stopped unexpectedly');
    process.exit(1);
  });
