CREATE TYPE "public"."moderation_access_surface" AS ENUM('queue', 'operations');--> statement-breakpoint
CREATE TYPE "public"."moderation_assignment_event_type" AS ENUM('claim', 'release');--> statement-breakpoint
CREATE TABLE "moderation_case_assignment_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "moderation_assignment_event_type" NOT NULL,
	"previous_assignee_id" uuid,
	"next_assignee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_assignment_transition_valid" CHECK (("moderation_case_assignment_event"."action" = 'claim' and "moderation_case_assignment_event"."next_assignee_id" is not null) or ("moderation_case_assignment_event"."action" = 'release' and "moderation_case_assignment_event"."previous_assignee_id" is not null and "moderation_case_assignment_event"."next_assignee_id" is null))
);
--> statement-breakpoint
CREATE TABLE "moderation_workspace_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"surface" "moderation_access_surface" NOT NULL,
	"access_date" date NOT NULL,
	"first_access_at" timestamp with time zone NOT NULL,
	"last_access_at" timestamp with time zone NOT NULL,
	"access_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "moderation_access_count_positive" CHECK ("moderation_workspace_access"."access_count" > 0),
	CONSTRAINT "moderation_access_time_consistent" CHECK ("moderation_workspace_access"."last_access_at" >= "moderation_workspace_access"."first_access_at")
);
--> statement-breakpoint
ALTER TABLE "moderation_case" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
UPDATE "moderation_case"
SET "assigned_at" = COALESCE("resolved_at", "updated_at")
WHERE "assigned_to" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_case_assignment_event" ADD CONSTRAINT "moderation_case_assignment_event_case_id_moderation_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_case"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_assignment_event" ADD CONSTRAINT "moderation_case_assignment_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_assignment_event" ADD CONSTRAINT "moderation_case_assignment_event_previous_assignee_id_user_id_fk" FOREIGN KEY ("previous_assignee_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_assignment_event" ADD CONSTRAINT "moderation_case_assignment_event_next_assignee_id_user_id_fk" FOREIGN KEY ("next_assignee_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_workspace_access" ADD CONSTRAINT "moderation_workspace_access_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_assignment_case_created_idx" ON "moderation_case_assignment_event" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_assignment_actor_created_idx" ON "moderation_case_assignment_event" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_access_actor_surface_date_unique" ON "moderation_workspace_access" USING btree ("actor_id","surface","access_date");--> statement-breakpoint
CREATE INDEX "moderation_access_surface_last_idx" ON "moderation_workspace_access" USING btree ("surface","last_access_at");--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_assignment_consistent" CHECK (("moderation_case"."assigned_to" is null and "moderation_case"."assigned_at" is null) or ("moderation_case"."assigned_to" is not null and "moderation_case"."assigned_at" is not null));
