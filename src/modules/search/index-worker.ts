import {and, eq, isNull, lte, or, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {outboxEvent} from '@/server/db/schema';

import type {SearchGateway} from './gateway';
import {buildSearchDocument} from './projection';

const leaseDurationMs = 5 * 60_000;

export async function processNextSearchEvent(
  db: DatabaseClient,
  gateway: SearchGateway,
  workerId: string
): Promise<boolean> {
  const now = new Date();
  const leaseExpiredAt = new Date(now.getTime() - leaseDurationMs);
  const claimed = await db.transaction(async (transaction) => {
    const rows = await transaction
      .select({
        id: outboxEvent.id,
        listingId: outboxEvent.aggregateId,
        attempts: outboxEvent.attempts
      })
      .from(outboxEvent)
      .where(
        and(
          isNull(outboxEvent.processedAt),
          lte(outboxEvent.availableAt, now),
          eq(outboxEvent.aggregateType, 'listing'),
          eq(outboxEvent.eventType, 'listing.published'),
          or(isNull(outboxEvent.leasedAt), lte(outboxEvent.leasedAt, leaseExpiredAt))
        )
      )
      .orderBy(outboxEvent.occurredAt)
      .limit(1)
      .for('update', {skipLocked: true});
    const event = rows[0];
    if (!event) return null;
    await transaction
      .update(outboxEvent)
      .set({leasedAt: now, leaseOwner: workerId, attempts: sql`${outboxEvent.attempts} + 1`})
      .where(eq(outboxEvent.id, event.id));
    return event;
  });
  if (!claimed) return false;

  try {
    const document = await buildSearchDocument(db, claimed.listingId);
    if (document) await gateway.upsert(document);
    else await gateway.remove(claimed.listingId);
    await db
      .update(outboxEvent)
      .set({processedAt: new Date(), leasedAt: null, leaseOwner: null, lastError: null})
      .where(and(eq(outboxEvent.id, claimed.id), eq(outboxEvent.leaseOwner, workerId)));
  } catch (error) {
    const attempt = claimed.attempts + 1;
    const delaySeconds = Math.min(3600, 2 ** Math.min(attempt, 10));
    await db
      .update(outboxEvent)
      .set({
        availableAt: new Date(Date.now() + delaySeconds * 1000),
        leasedAt: null,
        leaseOwner: null,
        lastError: safeError(error)
      })
      .where(and(eq(outboxEvent.id, claimed.id), eq(outboxEvent.leaseOwner, workerId)));
    throw error;
  }
  return true;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown indexing error';
  return message.replace(/[\r\n]/g, ' ').slice(0, 240);
}
