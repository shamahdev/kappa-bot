ALTER TABLE "discord_connections" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "discord_connections" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "discord_connections" ADD COLUMN "token_expires_at" timestamp with time zone;