import {and, eq} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  listing,
  listingAttributeOptionValue,
  listingAttributeValue,
  listingDraft,
  listingDraftAttributeOptionValue,
  listingDraftAttributeValue,
  listingDraftStatusHistory,
  listingStatusHistory,
  outboxEvent
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {assertDraftOwner, assertDraftVersion} from './draft-domain';
import {loadAttributeRules, loadStoredAttributes, lockDraft, requireDraft} from './draft-service';
import type {PublishListingInput} from './publication-contracts';
import {assertPublishableDraft} from './publication-domain';

export interface PublishedListingContract {
  id: string;
  sourceDraftId: string;
  status: 'pending_review' | 'active' | 'sold' | 'expired' | 'removed' | 'rejected';
  version: number;
  publishedAt: string | null;
}

export async function publishListingDraft(
  db: DatabaseClient,
  actorId: string,
  draftId: string,
  input: PublishListingInput
): Promise<PublishedListingContract> {
  return db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const draft = await requireDraft(tx, draftId);
    assertDraftOwner(actorId, draft.ownerId);

    const [alreadyPublished] = await tx
      .select()
      .from(listing)
      .where(eq(listing.sourceDraftId, draftId))
      .limit(1);
    if (alreadyPublished) return toPublishedContract(alreadyPublished);

    assertDraftVersion(input.version, draft.version);
    const [rules, attributes] = await Promise.all([
      loadAttributeRules(tx, draft.categoryId),
      loadStoredAttributes(tx, draftId)
    ]);
    assertPublishableDraft(
      {
        status: draft.status,
        title: draft.title,
        description: draft.description,
        priceMinor: draft.priceMinor,
        currency: draft.currency,
        locationId: draft.locationId,
        attributes: attributes.map(({attributeId, ...value}) => ({attributeId, value}))
      },
      rules
    );

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 45);
    const [created] = await tx
      .insert(listing)
      .values({
        sellerId: actorId,
        sourceDraftId: draftId,
        categoryId: draft.categoryId,
        categorySchemaVersion: draft.categorySchemaVersion,
        locationId: draft.locationId!,
        publicLocationPrecision: draft.publicLocationPrecision,
        status: 'active',
        title: draft.title.trim(),
        description: draft.description.trim(),
        priceMinor: draft.priceMinor,
        currency: draft.currency,
        publishedAt: now,
        expiresAt
      })
      .returning();
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Listing could not be published', 500);

    await copyDraftAttributes(tx, draftId, created.id);
    await tx.insert(listingStatusHistory).values({
      listingId: created.id,
      actorId,
      fromStatus: null,
      toStatus: 'active',
      reason: 'owner_publication'
    });

    const draftHistory =
      draft.status === 'draft'
        ? [
            {
              draftId,
              actorId,
              fromStatus: 'draft' as const,
              toStatus: 'ready_for_review' as const,
              reason: 'publication_validation_passed'
            },
            {
              draftId,
              actorId,
              fromStatus: 'ready_for_review' as const,
              toStatus: 'submitted' as const,
              reason: 'listing_published'
            }
          ]
        : [
            {
              draftId,
              actorId,
              fromStatus: 'ready_for_review' as const,
              toStatus: 'submitted' as const,
              reason: 'listing_published'
            }
          ];
    await tx.insert(listingDraftStatusHistory).values(draftHistory);
    const [updatedDraft] = await tx
      .update(listingDraft)
      .set({status: 'submitted', version: draft.version + 1, updatedAt: now})
      .where(and(eq(listingDraft.id, draftId), eq(listingDraft.version, draft.version)))
      .returning({id: listingDraft.id});
    if (!updatedDraft) throw new AppError('CONFLICT', 'Draft changed during publication', 409);

    await tx.insert(outboxEvent).values({
      aggregateType: 'listing',
      aggregateId: created.id,
      eventType: 'listing.published',
      aggregateVersion: created.version,
      payload: {listingId: created.id, categoryId: created.categoryId}
    });

    return toPublishedContract(created);
  });
}

async function copyDraftAttributes(
  tx: Parameters<Parameters<DatabaseClient['transaction']>[0]>[0],
  draftId: string,
  listingId: string
): Promise<void> {
  const [scalarValues, optionValues] = await Promise.all([
    tx
      .select({
        attributeId: listingDraftAttributeValue.attributeId,
        textValue: listingDraftAttributeValue.textValue,
        integerValue: listingDraftAttributeValue.integerValue,
        decimalValue: listingDraftAttributeValue.decimalValue,
        booleanValue: listingDraftAttributeValue.booleanValue,
        dateValue: listingDraftAttributeValue.dateValue,
        optionId: listingDraftAttributeValue.optionId
      })
      .from(listingDraftAttributeValue)
      .where(eq(listingDraftAttributeValue.draftId, draftId)),
    tx
      .select({
        attributeId: listingDraftAttributeOptionValue.attributeId,
        optionId: listingDraftAttributeOptionValue.optionId
      })
      .from(listingDraftAttributeOptionValue)
      .where(eq(listingDraftAttributeOptionValue.draftId, draftId))
  ]);

  if (scalarValues.length) {
    await tx
      .insert(listingAttributeValue)
      .values(scalarValues.map((value) => ({listingId, ...value})));
  }
  if (optionValues.length) {
    await tx
      .insert(listingAttributeOptionValue)
      .values(optionValues.map((value) => ({listingId, ...value})));
  }
}

function toPublishedContract(row: typeof listing.$inferSelect): PublishedListingContract {
  return {
    id: row.id,
    sourceDraftId: row.sourceDraftId,
    status: row.status,
    version: row.version,
    publishedAt: row.publishedAt?.toISOString() ?? null
  };
}
