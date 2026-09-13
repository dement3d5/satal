import {createHash, randomUUID} from 'node:crypto';

import {eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import sharp from 'sharp';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {
  cleanupMediaRetention,
  getMediaWorkerHealth,
  MEDIA_BACKLOG_SLA_MS,
  MEDIA_QUARANTINE_CLEANUP_GRACE_MS,
  processMediaAsset
} from './processor';
import type {MediaProcessingStorage} from './storage';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

class MemoryMediaStorage implements MediaProcessingStorage {
  readonly quarantine = new Map<string, Uint8Array>();
  readonly variants = new Map<string, Uint8Array>();
  failReads = 0;
  readBarrier: Promise<void> | undefined;
  onRead: (() => void) | undefined;

  put(objectKey: string, bytes: Uint8Array): Promise<void> {
    this.quarantine.set(objectKey, bytes);
    return Promise.resolve();
  }

  async readQuarantine(objectKey: string): Promise<Uint8Array> {
    this.onRead?.();
    await this.readBarrier;
    if (this.failReads > 0) {
      this.failReads -= 1;
      throw new Error('temporary storage outage');
    }
    const bytes = this.quarantine.get(objectKey);
    if (!bytes) throw new Error('quarantine object was not found');
    return bytes;
  }

  deleteQuarantine(objectKey: string): Promise<void> {
    this.quarantine.delete(objectKey);
    return Promise.resolve();
  }

  putVariant(objectKey: string, bytes: Uint8Array): Promise<void> {
    this.variants.set(objectKey, bytes);
    return Promise.resolve();
  }

  readVariant(objectKey: string): Promise<Uint8Array> {
    const bytes = this.variants.get(objectKey);
    return bytes ? Promise.resolve(bytes) : Promise.reject(new Error('variant was not found'));
  }

  deleteVariant(objectKey: string): Promise<void> {
    this.variants.delete(objectKey);
    return Promise.resolve();
  }
}

integration('leased media processing and retention', () => {
  const ownerId = randomUUID();
  let validImage: Uint8Array;

  beforeAll(async () => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
    db = drizzle(client, {schema});
    validImage = new Uint8Array(
      await sharp({create: {width: 32, height: 18, channels: 3, background: '#176b4d'}})
        .jpeg()
        .toBuffer()
    );
    await client`
      insert into "user" (id, name, email, email_verified)
      values (${ownerId}, 'Media worker owner', ${`${ownerId}@example.test`}, true)
    `;
  });

  beforeEach(async () => {
    await db!.delete(schema.mediaAsset).where(eq(schema.mediaAsset.ownerId, ownerId));
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.mediaAsset).where(eq(schema.mediaAsset.ownerId, ownerId));
      await db.delete(schema.user).where(eq(schema.user.id, ownerId));
    }
    await client?.end();
  });

  it('retries transient storage failure and later publishes three safe variants', async () => {
    const storage = new MemoryMediaStorage();
    const assetId = randomUUID();
    const objectKey = `${ownerId}/${assetId}/original`;
    const now = new Date();
    await insertAsset(assetId, objectKey, validImage, 'quarantined', {
      processingAvailableAt: new Date(now.getTime() - 1_000)
    });
    storage.quarantine.set(objectKey, validImage);
    storage.failReads = 1;

    await expect(processMediaAsset(db!, assetId, storage)).resolves.toBe('retried');
    const [waiting] = await db!
      .select()
      .from(schema.mediaAsset)
      .where(eq(schema.mediaAsset.id, assetId));
    expect(waiting).toMatchObject({
      status: 'quarantined',
      processingAttempts: 1,
      processingLeaseOwner: null,
      lastProcessingErrorCode: 'quarantine_read_failed'
    });
    expect(waiting!.processingAvailableAt.getTime()).toBeGreaterThan(now.getTime());

    await db!
      .update(schema.mediaAsset)
      .set({processingAvailableAt: new Date(now.getTime() - 1)})
      .where(eq(schema.mediaAsset.id, assetId));
    await expect(processMediaAsset(db!, assetId, storage)).resolves.toBe('ready');
    const [ready] = await db!
      .select()
      .from(schema.mediaAsset)
      .where(eq(schema.mediaAsset.id, assetId));
    const storedVariants = await db!
      .select()
      .from(schema.mediaVariant)
      .where(eq(schema.mediaVariant.mediaAssetId, assetId));
    expect(ready).toMatchObject({
      status: 'ready',
      processingAttempts: 2,
      processingLeaseOwner: null,
      lastProcessingErrorCode: null
    });
    expect(ready!.quarantineDeletedAt).toBeInstanceOf(Date);
    expect(storedVariants.map((variant) => variant.kind).sort()).toEqual([
      'card',
      'detail',
      'thumbnail'
    ]);
    expect(storage.quarantine.has(objectKey)).toBe(false);
  });

  it('reclaims an expired lease and rejects decoder-invalid input permanently', async () => {
    const storage = new MemoryMediaStorage();
    const assetId = randomUUID();
    const objectKey = `${ownerId}/${assetId}/original`;
    const invalidImage = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    const now = new Date();
    await insertAsset(assetId, objectKey, invalidImage, 'processing', {
      processingAttempts: 1,
      processingAvailableAt: new Date(now.getTime() - 10_000),
      processingLeaseOwner: 'dead-worker',
      processingLeaseExpiresAt: new Date(now.getTime() - 1_000)
    });
    storage.quarantine.set(objectKey, invalidImage);

    await expect(processMediaAsset(db!, assetId, storage)).resolves.toBe('rejected');
    const [rejected] = await db!
      .select()
      .from(schema.mediaAsset)
      .where(eq(schema.mediaAsset.id, assetId));
    expect(rejected).toMatchObject({
      status: 'rejected',
      processingAttempts: 2,
      rejectionCode: 'decoder_failure',
      processingLeaseOwner: null
    });
    expect(storage.quarantine.has(objectKey)).toBe(false);
  });

  it('prevents a second worker from claiming an active lease', async () => {
    const storage = new MemoryMediaStorage();
    const assetId = randomUUID();
    const objectKey = `${ownerId}/${assetId}/original`;
    await insertAsset(assetId, objectKey, validImage, 'quarantined', {
      processingAvailableAt: new Date(Date.now() - 1_000)
    });
    storage.quarantine.set(objectKey, validImage);
    let releaseRead!: () => void;
    storage.readBarrier = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    storage.onRead = markReadStarted;

    const firstWorker = processMediaAsset(db!, assetId, storage);
    await readStarted;
    await expect(processMediaAsset(db!, assetId, storage)).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    releaseRead();
    await expect(firstWorker).resolves.toBe('ready');
    const [ready] = await db!
      .select()
      .from(schema.mediaAsset)
      .where(eq(schema.mediaAsset.id, assetId));
    expect(ready).toMatchObject({status: 'ready', processingAttempts: 1});
  });

  it('expires abandoned uploads, purges terminal quarantine and removes deleted variants', async () => {
    const storage = new MemoryMediaStorage();
    const now = new Date();
    const old = new Date(now.getTime() - MEDIA_QUARANTINE_CLEANUP_GRACE_MS - 1_000);
    const pendingId = randomUUID();
    const readyId = randomUUID();
    const deletedId = randomUUID();
    const pendingKey = `${ownerId}/${pendingId}/original`;
    const readyKey = `${ownerId}/${readyId}/original`;
    const deletedcodesKey = `${ownerId}/${deletedId}/original`;
    const variantKey = `${ownerId}/${deletedId}/thumbnail.webp`;

    await insertAsset(pendingId, pendingKey, validImage, 'pending_upload', {
      uploadExpiresAt: new Date(now.getTime() - 1_000)
    });
    await insertAsset(readyId, readyKey, validImage, 'ready', {updatedAt: old});
    await insertAsset(deletedId, deletedcodesKey, validImage, 'deleted', {updatedAt: old});
    await db!.insert(schema.mediaVariant).values({
      mediaAssetId: deletedId,
      kind: 'thumbnail',
      objectKey: variantKey,
      mediaType: 'image/webp',
      bytes: validImage.byteLength,
      width: 32,
      height: 18
    });
    for (const key of [pendingKey, readyKey, deletedcodesKey]) {
      storage.quarantine.set(key, validImage);
    }
    storage.variants.set(variantKey, validImage);

    await expect(cleanupMediaRetention(db!, storage, now, {ownerId})).resolves.toEqual({
      expiredUploads: 1,
      quarantinesDeleted: 3,
      variantsDeleted: 1,
      failures: 0
    });
    const [expired] = await db!
      .select()
      .from(schema.mediaAsset)
      .where(eq(schema.mediaAsset.id, pendingId));
    const variants = await db!
      .select()
      .from(schema.mediaVariant)
      .where(eq(schema.mediaVariant.mediaAssetId, deletedId));
    expect(expired).toMatchObject({status: 'deleted'});
    expect(expired!.quarantineDeletedAt).toBeInstanceOf(Date);
    expect(variants).toHaveLength(0);
    expect(storage.quarantine.size).toBe(0);
    expect(storage.variants.size).toBe(0);
  });

  it('reports an unhealthy backlog without exposing object keys or errors', async () => {
    const assetId = randomUUID();
    const objectKey = `${ownerId}/${assetId}/original`;
    const now = new Date();
    await insertAsset(assetId, objectKey, validImage, 'quarantined', {
      processingAvailableAt: new Date(now.getTime() - MEDIA_BACKLOG_SLA_MS - 1)
    });
    await expect(getMediaWorkerHealth(db!, now, ownerId)).resolves.toMatchObject({
      processable: 1,
      oldestProcessableAt: expect.any(String),
      healthy: false
    });
  });

  async function insertAsset(
    id: string,
    quarantineObjectKey: string,
    bytes: Uint8Array,
    status: 'pending_upload' | 'quarantined' | 'processing' | 'ready' | 'deleted',
    overrides: Partial<typeof schema.mediaAsset.$inferInsert> = {}
  ): Promise<void> {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const now = new Date();
    await db!.insert(schema.mediaAsset).values({
      id,
      ownerId,
      status,
      quarantineObjectKey,
      declaredMediaType: 'image/jpeg',
      detectedMediaType: status === 'pending_upload' ? null : 'image/jpeg',
      expectedBytes: bytes.byteLength,
      actualBytes: status === 'pending_upload' ? null : bytes.byteLength,
      expectedSha256: sha256,
      actualSha256: status === 'pending_upload' ? null : sha256,
      width: status === 'ready' ? 32 : null,
      height: status === 'ready' ? 18 : null,
      uploadExpiresAt: new Date(now.getTime() + 60_000),
      uploadedAt: status === 'pending_upload' ? null : now,
      processedAt: status === 'ready' ? now : null,
      ...overrides
    });
  }
});
