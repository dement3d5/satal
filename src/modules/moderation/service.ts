import {and, asc, desc, eq, gt, inArray, isNull, ne, or, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  attributeDefinition,
  attributeOptionTranslation,
  attributeTranslation,
  categoryTranslation,
  listing,
  listingAppeal,
  listingAppealAction,
  listingAttributeOptionValue,
  listingAttributeValue,
  listingMedia,
  listingStatusHistory,
  locationTranslation,
  mediaAsset,
  mediaVariant,
  moderationAction,
  moderationCase,
  moderationCaseAssignmentEvent,
  moderationCaseSignal,
  moderationWorkspaceAccess,
  outboxEvent,
  user,
  userRole
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {ModerationDecisionInput, ModerationQueueQuery} from './contracts';
import {
  assertAssignedToActor,
  assertModerationCapability,
  assertAssignmentAvailable,
  assertReviewableCase,
  hasModerationCapability,
  moderationCaseAge,
  type ModerationCapability,
  type StaffRole
} from './domain';

export type QueryExecutor = Pick<DatabaseClient, 'select'>;

export async function listModerationQueue(
  db: DatabaseClient,
  actorId: string,
  query: ModerationQueueQuery
) {
  const roles = await requireModerationCapability(db, actorId, 'queue:read');
  const canReviewOwnListings = hasModerationCapability(roles, 'listings:self-review');
  await recordModerationAccess(db, actorId, 'queue');
  const now = new Date();
  const rows = await db
    .select({
      caseId: moderationCase.id,
      listingId: listing.id,
      priority: moderationCase.priority,
      riskBand: moderationCase.riskBand,
      policyVersion: moderationCase.policyVersion,
      openedAt: moderationCase.openedAt,
      assignedTo: moderationCase.assignedTo,
      assignedAt: moderationCase.assignedAt,
      title: listing.title,
      description: listing.description,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      sellerName: user.name,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name,
      mapLatitude: listing.mapLatitude,
      mapLongitude: listing.mapLongitude,
      publicLocationLabel: listing.publicLocationLabel
    })
    .from(moderationCase)
    .innerJoin(listing, eq(listing.id, moderationCase.listingId))
    .innerJoin(user, eq(user.id, listing.sellerId))
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, query.locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, query.locale)
      )
    )
    .where(
      and(
        eq(moderationCase.status, 'open'),
        eq(listing.status, 'pending_review'),
        canReviewOwnListings ? undefined : ne(listing.sellerId, actorId)
      )
    )
    .orderBy(desc(moderationCase.priority), asc(moderationCase.openedAt), asc(moderationCase.id))
    .limit(query.limit);

  const signals = rows.length
    ? await db
        .select({
          caseId: moderationCaseSignal.caseId,
          code: moderationCaseSignal.code,
          weight: moderationCaseSignal.weight
        })
        .from(moderationCaseSignal)
        .where(
          inArray(
            moderationCaseSignal.caseId,
            rows.map((row) => row.caseId)
          )
        )
        .orderBy(desc(moderationCaseSignal.weight), asc(moderationCaseSignal.code))
    : [];
  const signalsByCase = new Map<
    string,
    Array<{code: (typeof signals)[number]['code']; weight: number}>
  >();
  for (const signal of signals) {
    const existing = signalsByCase.get(signal.caseId) ?? [];
    existing.push({code: signal.code, weight: signal.weight});
    signalsByCase.set(signal.caseId, existing);
  }

  const assigneeIds = [...new Set(rows.flatMap((row) => (row.assignedTo ? [row.assignedTo] : [])))];
  const assignees = assigneeIds.length
    ? await db
        .select({id: user.id, name: user.name})
        .from(user)
        .where(inArray(user.id, assigneeIds))
    : [];
  const assigneeNameById = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));

  const listingIds = rows.map((row) => row.listingId);
  const [scalarAttributeRows, multiAttributeRows, mediaRows] = listingIds.length
    ? await Promise.all([
        db
          .select({
            listingId: listingAttributeValue.listingId,
            attributeId: listingAttributeValue.attributeId,
            label: attributeTranslation.label,
            unit: attributeDefinition.unit,
            textValue: listingAttributeValue.textValue,
            integerValue: listingAttributeValue.integerValue,
            decimalValue: listingAttributeValue.decimalValue,
            booleanValue: listingAttributeValue.booleanValue,
            dateValue: listingAttributeValue.dateValue,
            optionLabel: attributeOptionTranslation.label
          })
          .from(listingAttributeValue)
          .innerJoin(
            attributeDefinition,
            eq(attributeDefinition.id, listingAttributeValue.attributeId)
          )
          .innerJoin(
            attributeTranslation,
            and(
              eq(attributeTranslation.attributeId, listingAttributeValue.attributeId),
              eq(attributeTranslation.locale, query.locale)
            )
          )
          .leftJoin(
            attributeOptionTranslation,
            and(
              eq(attributeOptionTranslation.optionId, listingAttributeValue.optionId),
              eq(attributeOptionTranslation.locale, query.locale)
            )
          )
          .where(inArray(listingAttributeValue.listingId, listingIds))
          .orderBy(asc(attributeTranslation.label)),
        db
          .select({
            listingId: listingAttributeOptionValue.listingId,
            attributeId: listingAttributeOptionValue.attributeId,
            label: attributeTranslation.label,
            optionLabel: attributeOptionTranslation.label
          })
          .from(listingAttributeOptionValue)
          .innerJoin(
            attributeTranslation,
            and(
              eq(attributeTranslation.attributeId, listingAttributeOptionValue.attributeId),
              eq(attributeTranslation.locale, query.locale)
            )
          )
          .innerJoin(
            attributeOptionTranslation,
            and(
              eq(attributeOptionTranslation.optionId, listingAttributeOptionValue.optionId),
              eq(attributeOptionTranslation.locale, query.locale)
            )
          )
          .where(inArray(listingAttributeOptionValue.listingId, listingIds))
          .orderBy(asc(attributeTranslation.label), asc(attributeOptionTranslation.label)),
        db
          .select({
            listingId: listingMedia.listingId,
            assetId: mediaAsset.id
          })
          .from(listingMedia)
          .innerJoin(mediaAsset, eq(mediaAsset.id, listingMedia.mediaAssetId))
          .innerJoin(
            mediaVariant,
            and(eq(mediaVariant.mediaAssetId, mediaAsset.id), eq(mediaVariant.kind, 'detail'))
          )
          .where(and(inArray(listingMedia.listingId, listingIds), eq(mediaAsset.status, 'ready')))
          .orderBy(desc(listingMedia.isCover), asc(listingMedia.sortOrder))
      ])
    : [[], [], []];

  const attributesByListing = new Map<
    string,
    Array<{
      attributeId: string;
      label: string;
      value: string | number | boolean | string[];
      unit: string | null;
    }>
  >();
  for (const item of scalarAttributeRows) {
    const attributes = attributesByListing.get(item.listingId) ?? [];
    attributes.push({
      attributeId: item.attributeId,
      label: item.label,
      value: moderationScalarValue(item),
      unit: item.unit
    });
    attributesByListing.set(item.listingId, attributes);
  }
  const multiValues = new Map<
    string,
    {listingId: string; attributeId: string; label: string; values: string[]}
  >();
  for (const item of multiAttributeRows) {
    const key = `${item.listingId}:${item.attributeId}`;
    const current = multiValues.get(key) ?? {...item, values: []};
    current.values.push(item.optionLabel);
    multiValues.set(key, current);
  }
  for (const item of multiValues.values()) {
    const attributes = attributesByListing.get(item.listingId) ?? [];
    attributes.push({
      attributeId: item.attributeId,
      label: item.label,
      value: item.values,
      unit: null
    });
    attributesByListing.set(item.listingId, attributes);
  }
  const mediaByListing = new Map<string, string[]>();
  for (const item of mediaRows) {
    const urls = mediaByListing.get(item.listingId) ?? [];
    urls.push(`/api/v1/moderation/media/${item.assetId}/variants/detail`);
    mediaByListing.set(item.listingId, urls);
  }

  return rows.map((row) => {
    const {assignedTo, assignedAt, ...publicRow} = row;
    return {
      ...publicRow,
      openedAt: row.openedAt.toISOString(),
      assignedAt: assignedAt?.toISOString() ?? null,
      assigneeName: assignedTo ? (assigneeNameById.get(assignedTo) ?? null) : null,
      isAssignedToActor: assignedTo === actorId,
      ...moderationCaseAge({openedAt: row.openedAt, now}),
      signals: signalsByCase.get(row.caseId) ?? [],
      attributes: attributesByListing.get(row.listingId) ?? [],
      mediaUrls: mediaByListing.get(row.listingId) ?? [],
      canOverrideAssignment: hasModerationCapability(roles, 'assignment:override')
    };
  });
}

function moderationScalarValue(row: {
  textValue: string | null;
  integerValue: number | null;
  decimalValue: string | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  optionLabel: string | null;
}): string | number | boolean {
  if (row.textValue !== null) return row.textValue;
  if (row.integerValue !== null) return row.integerValue;
  if (row.decimalValue !== null) return Number(row.decimalValue);
  if (row.booleanValue !== null) return row.booleanValue;
  if (row.dateValue !== null) return row.dateValue;
  if (row.optionLabel !== null) return row.optionLabel;
  throw new AppError('UNEXPECTED_ERROR', 'Listing attribute has no moderation value', 500);
}

export async function claimModerationCase(db: DatabaseClient, actorId: string, caseId: string) {
  return db.transaction(async (tx) => {
    const roles = await requireModerationCapability(tx, actorId, 'assignment:write');
    const reviewCase = await readReviewableCaseForUpdate(tx, actorId, caseId, roles);
    assertAssignmentAvailable({actorId, assignedTo: reviewCase.assignedTo});
    const [actor] = await tx
      .select({name: user.name})
      .from(user)
      .where(eq(user.id, actorId))
      .limit(1);
    if (!actor) throw new AppError('NOT_FOUND', 'Moderator was not found', 404);

    if (reviewCase.assignedTo === actorId) {
      return {
        caseId,
        assigneeName: actor.name,
        assignedAt: reviewCase.assignedAt?.toISOString() ?? null,
        isAssignedToActor: true
      };
    }

    const now = new Date();
    await tx
      .update(moderationCase)
      .set({assignedTo: actorId, assignedAt: now, updatedAt: now})
      .where(eq(moderationCase.id, caseId));
    await tx.insert(moderationCaseAssignmentEvent).values({
      caseId,
      actorId,
      action: 'claim',
      previousAssigneeId: null,
      nextAssigneeId: actorId,
      createdAt: now
    });

    return {
      caseId,
      assigneeName: actor.name,
      assignedAt: now.toISOString(),
      isAssignedToActor: true
    };
  });
}

export async function releaseModerationCase(db: DatabaseClient, actorId: string, caseId: string) {
  return db.transaction(async (tx) => {
    const roles = await requireModerationCapability(tx, actorId, 'assignment:write');
    const reviewCase = await readReviewableCaseForUpdate(tx, actorId, caseId, roles);
    if (!reviewCase.assignedTo) {
      return {caseId, assigneeName: null, assignedAt: null, isAssignedToActor: false};
    }
    if (
      reviewCase.assignedTo !== actorId &&
      !hasModerationCapability(roles, 'assignment:override')
    ) {
      throw new AppError('FORBIDDEN', 'Only the assignee can release this moderation case', 403);
    }

    const now = new Date();
    await tx
      .update(moderationCase)
      .set({assignedTo: null, assignedAt: null, updatedAt: now})
      .where(eq(moderationCase.id, caseId));
    await tx.insert(moderationCaseAssignmentEvent).values({
      caseId,
      actorId,
      action: 'release',
      previousAssigneeId: reviewCase.assignedTo,
      nextAssigneeId: null,
      createdAt: now
    });
    return {caseId, assigneeName: null, assignedAt: null, isAssignedToActor: false};
  });
}

export async function decideModerationCase(
  db: DatabaseClient,
  actorId: string,
  caseId: string,
  input: ModerationDecisionInput
) {
  return db.transaction(async (tx) => {
    const roles = await requireModerationCapability(tx, actorId, 'decision:write');
    const [reviewCase] = await tx
      .select({
        id: moderationCase.id,
        status: moderationCase.status,
        listingId: moderationCase.listingId,
        assignedTo: moderationCase.assignedTo,
        assignedAt: moderationCase.assignedAt
      })
      .from(moderationCase)
      .where(eq(moderationCase.id, caseId))
      .for('update')
      .limit(1);
    if (!reviewCase) throw new AppError('NOT_FOUND', 'Moderation case was not found', 404);

    const [target] = await tx
      .select({status: listing.status, sellerId: listing.sellerId, version: listing.version})
      .from(listing)
      .where(eq(listing.id, reviewCase.listingId))
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
    assertReviewableCase({
      caseStatus: reviewCase.status,
      listingStatus: target.status,
      reviewerId: actorId,
      sellerId: target.sellerId,
      allowSelfReview: hasModerationCapability(roles, 'listings:self-review')
    });
    assertAssignedToActor({actorId, assignedTo: reviewCase.assignedTo});

    const now = new Date();
    const nextStatus = input.action === 'approve' ? 'active' : 'rejected';
    const expiresAt = input.action === 'approve' ? new Date(now) : null;
    expiresAt?.setUTCDate(expiresAt.getUTCDate() + 45);
    const [updated] = await tx
      .update(listing)
      .set({
        status: nextStatus,
        version: sql`${listing.version} + 1`,
        publishedAt: input.action === 'approve' ? now : null,
        expiresAt,
        updatedAt: now
      })
      .where(and(eq(listing.id, reviewCase.listingId), eq(listing.status, 'pending_review')))
      .returning({id: listing.id, version: listing.version, status: listing.status});
    if (!updated) throw new AppError('CONFLICT', 'Listing changed during moderation', 409);

    await tx
      .update(moderationCase)
      .set({
        status: input.action === 'approve' ? 'approved' : 'rejected',
        assignedTo: actorId,
        assignedAt: reviewCase.assignedAt ?? now,
        resolvedAt: now,
        updatedAt: now
      })
      .where(eq(moderationCase.id, caseId));
    await tx.insert(moderationAction).values({
      caseId,
      actorId,
      action: input.action,
      reasonCode: input.reasonCode,
      publicExplanation: input.action === 'reject' ? input.publicExplanation : null,
      internalNote: input.internalNote
    });
    await tx.insert(listingStatusHistory).values({
      listingId: reviewCase.listingId,
      actorId,
      fromStatus: 'pending_review',
      toStatus: nextStatus,
      reason: input.reasonCode
    });
    await tx.insert(outboxEvent).values({
      aggregateType: 'listing',
      aggregateId: reviewCase.listingId,
      eventType: input.action === 'approve' ? 'listing.published' : 'listing.rejected',
      aggregateVersion: updated.version,
      payload: {listingId: reviewCase.listingId, reasonCode: input.reasonCode}
    });

    return {
      caseId,
      listingId: reviewCase.listingId,
      status: updated.status,
      version: updated.version
    };
  });
}

export async function getOwnListingReview(db: DatabaseClient, actorId: string, listingId: string) {
  const [row] = await db
    .select({
      listingId: listing.id,
      status: listing.status,
      caseStatus: moderationCase.status,
      resolvedAt: moderationCase.resolvedAt,
      caseId: moderationCase.id
    })
    .from(listing)
    .innerJoin(moderationCase, eq(moderationCase.listingId, listing.id))
    .where(and(eq(listing.id, listingId), eq(listing.sellerId, actorId)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Listing review was not found', 404);
  const [lastAction] = await db
    .select({
      id: moderationAction.id,
      reasonCode: moderationAction.reasonCode,
      publicExplanation: moderationAction.publicExplanation
    })
    .from(moderationAction)
    .where(eq(moderationAction.caseId, row.caseId))
    .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
    .limit(1);
  const [appeal] = lastAction
    ? await db
        .select({
          id: listingAppeal.id,
          status: listingAppeal.status,
          statement: listingAppeal.statement,
          publicResponse: listingAppealAction.publicResponse
        })
        .from(listingAppeal)
        .leftJoin(listingAppealAction, eq(listingAppealAction.appealId, listingAppeal.id))
        .where(eq(listingAppeal.moderationActionId, lastAction.id))
        .limit(1)
    : [];
  return {
    listingId: row.listingId,
    status: row.status,
    caseStatus: row.caseStatus,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    reasonCode: lastAction?.reasonCode ?? null,
    publicExplanation: lastAction?.publicExplanation ?? null,
    appeal: appeal ?? null
  };
}

export async function listOwnListings(
  db: DatabaseClient,
  actorId: string,
  query: ModerationQueueQuery
) {
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      updatedAt: listing.updatedAt,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name
    })
    .from(listing)
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, query.locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, query.locale)
      )
    )
    .where(eq(listing.sellerId, actorId))
    .orderBy(desc(listing.updatedAt), desc(listing.id))
    .limit(query.limit);

  if (!rows.length) return [];
  const cases = await db
    .select({id: moderationCase.id, listingId: moderationCase.listingId})
    .from(moderationCase)
    .where(
      inArray(
        moderationCase.listingId,
        rows.map((row) => row.id)
      )
    );
  const caseListing = new Map(cases.map((item) => [item.id, item.listingId]));
  const actions = cases.length
    ? await db
        .select({
          id: moderationAction.id,
          caseId: moderationAction.caseId,
          reasonCode: moderationAction.reasonCode,
          publicExplanation: moderationAction.publicExplanation
        })
        .from(moderationAction)
        .where(
          inArray(
            moderationAction.caseId,
            cases.map((item) => item.id)
          )
        )
        .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
    : [];
  const actionByListing = new Map<
    string,
    {id: string; reasonCode: string; publicExplanation: string | null}
  >();
  for (const action of actions) {
    const targetListingId = caseListing.get(action.caseId);
    if (targetListingId && !actionByListing.has(targetListingId))
      actionByListing.set(targetListingId, action);
  }
  const latestActionIds = [...actionByListing.values()].map((item) => item.id);
  const appeals = latestActionIds.length
    ? await db
        .select({
          id: listingAppeal.id,
          moderationActionId: listingAppeal.moderationActionId,
          status: listingAppeal.status,
          publicResponse: listingAppealAction.publicResponse
        })
        .from(listingAppeal)
        .leftJoin(listingAppealAction, eq(listingAppealAction.appealId, listingAppeal.id))
        .where(inArray(listingAppeal.moderationActionId, latestActionIds))
    : [];
  const appealByAction = new Map(appeals.map((item) => [item.moderationActionId, item]));

  return rows.map((row) => {
    const action = actionByListing.get(row.id);
    const appeal = action ? appealByAction.get(action.id) : undefined;
    return {
      ...row,
      updatedAt: row.updatedAt.toISOString(),
      reasonCode: action?.reasonCode ?? null,
      publicExplanation: action?.publicExplanation ?? null,
      appealId: appeal?.id ?? null,
      appealStatus: appeal?.status ?? null,
      appealPublicResponse: appeal?.publicResponse ?? null
    };
  });
}

export async function requireModerationCapability(
  db: QueryExecutor,
  actorId: string,
  capability: ModerationCapability
): Promise<StaffRole[]> {
  const now = new Date();
  const rows = await db
    .select({role: userRole.role})
    .from(userRole)
    .where(
      and(
        eq(userRole.userId, actorId),
        inArray(userRole.role, ['moderator', 'admin', 'owner']),
        or(isNull(userRole.expiresAt), gt(userRole.expiresAt, now))
      )
    );
  const roles = rows.map((row) => row.role as StaffRole);
  assertModerationCapability(roles, capability);
  return roles;
}

export async function recordModerationAccess(
  db: DatabaseClient,
  actorId: string,
  surface: 'queue' | 'operations'
): Promise<void> {
  const now = new Date();
  const accessDate = now.toISOString().slice(0, 10);
  await db
    .insert(moderationWorkspaceAccess)
    .values({actorId, surface, accessDate, firstAccessAt: now, lastAccessAt: now})
    .onConflictDoUpdate({
      target: [
        moderationWorkspaceAccess.actorId,
        moderationWorkspaceAccess.surface,
        moderationWorkspaceAccess.accessDate
      ],
      set: {
        lastAccessAt: now,
        accessCount: sql`${moderationWorkspaceAccess.accessCount} + 1`
      }
    });
}

async function readReviewableCaseForUpdate(
  tx: Parameters<Parameters<DatabaseClient['transaction']>[0]>[0],
  actorId: string,
  caseId: string,
  roles: readonly StaffRole[]
) {
  const [reviewCase] = await tx
    .select({
      id: moderationCase.id,
      status: moderationCase.status,
      listingId: moderationCase.listingId,
      assignedTo: moderationCase.assignedTo,
      assignedAt: moderationCase.assignedAt
    })
    .from(moderationCase)
    .where(eq(moderationCase.id, caseId))
    .for('update')
    .limit(1);
  if (!reviewCase) throw new AppError('NOT_FOUND', 'Moderation case was not found', 404);
  const [target] = await tx
    .select({status: listing.status, sellerId: listing.sellerId})
    .from(listing)
    .where(eq(listing.id, reviewCase.listingId))
    .limit(1);
  if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
  assertReviewableCase({
    caseStatus: reviewCase.status,
    listingStatus: target.status,
    reviewerId: actorId,
    sellerId: target.sellerId,
    allowSelfReview: hasModerationCapability(roles, 'listings:self-review')
  });
  return reviewCase;
}
