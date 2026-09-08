CREATE TABLE "digest_messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"jobs" jsonb NOT NULL,
	"keyword" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "digest_messages_created_at_idx" ON "digest_messages" USING btree ("created_at");