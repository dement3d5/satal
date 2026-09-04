CREATE TABLE "favorite_listing" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_listing_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"locale" varchar(8) NOT NULL,
	"query_text" varchar(120) DEFAULT '' NOT NULL,
	"category_id" uuid,
	"location_id" uuid,
	"price_min_minor" bigint,
	"price_max_minor" bigint,
	"sort" varchar(20) DEFAULT 'newest' NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_search_name_not_blank" CHECK (length(btrim("saved_search"."name")) > 0),
	CONSTRAINT "saved_search_price_min_non_negative" CHECK ("saved_search"."price_min_minor" is null or "saved_search"."price_min_minor" >= 0),
	CONSTRAINT "saved_search_price_max_non_negative" CHECK ("saved_search"."price_max_minor" is null or "saved_search"."price_max_minor" >= 0),
	CONSTRAINT "saved_search_price_range_valid" CHECK ("saved_search"."price_min_minor" is null or "saved_search"."price_max_minor" is null or "saved_search"."price_min_minor" <= "saved_search"."price_max_minor"),
	CONSTRAINT "saved_search_sort_valid" CHECK ("saved_search"."sort" in ('relevance', 'newest', 'price_asc', 'price_desc')),
	CONSTRAINT "saved_search_filters_array" CHECK (jsonb_typeof("saved_search"."filters") = 'array')
);
--> statement-breakpoint
ALTER TABLE "favorite_listing" ADD CONSTRAINT "favorite_listing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_listing" ADD CONSTRAINT "favorite_listing_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_locale_supported_locale_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."supported_locale"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorite_listing_user_created_idx" ON "favorite_listing" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "favorite_listing_listing_idx" ON "favorite_listing" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_search_owner_name_unique" ON "saved_search" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "saved_search_owner_updated_idx" ON "saved_search" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "saved_search_category_idx" ON "saved_search" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "saved_search_location_idx" ON "saved_search" USING btree ("location_id");