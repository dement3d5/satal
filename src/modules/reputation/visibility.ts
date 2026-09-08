import {and, eq, lte, or, sql} from 'drizzle-orm';

import {userReview} from '@/server/db/schema';

export function publicReviewVisibility(now = new Date()) {
  const counterpartExists = sql<boolean>`exists (
    select 1
    from "user_review" as "counterpart_review"
    where "counterpart_review"."interaction_id" = ${userReview.interactionId}
      and "counterpart_review"."author_id" = ${userReview.subjectId}
      and "counterpart_review"."subject_id" = ${userReview.authorId}
      and "counterpart_review"."status" = 'active'
  )`;
  return and(
    eq(userReview.status, 'active'),
    or(lte(userReview.revealAt, now), counterpartExists)
  )!;
}
