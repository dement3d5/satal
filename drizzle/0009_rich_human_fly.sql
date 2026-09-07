CREATE TYPE "public"."conversation_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'processing', 'delivered', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('chat_message');--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"last_message_sequence" integer DEFAULT 0 NOT NULL,
	"buyer_read_sequence" integer DEFAULT 0 NOT NULL,
	"seller_read_sequence" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_participants_distinct" CHECK ("conversation"."buyer_id" <> "conversation"."seller_id"),
	CONSTRAINT "conversation_sequence_non_negative" CHECK ("conversation"."last_message_sequence" >= 0 and "conversation"."buyer_read_sequence" >= 0 and "conversation"."seller_read_sequence" >= 0),
	CONSTRAINT "conversation_read_sequences_bounded" CHECK ("conversation"."buyer_read_sequence" <= "conversation"."last_message_sequence" and "conversation"."seller_read_sequence" <= "conversation"."last_message_sequence"),
	CONSTRAINT "conversation_last_message_consistent" CHECK (("conversation"."last_message_sequence" = 0 and "conversation"."last_message_at" is null) or ("conversation"."last_message_sequence" > 0 and "conversation"."last_message_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "conversation_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"sender_id" uuid NOT NULL,
	"client_message_id" uuid NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_message_sequence_positive" CHECK ("conversation_message"."sequence" > 0),
	CONSTRAINT "conversation_message_body_length" CHECK (char_length(btrim("conversation_message"."body")) between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"actor_id" uuid,
	"listing_id" uuid,
	"conversation_id" uuid,
	"message_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_chat_references_required" CHECK ("notification"."type" <> 'chat_message' or ("notification"."actor_id" is not null and "notification"."listing_id" is not null and "notification"."conversation_id" is not null and "notification"."message_id" is not null)),
	CONSTRAINT "notification_actor_not_recipient" CHECK ("notification"."actor_id" is null or "notification"."actor_id" <> "notification"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_at" timestamp with time zone,
	"lease_owner" varchar(100),
	"delivered_at" timestamp with time zone,
	"provider_message_id" varchar(240),
	"last_error" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_delivery_attempts_non_negative" CHECK ("notification_delivery"."attempts" >= 0),
	CONSTRAINT "notification_delivery_delivered_at_consistent" CHECK ("notification_delivery"."status" <> 'delivered' or "notification_delivery"."delivered_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preference_user_id_type_pk" PRIMARY KEY("user_id","type")
);
--> statement-breakpoint
CREATE TABLE "user_block" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "user_block_not_self" CHECK ("user_block"."blocker_id" <> "user_block"."blocked_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "listing_id_seller_unique" ON "listing" USING btree ("id","seller_id");--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_listing_seller_fk" FOREIGN KEY ("listing_id","seller_id") REFERENCES "public"."listing"("id","seller_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_message_id_conversation_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversation_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_listing_buyer_unique" ON "conversation" USING btree ("listing_id","buyer_id");--> statement-breakpoint
CREATE INDEX "conversation_buyer_recent_idx" ON "conversation" USING btree ("buyer_id","last_message_at","id");--> statement-breakpoint
CREATE INDEX "conversation_seller_recent_idx" ON "conversation" USING btree ("seller_id","last_message_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_message_sequence_unique" ON "conversation_message" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_message_client_unique" ON "conversation_message" USING btree ("conversation_id","sender_id","client_message_id");--> statement-breakpoint
CREATE INDEX "conversation_message_sender_recent_idx" ON "conversation_message" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipient_message_unique" ON "notification" USING btree ("recipient_id","message_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_unread_idx" ON "notification" USING btree ("recipient_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_channel_unique" ON "notification_delivery" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE INDEX "notification_delivery_pending_idx" ON "notification_delivery" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "user_block_blocked_idx" ON "user_block" USING btree ("blocked_id","created_at");
