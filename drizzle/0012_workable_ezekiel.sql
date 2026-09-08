CREATE TYPE "public"."review_report_action_type" AS ENUM('dismiss', 'hide_review');--> statement-breakpoint
CREATE TYPE "public"."review_report_reason" AS ENUM('spam', 'harassment', 'personal_data', 'irrelevant', 'prohibited_content', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_report_status" AS ENUM('open', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TABLE "review_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" "review_report_reason" NOT NULL,
	"details" varchar(1000),
	"status" "review_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_report_details_length" CHECK ("review_report"."details" is null or length(btrim("review_report"."details")) between 10 and 1000),
	CONSTRAINT "review_report_resolution_consistent" CHECK (("review_report"."status" = 'open' and "review_report"."resolved_at" is null) or ("review_report"."status" <> 'open' and "review_report"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "review_report_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "review_report_action_type" NOT NULL,
	"internal_note" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_review_id_user_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."user_review"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report_action" ADD CONSTRAINT "review_report_action_report_id_review_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."review_report"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report_action" ADD CONSTRAINT "review_report_action_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_report_reporter_review_unique" ON "review_report" USING btree ("reporter_id","review_id");--> statement-breakpoint
CREATE INDEX "review_report_queue_idx" ON "review_report" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "review_report_review_status_idx" ON "review_report" USING btree ("review_id","status","created_at");--> statement-breakpoint
CREATE INDEX "review_report_reporter_created_idx" ON "review_report" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_report_action_report_unique" ON "review_report_action" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "review_report_action_actor_created_idx" ON "review_report_action" USING btree ("actor_id","created_at");