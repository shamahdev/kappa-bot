CREATE TABLE "bot_config" (
	"id" smallint PRIMARY KEY NOT NULL,
	"poll_interval_minutes" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_config_id_check" CHECK ("bot_config"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seen_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"source" text DEFAULT 'linkedin' NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"snapshot" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"keywords" text,
	"location" text,
	"geo_id" text,
	"distance" integer,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text DEFAULT 'linkedin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seen_jobs" ADD CONSTRAINT "seen_jobs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_guild_idx" ON "channels" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seen_jobs_sub_src_ext_uidx" ON "seen_jobs" USING btree ("subscription_id","source","external_id");--> statement-breakpoint
CREATE INDEX "seen_jobs_url_idx" ON "seen_jobs" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seen_jobs_seen_at_idx" ON "seen_jobs" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "subs_guild_channel_idx" ON "subscriptions" USING btree ("guild_id","channel_id");--> statement-breakpoint
CREATE INDEX "subs_active_idx" ON "subscriptions" USING btree ("is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "subs_filters_gin" ON "subscriptions" USING gin ("filters");