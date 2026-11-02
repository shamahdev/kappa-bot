CREATE TABLE "job_applications" (
	"company" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"external_id" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"location" text,
	"match_grade" text,
	"seen_job_id" integer,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_seen_job_id_seen_jobs_id_fk" FOREIGN KEY ("seen_job_id") REFERENCES "public"."seen_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_applications_user_posting_uidx" ON "job_applications" USING btree ("user_id","source","external_id");