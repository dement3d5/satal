CREATE TYPE "public"."attribute_value_type" AS ENUM('text', 'integer', 'decimal', 'boolean', 'single_select', 'multi_select', 'date', 'measurement');--> statement-breakpoint
CREATE TYPE "public"."listing_draft_status" AS ENUM('draft', 'ready_for_review', 'submitted', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."location_kind" AS ENUM('country', 'economic_region', 'city', 'district', 'settlement', 'neighborhood', 'metro', 'street');--> statement-breakpoint
CREATE TYPE "public"."public_location_precision" AS ENUM('city', 'district', 'neighborhood');--> statement-breakpoint
CREATE TABLE "attribute_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value_type" "attribute_value_type" NOT NULL,
	"unit" varchar(32),
	"decimal_scale" smallint,
	"min_numeric" numeric(18, 4),
	"max_numeric" numeric(18, 4),
	"min_length" integer,
	"max_length" integer,
	"validation_pattern" text,
	"min_selections" smallint,
	"max_selections" smallint,
	"allow_custom_value" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_numeric_range_valid" CHECK ("attribute_definition"."min_numeric" is null or "attribute_definition"."max_numeric" is null or "attribute_definition"."min_numeric" <= "attribute_definition"."max_numeric"),
	CONSTRAINT "attribute_length_range_valid" CHECK ("attribute_definition"."min_length" is null or "attribute_definition"."max_length" is null or "attribute_definition"."min_length" <= "attribute_definition"."max_length"),
	CONSTRAINT "attribute_selection_range_valid" CHECK ("attribute_definition"."min_selections" is null or "attribute_definition"."max_selections" is null or "attribute_definition"."min_selections" <= "attribute_definition"."max_selections"),
	CONSTRAINT "measurement_requires_unit" CHECK ("attribute_definition"."value_type" <> 'measurement' or "attribute_definition"."unit" is not null)
);
--> statement-breakpoint
CREATE TABLE "attribute_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_option_attribute_id_unique" UNIQUE("attribute_id","id")
);
--> statement-breakpoint
CREATE TABLE "attribute_option_translation" (
	"option_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"label" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_option_translation_option_id_locale_pk" PRIMARY KEY("option_id","locale")
);
--> statement-breakpoint
CREATE TABLE "attribute_translation" (
	"attribute_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"label" varchar(160) NOT NULL,
	"help_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_translation_attribute_id_locale_pk" PRIMARY KEY("attribute_id","locale")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" varchar(120) NOT NULL,
	"depth" smallint NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_depth_range" CHECK ("category"."depth" between 0 and 2),
	CONSTRAINT "category_root_parent_consistency" CHECK (("category"."depth" = 0 and "category"."parent_id" is null) or ("category"."depth" > 0 and "category"."parent_id" is not null)),
	CONSTRAINT "category_schema_version_positive" CHECK ("category"."schema_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "category_attribute" (
	"category_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"filterable" boolean DEFAULT false NOT NULL,
	"searchable" boolean DEFAULT false NOT NULL,
	"sortable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_attribute_category_id_attribute_id_pk" PRIMARY KEY("category_id","attribute_id")
);
--> statement-breakpoint
CREATE TABLE "category_translation" (
	"category_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_translation_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "listing_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"category_schema_version" integer NOT NULL,
	"location_id" uuid,
	"public_location_precision" "public_location_precision" DEFAULT 'district' NOT NULL,
	"status" "listing_draft_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(180) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_minor" bigint,
	"currency" varchar(3) DEFAULT 'AZN' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_autosaved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_draft_schema_version_positive" CHECK ("listing_draft"."category_schema_version" > 0),
	CONSTRAINT "listing_draft_version_positive" CHECK ("listing_draft"."version" > 0),
	CONSTRAINT "listing_draft_price_non_negative" CHECK ("listing_draft"."price_minor" is null or "listing_draft"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "listing_draft_attribute_option_value" (
	"draft_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_draft_attribute_option_value_draft_id_attribute_id_option_id_pk" PRIMARY KEY("draft_id","attribute_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "listing_draft_attribute_value" (
	"draft_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"text_value" text,
	"integer_value" bigint,
	"decimal_value" numeric(18, 4),
	"boolean_value" boolean,
	"date_value" date,
	"option_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_draft_attribute_value_draft_id_attribute_id_pk" PRIMARY KEY("draft_id","attribute_id"),
	CONSTRAINT "draft_attribute_exactly_one_scalar_value" CHECK (num_nonnulls("listing_draft_attribute_value"."text_value", "listing_draft_attribute_value"."integer_value", "listing_draft_attribute_value"."decimal_value", "listing_draft_attribute_value"."boolean_value", "listing_draft_attribute_value"."date_value", "listing_draft_attribute_value"."option_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "listing_draft_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"from_status" "listing_draft_status" NOT NULL,
	"to_status" "listing_draft_status" NOT NULL,
	"reason" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" varchar(160) NOT NULL,
	"kind" "location_kind" NOT NULL,
	"depth" smallint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"source_name" varchar(120) NOT NULL,
	"source_id" varchar(160),
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_depth_range" CHECK ("location"."depth" between 0 and 7),
	CONSTRAINT "location_root_parent_consistency" CHECK (("location"."depth" = 0 and "location"."parent_id" is null) or ("location"."depth" > 0 and "location"."parent_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "location_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"alias" varchar(200) NOT NULL,
	"normalized_alias" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_translation" (
	"location_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_translation_location_id_locale_pk" PRIMARY KEY("location_id","locale")
);
--> statement-breakpoint
ALTER TABLE "attribute_option" ADD CONSTRAINT "attribute_option_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_option_translation" ADD CONSTRAINT "attribute_option_translation_option_id_attribute_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_option_translation" ADD CONSTRAINT "attribute_option_translation_locale_supported_locale_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."supported_locale"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_translation" ADD CONSTRAINT "attribute_translation_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_translation" ADD CONSTRAINT "attribute_translation_locale_supported_locale_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."supported_locale"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_locale_supported_locale_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."supported_locale"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_option_value" ADD CONSTRAINT "listing_draft_attribute_option_value_draft_id_listing_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."listing_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_option_value" ADD CONSTRAINT "listing_draft_attribute_option_value_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_option_value" ADD CONSTRAINT "listing_draft_attribute_option_value_option_id_attribute_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_option_value" ADD CONSTRAINT "draft_multi_option_belongs_to_attribute_fk" FOREIGN KEY ("attribute_id","option_id") REFERENCES "public"."attribute_option"("attribute_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_value" ADD CONSTRAINT "listing_draft_attribute_value_draft_id_listing_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."listing_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_value" ADD CONSTRAINT "listing_draft_attribute_value_attribute_id_attribute_definition_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_value" ADD CONSTRAINT "listing_draft_attribute_value_option_id_attribute_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_attribute_value" ADD CONSTRAINT "draft_scalar_option_belongs_to_attribute_fk" FOREIGN KEY ("attribute_id","option_id") REFERENCES "public"."attribute_option"("attribute_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_status_history" ADD CONSTRAINT "listing_draft_status_history_draft_id_listing_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."listing_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_draft_status_history" ADD CONSTRAINT "listing_draft_status_history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_parent_id_location_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_alias" ADD CONSTRAINT "location_alias_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_alias" ADD CONSTRAINT "location_alias_locale_supported_locale_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."supported_locale"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_translation" ADD CONSTRAINT "location_translation_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_translation" ADD CONSTRAINT "location_translation_locale_supported_locale_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."supported_locale"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_definition_key_unique" ON "attribute_definition" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_option_attribute_key_unique" ON "attribute_option" USING btree ("attribute_id","key");--> statement-breakpoint
CREATE INDEX "attribute_option_order_idx" ON "attribute_option" USING btree ("attribute_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "category_slug_unique" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "category_parent_order_idx" ON "category" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "category_attribute_render_order_idx" ON "category_attribute" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "category_attribute_search_projection_idx" ON "category_attribute" USING btree ("attribute_id","filterable","searchable","sortable");--> statement-breakpoint
CREATE INDEX "listing_draft_owner_status_updated_idx" ON "listing_draft" USING btree ("owner_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "listing_draft_category_status_idx" ON "listing_draft" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "listing_draft_location_idx" ON "listing_draft" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "draft_multi_option_projection_idx" ON "listing_draft_attribute_option_value" USING btree ("attribute_id","option_id");--> statement-breakpoint
CREATE INDEX "draft_attribute_projection_idx" ON "listing_draft_attribute_value" USING btree ("attribute_id","option_id");--> statement-breakpoint
CREATE INDEX "draft_status_history_draft_created_idx" ON "listing_draft_status_history" USING btree ("draft_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "location_slug_unique" ON "location" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "location_source_identity_unique" ON "location" USING btree ("source_name","source_id");--> statement-breakpoint
CREATE INDEX "location_parent_kind_order_idx" ON "location" USING btree ("parent_id","kind","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "location_alias_locale_normalized_unique" ON "location_alias" USING btree ("locale","normalized_alias");--> statement-breakpoint
CREATE INDEX "location_alias_location_idx" ON "location_alias" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "location_translation_locale_name_idx" ON "location_translation" USING btree ("locale","name");
--> statement-breakpoint
CREATE FUNCTION validate_category_parent_depth() RETURNS trigger AS $$
DECLARE
  parent_depth smallint;
BEGIN
  IF NEW.parent_id IS NULL THEN
    IF NEW.depth <> 0 THEN
      RAISE EXCEPTION 'root category must have depth 0';
    END IF;
    RETURN NEW;
  END IF;

  SELECT depth INTO parent_depth FROM category WHERE id = NEW.parent_id;
  IF parent_depth IS NULL OR NEW.depth <> parent_depth + 1 THEN
    RAISE EXCEPTION 'category depth must follow its parent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER category_parent_depth_guard
BEFORE INSERT OR UPDATE OF parent_id, depth ON category
FOR EACH ROW EXECUTE FUNCTION validate_category_parent_depth();
--> statement-breakpoint
CREATE FUNCTION validate_location_parent_depth() RETURNS trigger AS $$
DECLARE
  parent_depth smallint;
  parent_kind location_kind;
BEGIN
  IF NEW.parent_id IS NULL THEN
    IF NEW.depth <> 0 OR NEW.kind <> 'country' THEN
      RAISE EXCEPTION 'only a country can be a root location';
    END IF;
    RETURN NEW;
  END IF;

  SELECT depth, kind INTO parent_depth, parent_kind FROM location WHERE id = NEW.parent_id;
  IF parent_depth IS NULL OR NEW.depth <> parent_depth + 1 THEN
    RAISE EXCEPTION 'location depth must follow its parent';
  END IF;
  IF NOT (
    (parent_kind = 'country' AND NEW.kind IN ('economic_region', 'city', 'district')) OR
    (parent_kind = 'economic_region' AND NEW.kind IN ('city', 'district', 'settlement')) OR
    (parent_kind = 'city' AND NEW.kind IN ('district', 'settlement', 'neighborhood', 'metro', 'street')) OR
    (parent_kind = 'district' AND NEW.kind IN ('settlement', 'neighborhood', 'metro', 'street')) OR
    (parent_kind = 'settlement' AND NEW.kind IN ('neighborhood', 'street')) OR
    (parent_kind = 'neighborhood' AND NEW.kind = 'street')
  ) THEN
    RAISE EXCEPTION 'location kind is invalid beneath its parent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER location_parent_depth_guard
BEFORE INSERT OR UPDATE OF parent_id, depth, kind ON location
FOR EACH ROW EXECUTE FUNCTION validate_location_parent_depth();
