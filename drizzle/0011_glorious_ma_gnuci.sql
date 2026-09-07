CREATE TYPE "public"."review_status" AS ENUM('active', 'hidden');--> statement-breakpoint
CREATE TABLE "qualified_interaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"qualified_by" uuid NOT NULL,
	"qualified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qualified_interaction_participants_distinct" CHECK ("qualified_interaction"."buyer_id" <> "qualified_interaction"."seller_id"),
	CONSTRAINT "qualified_interaction_qualified_by_seller" CHECK ("qualified_interaction"."qualified_by" = "qualified_interaction"."seller_id")
);
--> statement-breakpoint
CREATE TABLE "user_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"body" varchar(1000),
	"status" "review_status" DEFAULT 'active' NOT NULL,
	"reveal_at" timestamp with time zone NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_review_rating_range" CHECK ("user_review"."rating" between 1 and 5),
	CONSTRAINT "user_review_participants_distinct" CHECK ("user_review"."author_id" <> "user_review"."subject_id"),
	CONSTRAINT "user_review_body_length" CHECK ("user_review"."body" is null or char_length(btrim("user_review"."body")) between 10 and 1000),
	CONSTRAINT "user_review_hidden_consistent" CHECK (("user_review"."status" = 'active' and "user_review"."hidden_at" is null) or ("user_review"."status" = 'hidden' and "user_review"."hidden_at" is not null)),
	CONSTRAINT "user_review_reveal_after_creation" CHECK ("user_review"."reveal_at" >= "user_review"."created_at")
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_identity_unique" UNIQUE("id","listing_id","buyer_id","seller_id");--> statement-breakpoint
ALTER TABLE "qualified_interaction" ADD CONSTRAINT "qualified_interaction_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_interaction" ADD CONSTRAINT "qualified_interaction_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_interaction" ADD CONSTRAINT "qualified_interaction_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_interaction" ADD CONSTRAINT "qualified_interaction_qualified_by_user_id_fk" FOREIGN KEY ("qualified_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_interaction" ADD CONSTRAINT "qualified_interaction_conversation_identity_fk" FOREIGN KEY ("conversation_id","listing_id","buyer_id","seller_id") REFERENCES "public"."conversation"("id","listing_id","buyer_id","seller_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review" ADD CONSTRAINT "user_review_interaction_id_qualified_interaction_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."qualified_interaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review" ADD CONSTRAINT "user_review_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review" ADD CONSTRAINT "user_review_subject_id_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qualified_interaction_listing_unique" ON "qualified_interaction" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qualified_interaction_conversation_unique" ON "qualified_interaction" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "qualified_interaction_buyer_recent_idx" ON "qualified_interaction" USING btree ("buyer_id","qualified_at");--> statement-breakpoint
CREATE INDEX "qualified_interaction_seller_recent_idx" ON "qualified_interaction" USING btree ("seller_id","qualified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_review_interaction_author_unique" ON "user_review" USING btree ("interaction_id","author_id");--> statement-breakpoint
CREATE INDEX "user_review_subject_visibility_idx" ON "user_review" USING btree ("subject_id","status","reveal_at","created_at");--> statement-breakpoint
CREATE INDEX "user_review_author_recent_idx" ON "user_review" USING btree ("author_id","created_at");
