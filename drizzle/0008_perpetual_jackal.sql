CREATE TYPE "public"."listing_appeal_action_type" AS ENUM('accept', 'reject');--> statement-breakpoint
CREATE TYPE "public"."listing_appeal_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."listing_report_action_type" AS ENUM('dismiss', 'remove_listing');--> statement-breakpoint
CREATE TYPE "public"."listing_report_reason" AS ENUM('fraud', 'wrong_category', 'prohibited_item', 'duplicate', 'misleading_price', 'stale_listing', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_report_status" AS ENUM('open', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TABLE "listing_appeal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"moderation_action_id" uuid NOT NULL,
	"appellant_id" uuid NOT NULL,
	"statement" varchar(1000) NOT NULL,
	"status" "listing_appeal_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_appeal_statement_length" CHECK (length(btrim("listing_appeal"."statement")) between 20 and 1000),
	CONSTRAINT "listing_appeal_resolution_consistent" CHECK (("listing_appeal"."status" = 'open' and "listing_appeal"."resolved_at" is null) or ("listing_appeal"."status" <> 'open' and "listing_appeal"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "listing_appeal_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appeal_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "listing_appeal_action_type" NOT NULL,
	"public_response" varchar(500),
	"internal_note" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_appeal_rejection_has_response" CHECK ("listing_appeal_action"."action" <> 'reject' or ("listing_appeal_action"."public_response" is not null and length(btrim("listing_appeal_action"."public_response")) >= 10))
);
--> statement-breakpoint
CREATE TABLE "listing_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" "listing_report_reason" NOT NULL,
	"details" varchar(1000),
	"status" "listing_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_report_details_length" CHECK ("listing_report"."details" is null or length(btrim("listing_report"."details")) between 10 and 1000),
	CONSTRAINT "listing_report_resolution_consistent" CHECK (("listing_report"."status" = 'open' and "listing_report"."resolved_at" is null) or ("listing_report"."status" <> 'open' and "listing_report"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "listing_report_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "listing_report_action_type" NOT NULL,
	"internal_note" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_appeal" ADD CONSTRAINT "listing_appeal_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_appeal" ADD CONSTRAINT "listing_appeal_moderation_action_id_moderation_action_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_action"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_appeal" ADD CONSTRAINT "listing_appeal_appellant_id_user_id_fk" FOREIGN KEY ("appellant_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_appeal_action" ADD CONSTRAINT "listing_appeal_action_appeal_id_listing_appeal_id_fk" FOREIGN KEY ("appeal_id") REFERENCES "public"."listing_appeal"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_appeal_action" ADD CONSTRAINT "listing_appeal_action_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_report" ADD CONSTRAINT "listing_report_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_report" ADD CONSTRAINT "listing_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_report_action" ADD CONSTRAINT "listing_report_action_report_id_listing_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."listing_report"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_report_action" ADD CONSTRAINT "listing_report_action_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_appeal_moderation_action_unique" ON "listing_appeal" USING btree ("moderation_action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_appeal_one_open_per_listing_unique" ON "listing_appeal" USING btree ("listing_id") WHERE "listing_appeal"."status" = 'open';--> statement-breakpoint
CREATE INDEX "listing_appeal_queue_idx" ON "listing_appeal" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "listing_appeal_appellant_created_idx" ON "listing_appeal" USING btree ("appellant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_appeal_action_appeal_unique" ON "listing_appeal_action" USING btree ("appeal_id");--> statement-breakpoint
CREATE INDEX "listing_appeal_action_actor_created_idx" ON "listing_appeal_action" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_report_reporter_listing_unique" ON "listing_report" USING btree ("reporter_id","listing_id");--> statement-breakpoint
CREATE INDEX "listing_report_queue_idx" ON "listing_report" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "listing_report_listing_status_idx" ON "listing_report" USING btree ("listing_id","status","created_at");--> statement-breakpoint
CREATE INDEX "listing_report_reporter_created_idx" ON "listing_report" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_report_action_report_unique" ON "listing_report_action" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "listing_report_action_actor_created_idx" ON "listing_report_action" USING btree ("actor_id","created_at");