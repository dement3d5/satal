CREATE TYPE "public"."shop_media_kind" AS ENUM('logo', 'cover');--> statement-breakpoint
CREATE TYPE "public"."shop_member_role" AS ENUM('owner', 'manager', 'listing_manager');--> statement-breakpoint
CREATE TYPE "public"."shop_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."shop_verification_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shop_verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "shop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location_id" uuid,
	"public_address" varchar(300),
	"public_phone" varchar(32),
	"status" "shop_status" DEFAULT 'active' NOT NULL,
	"verification_status" "shop_verification_status" DEFAULT 'unverified' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"verified_at" timestamp with time zone,
	"verification_reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_slug_format" CHECK ("shop"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "shop_name_not_blank" CHECK (length(btrim("shop"."name")) >= 2),
	CONSTRAINT "shop_version_positive" CHECK ("shop"."version" > 0),
	CONSTRAINT "shop_description_length" CHECK (length("shop"."description") <= 3000),
	CONSTRAINT "shop_verification_timestamp_consistent" CHECK (("shop"."verification_status" = 'verified' and "shop"."verified_at" is not null) or ("shop"."verification_status" <> 'verified' and "shop"."verified_at" is null))
);
--> statement-breakpoint
CREATE TABLE "shop_business_hour" (
	"shop_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"opens_at_minute" smallint,
	"closes_at_minute" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_business_hour_shop_id_weekday_pk" PRIMARY KEY("shop_id","weekday"),
	CONSTRAINT "shop_business_hour_weekday_range" CHECK ("shop_business_hour"."weekday" between 0 and 6),
	CONSTRAINT "shop_business_hour_minutes_range" CHECK ("shop_business_hour"."opens_at_minute" is null or "shop_business_hour"."opens_at_minute" between 0 and 1439),
	CONSTRAINT "shop_business_hour_closing_minutes_range" CHECK ("shop_business_hour"."closes_at_minute" is null or "shop_business_hour"."closes_at_minute" between 1 and 1440),
	CONSTRAINT "shop_business_hour_state_consistent" CHECK (("shop_business_hour"."is_closed" and "shop_business_hour"."opens_at_minute" is null and "shop_business_hour"."closes_at_minute" is null) or (not "shop_business_hour"."is_closed" and "shop_business_hour"."opens_at_minute" is not null and "shop_business_hour"."closes_at_minute" is not null and "shop_business_hour"."opens_at_minute" < "shop_business_hour"."closes_at_minute"))
);
--> statement-breakpoint
CREATE TABLE "shop_media" (
	"shop_id" uuid NOT NULL,
	"kind" "shop_media_kind" NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_media_shop_id_kind_pk" PRIMARY KEY("shop_id","kind")
);
--> statement-breakpoint
CREATE TABLE "shop_member" (
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "shop_member_role" NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_member_shop_id_user_id_pk" PRIMARY KEY("shop_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shop_verification_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"status" "shop_verification_request_status" DEFAULT 'pending' NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"registry_number" varchar(120),
	"statement" text NOT NULL,
	"reviewed_by" uuid,
	"reviewer_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_verification_legal_name_not_blank" CHECK (length(btrim("shop_verification_request"."legal_name")) >= 2),
	CONSTRAINT "shop_verification_statement_length" CHECK (length(btrim("shop_verification_request"."statement")) between 20 and 2000),
	CONSTRAINT "shop_verification_resolution_consistent" CHECK (("shop_verification_request"."status" = 'pending' and "shop_verification_request"."reviewed_by" is null and "shop_verification_request"."resolved_at" is null) or ("shop_verification_request"."status" <> 'pending' and "shop_verification_request"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "listing_draft" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "shop" ADD CONSTRAINT "shop_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop" ADD CONSTRAINT "shop_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop" ADD CONSTRAINT "shop_verification_reviewed_by_user_id_fk" FOREIGN KEY ("verification_reviewed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_business_hour" ADD CONSTRAINT "shop_business_hour_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_media" ADD CONSTRAINT "shop_media_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_media" ADD CONSTRAINT "shop_media_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_member" ADD CONSTRAINT "shop_member_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_member" ADD CONSTRAINT "shop_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_member" ADD CONSTRAINT "shop_member_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_verification_request" ADD CONSTRAINT "shop_verification_request_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_verification_request" ADD CONSTRAINT "shop_verification_request_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_verification_request" ADD CONSTRAINT "shop_verification_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_slug_unique" ON "shop" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_owner_unique" ON "shop" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "shop_public_directory_idx" ON "shop" USING btree ("status","verification_status","created_at");--> statement-breakpoint
CREATE INDEX "shop_location_idx" ON "shop" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_media_asset_unique" ON "shop_media" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "shop_member_user_role_idx" ON "shop_member" USING btree ("user_id","role","shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_verification_one_pending_unique" ON "shop_verification_request" USING btree ("shop_id") WHERE "shop_verification_request"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "shop_verification_queue_idx" ON "shop_verification_request" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_shop_public_feed_idx" ON "listing" USING btree ("shop_id","status","published_at","id");--> statement-breakpoint
CREATE INDEX "listing_draft_shop_status_updated_idx" ON "listing_draft" USING btree ("shop_id","status","updated_at");