ALTER TABLE "outbox_event" ADD COLUMN "leased_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "lease_owner" varchar(100);--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "last_error" varchar(240);--> statement-breakpoint
CREATE INDEX "listing_public_search_idx" ON "listing" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", ''))) WHERE "listing"."status" = 'active';