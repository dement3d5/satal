CREATE TYPE "public"."listing_status" AS ENUM('pending_review', 'active', 'sold', 'expired', 'removed', 'rejected');--> statement-breakpoint
CREATE TABLE "listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"source_draft_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"category_schema_version" integer NOT NULL,
	"location_id" uuid NOT NULL,
	"public_location_precision" "public_location_precision" NOT NULL,
	"status" "listing_status" DEFAULT 'pending_review' NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text NOT NULL,
	"price_minor" bigint,
	"currency" varchar(3) DEFAULT 'AZN' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_schema_version_positive" CHECK ("listing"."category_schema_version" > 0),
	CONSTRAINT "listing_version_positive" CHECK ("listing"."version" > 0),
	CONSTRAINT "listing_title_not_blank" CHECK (length(btrim("listing"."title")) >= 5),
	CONSTRAINT "listing_description_not_blank" CHECK (length(btrim("listing"."description")) >= 20),
	CONSTRAINT "listing_price_non_negative" CHECK ("listing"."price_minor" is null or "listing"."price_minor" >= 0),
	CONSTRAINT "listing_active_has_published_at" CHECK ("listing"."status" <> 'active' or "listing"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "listing_attribute_option_value" (
	"listing_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_attribute_option_value_listing_id_attribute_id_option_id_pk" PRIMARY KEY("listing_id","attribute_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "listing_attribute_value" (
	"listing_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"text_value" text,
	"integer_value" bigint,
	"decimal_value" numeric(18, 4),
	"boolean_value" boolean,
	"date_value" date,
	"option_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_attribute_value_listing_id_attribute_id_pk" PRIMARY KEY("listing_id","attribute_id"),
	CONSTRAINT "listing_attribute_exactly_one_scalar_value" CHECK (num_nonnulls("listing_attribute_value"."text_value", "listing_attribute_value"."integer_value", "listing_attribute_value"."decimal_value", "listing_attribute_value"."boolean_value", "listing_attribute_value"."date_value", "listing_attribute_value"."option_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "listing_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_status" "listing_status",
	"to_status" "listing_status" NOT NULL,
	"reason" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"aggregate_version" integer NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "outbox_version_positive" CHECK ("outbox_event"."aggregate_version" > 0),
	CONSTRAINT "outbox_attempts_non_negative" CHECK ("outbox_event"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_source_draft_id_listing_draft_id_fk" FOREIGN KEY ("source_draft_id") REFERENCES "public"."listing_draft"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_option_value" ADD CONSTRAINT "listing_attribute_option_value_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_option_value" ADD CONSTRAINT "listing_attribute_option_value_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_option_value" ADD CONSTRAINT "listing_attribute_option_value_option_id_attribute_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_option_value" ADD CONSTRAINT "listing_multi_option_belongs_to_attribute_fk" FOREIGN KEY ("attribute_id","option_id") REFERENCES "public"."attribute_option"("attribute_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_value" ADD CONSTRAINT "listing_attribute_value_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_value" ADD CONSTRAINT "listing_attribute_value_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_value" ADD CONSTRAINT "listing_attribute_value_option_id_attribute_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_attribute_value" ADD CONSTRAINT "listing_scalar_option_belongs_to_attribute_fk" FOREIGN KEY ("attribute_id","option_id") REFERENCES "public"."attribute_option"("attribute_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_history" ADD CONSTRAINT "listing_status_history_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_history" ADD CONSTRAINT "listing_status_history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_source_draft_unique" ON "listing" USING btree ("source_draft_id");--> statement-breakpoint
CREATE INDEX "listing_public_feed_idx" ON "listing" USING btree ("status","published_at","id");--> statement-breakpoint
CREATE INDEX "listing_category_feed_idx" ON "listing" USING btree ("category_id","status","published_at","id");--> statement-breakpoint
CREATE INDEX "listing_location_feed_idx" ON "listing" USING btree ("location_id","status","published_at","id");--> statement-breakpoint
CREATE INDEX "listing_seller_status_updated_idx" ON "listing" USING btree ("seller_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "listing_multi_option_projection_idx" ON "listing_attribute_option_value" USING btree ("attribute_id","option_id","listing_id");--> statement-breakpoint
CREATE INDEX "listing_attribute_projection_idx" ON "listing_attribute_value" USING btree ("attribute_id","option_id","listing_id");--> statement-breakpoint
CREATE INDEX "listing_status_history_listing_created_idx" ON "listing_status_history" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_event" USING btree ("processed_at","available_at","occurred_at");--> statement-breakpoint
CREATE INDEX "outbox_aggregate_idx" ON "outbox_event" USING btree ("aggregate_type","aggregate_id","aggregate_version");