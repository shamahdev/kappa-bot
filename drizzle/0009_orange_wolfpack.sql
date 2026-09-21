CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"company" text,
	"location" text,
	"ai_summary" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seen_jobs" ADD COLUMN "job_id" integer;--> statement-breakpoint
ALTER TABLE "seen_jobs" ADD COLUMN "match_score" smallint;--> statement-breakpoint
ALTER TABLE "seen_jobs" ADD COLUMN "match_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_src_ext_uidx" ON "jobs" USING btree ("source","external_id");--> statement-breakpoint
ALTER TABLE "seen_jobs" ADD CONSTRAINT "seen_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seen_jobs_job_idx" ON "seen_jobs" USING btree ("job_id")--> statement-breakpoint
INSERT INTO "jobs" ("source", "external_id", "url", "title", "company", "location")
SELECT "source", "external_id", MIN("url"), MIN("snapshot"->>'title'), MIN("snapshot"->>'company'), MIN("snapshot"->>'location')
FROM "seen_jobs" GROUP BY "source", "external_id"
ON CONFLICT ("source", "external_id") DO NOTHING--> statement-breakpoint
UPDATE "seen_jobs" "sj" SET "job_id" = "j"."id" FROM "jobs" "j" WHERE "j"."source" = "sj"."source" AND "j"."external_id" = "sj"."external_id" AND "sj"."job_id" IS NULL;