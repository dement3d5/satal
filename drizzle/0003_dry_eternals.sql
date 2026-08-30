CREATE TYPE "public"."media_asset_status" AS ENUM('pending_upload', 'quarantined', 'processing', 'ready', 'rejected', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."media_variant_kind" AS ENUM('thumbnail', 'card', 'detail');--> statement-breakpoint
CREATE TABLE "listing_draft_media" (
	"draft_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_order" smallint NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_draft_media_draft_id_media_asset_id_pk" PRIMARY KEY("draft_id","media_asset_id"),
	CONSTRAINT "listing_draft_media_order_range" CHECK ("listing_draft_media"."sort_order" between 0 and 11)
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"listing_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_order" smallint NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_media_listing_id_media_asset_id_pk" PRIMARY KEY("listing_id","media_asset_id"),
	CONSTRAINT "listing_media_order_range" CHECK ("listing_media"."sort_order" between 0 and 11)
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "media_asset_status" DEFAULT 'pending_upload' NOT NULL,
	"quarantine_object_key" varchar(500) NOT NULL,
	"declared_media_type" varchar(80) NOT NULL,
	"detected_media_type" varchar(80),
	"expected_bytes" bigint NOT NULL,
	"actual_bytes" bigint,
	"expected_sha256" varchar(64) NOT NULL,
	"actual_sha256" varchar(64),
	"width" integer,
	"height" integer,
	"rejection_code" varchar(80),
	"upload_expires_at" timestamp with time zone NOT NULL,
	"uploaded_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_expected_bytes_range" CHECK ("media_asset"."expected_bytes" between 1 and 10485760),
	CONSTRAINT "media_asset_actual_bytes_range" CHECK ("media_asset"."actual_bytes" is null or "media_asset"."actual_bytes" between 1 and 10485760),
	CONSTRAINT "media_asset_expected_sha256_format" CHECK ("media_asset"."expected_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "media_asset_actual_sha256_format" CHECK ("media_asset"."actual_sha256" is null or "media_asset"."actual_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "media_asset_dimensions_together" CHECK (("media_asset"."width" is null and "media_asset"."height" is null) or ("media_asset"."width" > 0 and "media_asset"."height" > 0))
);
--> statement-breakpoint
CREATE TABLE "media_variant" (
	"media_asset_id" uuid NOT NULL,
	"kind" "media_variant_kind" NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"media_type" varchar(80) NOT NULL,
	"bytes" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_variant_media_asset_id_kind_pk" PRIMARY KEY("media_asset_id","kind"),
	CONSTRAINT "media_variant_bytes_positive" CHECK ("media_variant"."bytes" > 0),
	CONSTRAINT "media_variant_dimensions_positive" CHECK ("media_variant"."width" > 0 and "media_variant"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "listing_draft_media" ADD CONSTRAINT "listing_draft_media_draft_id_listing_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."listing_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_media" ADD CONSTRAINT "listing_draft_media_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_variant" ADD CONSTRAINT "media_variant_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_draft_media_asset_unique" ON "listing_draft_media" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_draft_media_order_unique" ON "listing_draft_media" USING btree ("draft_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_draft_media_single_cover_unique" ON "listing_draft_media" USING btree ("draft_id") WHERE "listing_draft_media"."is_cover" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_media_asset_unique" ON "listing_media" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_media_order_unique" ON "listing_media" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_media_single_cover_unique" ON "listing_media" USING btree ("listing_id") WHERE "listing_media"."is_cover" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "media_asset_quarantine_key_unique" ON "media_asset" USING btree ("quarantine_object_key");--> statement-breakpoint
CREATE INDEX "media_asset_owner_status_created_idx" ON "media_asset" USING btree ("owner_id","status","created_at");--> statement-breakpoint
CREATE INDEX "media_asset_expired_upload_idx" ON "media_asset" USING btree ("status","upload_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_variant_object_key_unique" ON "media_variant" USING btree ("object_key");