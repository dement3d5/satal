CREATE TYPE "public"."message_report_action_type" AS ENUM('dismiss', 'close_conversation');--> statement-breakpoint
CREATE TYPE "public"."message_report_reason" AS ENUM('spam', 'fraud', 'harassment', 'prohibited_content', 'personal_data', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_report_status" AS ENUM('open', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TABLE "message_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" "message_report_reason" NOT NULL,
	"details" varchar(1000),
	"status" "message_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_report_details_length" CHECK ("message_report"."details" is null or length(btrim("message_report"."details")) between 10 and 1000),
	CONSTRAINT "message_report_resolution_consistent" CHECK (("message_report"."status" = 'open' and "message_report"."resolved_at" is null) or ("message_report"."status" <> 'open' and "message_report"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "message_report_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "message_report_action_type" NOT NULL,
	"internal_note" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_message_id_conversation_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversation_message"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report_action" ADD CONSTRAINT "message_report_action_report_id_message_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."message_report"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report_action" ADD CONSTRAINT "message_report_action_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_report_reporter_message_unique" ON "message_report" USING btree ("reporter_id","message_id");--> statement-breakpoint
CREATE INDEX "message_report_queue_idx" ON "message_report" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "message_report_message_status_idx" ON "message_report" USING btree ("message_id","status","created_at");--> statement-breakpoint
CREATE INDEX "message_report_reporter_created_idx" ON "message_report" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_report_action_report_unique" ON "message_report_action" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "message_report_action_actor_created_idx" ON "message_report_action" USING btree ("actor_id","created_at");