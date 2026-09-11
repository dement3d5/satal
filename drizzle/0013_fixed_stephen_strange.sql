CREATE TYPE "public"."moderation_signal_code" AS ENUM('new_account', 'contact_details_in_content');--> statement-breakpoint
CREATE TABLE "moderation_case_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"code" "moderation_signal_code" NOT NULL,
	"weight" smallint NOT NULL,
	"policy_version" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_case_signal_weight_range" CHECK ("moderation_case_signal"."weight" between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "moderation_case_signal" ADD CONSTRAINT "moderation_case_signal_case_id_moderation_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_case"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_case_signal_case_code_unique" ON "moderation_case_signal" USING btree ("case_id","code");--> statement-breakpoint
CREATE INDEX "moderation_case_signal_case_created_idx" ON "moderation_case_signal" USING btree ("case_id","created_at");