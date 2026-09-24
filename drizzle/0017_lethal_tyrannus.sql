ALTER TABLE "listing" ADD COLUMN "map_latitude" numeric(8, 5);--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "map_longitude" numeric(8, 5);--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "public_location_label" varchar(200);--> statement-breakpoint
ALTER TABLE "listing_draft" ADD COLUMN "map_latitude" numeric(8, 5);--> statement-breakpoint
ALTER TABLE "listing_draft" ADD COLUMN "map_longitude" numeric(8, 5);--> statement-breakpoint
ALTER TABLE "listing_draft" ADD COLUMN "public_location_label" varchar(200);--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_map_coordinates_pair" CHECK (("listing"."map_latitude" is null) = ("listing"."map_longitude" is null));--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_map_coordinates_range" CHECK (("listing"."map_latitude" is null and "listing"."map_longitude" is null) or ("listing"."map_latitude" between -90 and 90 and "listing"."map_longitude" between -180 and 180));--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_public_location_label_valid" CHECK ("listing"."public_location_label" is null or length(btrim("listing"."public_location_label")) between 2 and 200);--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_map_coordinates_pair" CHECK (("listing_draft"."map_latitude" is null) = ("listing_draft"."map_longitude" is null));--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_map_coordinates_range" CHECK (("listing_draft"."map_latitude" is null and "listing_draft"."map_longitude" is null) or ("listing_draft"."map_latitude" between -90 and 90 and "listing_draft"."map_longitude" between -180 and 180));--> statement-breakpoint
ALTER TABLE "listing_draft" ADD CONSTRAINT "listing_draft_public_location_label_valid" CHECK ("listing_draft"."public_location_label" is null or length(btrim("listing_draft"."public_location_label")) between 2 and 200);