CREATE TABLE "listing_contact_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"access_count" integer DEFAULT 1 NOT NULL,
	"first_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_contact_access_count_positive" CHECK ("listing_contact_access"."access_count" > 0),
	CONSTRAINT "listing_contact_access_not_self" CHECK ("listing_contact_access"."buyer_id" <> "listing_contact_access"."seller_id"),
	CONSTRAINT "listing_contact_access_time_order" CHECK ("listing_contact_access"."first_accessed_at" <= "listing_contact_access"."last_accessed_at")
);
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_contact_access" ADD CONSTRAINT "listing_contact_access_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_contact_access" ADD CONSTRAINT "listing_contact_access_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_contact_access" ADD CONSTRAINT "listing_contact_access_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_contact_access_buyer_listing_unique" ON "listing_contact_access" USING btree ("buyer_id","listing_id");--> statement-breakpoint
CREATE INDEX "listing_contact_access_buyer_recent_idx" ON "listing_contact_access" USING btree ("buyer_id","last_accessed_at");--> statement-breakpoint
CREATE INDEX "listing_contact_access_seller_recent_idx" ON "listing_contact_access" USING btree ("seller_id","last_accessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");