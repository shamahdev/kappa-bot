ALTER TABLE "cv_report_deliveries" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD COLUMN "notification_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD COLUMN "summary_attempts" integer DEFAULT 0 NOT NULL;