CREATE TABLE "posting_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"criteria_key" text NOT NULL,
	"posting" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posting_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"facts" jsonb,
	"evidence_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"claimed_at" timestamp with time zone,
	"retry_at" timestamp with time zone,
	"fetched_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "keyword_alternatives" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "work_environments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "minimum_salary" double precision;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "include_unspecified_salary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "include_unspecified_environment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posting_evaluations" ADD CONSTRAINT "posting_evaluations_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "posting_evaluations_subscription_posting_uidx" ON "posting_evaluations" USING btree ("subscription_id","source","external_id");--> statement-breakpoint
CREATE INDEX "posting_evaluations_status_created_idx" ON "posting_evaluations" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posting_facts_source_external_uidx" ON "posting_facts" USING btree ("source","external_id");