ALTER TABLE "media_asset" ADD COLUMN "processing_available_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "processing_lease_owner" varchar(100);--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "processing_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "last_processing_error_code" varchar(80);--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "quarantine_deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "media_asset"
SET
	"status" = 'quarantined',
	"processing_available_at" = now(),
	"last_processing_error_code" = 'migration_recovered_stale_lease',
	"updated_at" = now()
WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "media_asset_processing_queue_idx" ON "media_asset" USING btree ("status","processing_available_at","created_at");--> statement-breakpoint
CREATE INDEX "media_asset_processing_lease_idx" ON "media_asset" USING btree ("status","processing_lease_expires_at");--> statement-breakpoint
CREATE INDEX "media_asset_quarantine_cleanup_idx" ON "media_asset" USING btree ("status","quarantine_deleted_at","updated_at");--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_processing_attempts_non_negative" CHECK ("media_asset"."processing_attempts" >= 0);--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_processing_lease_consistent" CHECK (("media_asset"."status" = 'processing' and "media_asset"."processing_lease_owner" is not null and "media_asset"."processing_lease_expires_at" is not null) or ("media_asset"."status" <> 'processing' and "media_asset"."processing_lease_owner" is null and "media_asset"."processing_lease_expires_at" is null));
