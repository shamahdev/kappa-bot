CREATE TABLE "fingerprint_snapshots" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"listing_hash" text NOT NULL,
	"job_count" integer DEFAULT 0 NOT NULL,
	"subscription_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
