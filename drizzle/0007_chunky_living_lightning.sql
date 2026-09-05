CREATE TYPE "public"."moderation_action_type" AS ENUM('approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."moderation_case_status" AS ENUM('open', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."moderation_risk_band" AS ENUM('unassessed', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('moderator', 'admin', 'owner');--> statement-breakpoint
CREATE TABLE "moderation_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "moderation_action_type" NOT NULL,
	"reason_code" varchar(80) NOT NULL,
	"public_explanation" varchar(500),
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_action_reason_code_format" CHECK ("moderation_action"."reason_code" ~ '^[a-z0-9_]{3,80}$'),
	CONSTRAINT "moderation_action_rejection_has_explanation" CHECK ("moderation_action"."action" <> 'reject' or ("moderation_action"."public_explanation" is not null and length(btrim("moderation_action"."public_explanation")) >= 10))
);
--> statement-breakpoint
CREATE TABLE "moderation_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"status" "moderation_case_status" DEFAULT 'open' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"risk_band" "moderation_risk_band" DEFAULT 'unassessed' NOT NULL,
	"policy_version" varchar(80) NOT NULL,
	"assigned_to" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_case_priority_range" CHECK ("moderation_case"."priority" between 0 and 1000),
	CONSTRAINT "moderation_case_resolution_consistent" CHECK (("moderation_case"."status" = 'open' and "moderation_case"."resolved_at" is null) or ("moderation_case"."status" <> 'open' and "moderation_case"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "user_role_user_id_role_pk" PRIMARY KEY("user_id","role"),
	CONSTRAINT "user_role_expiry_after_grant" CHECK ("user_role"."expires_at" is null or "user_role"."expires_at" > "user_role"."granted_at")
);
--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_case_id_moderation_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_case"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_action_case_created_idx" ON "moderation_action" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_action_actor_created_idx" ON "moderation_action" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_case_listing_unique" ON "moderation_case" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "moderation_case_queue_idx" ON "moderation_case" USING btree ("status","priority","opened_at");--> statement-breakpoint
CREATE INDEX "moderation_case_assignee_idx" ON "moderation_case" USING btree ("assigned_to","status","updated_at");--> statement-breakpoint
CREATE INDEX "user_role_role_expiry_idx" ON "user_role" USING btree ("role","expires_at");
