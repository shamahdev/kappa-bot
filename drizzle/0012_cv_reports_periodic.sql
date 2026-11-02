ALTER TABLE "cv_reports" DROP CONSTRAINT "cv_reports_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "cv_reports" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_reports" ALTER COLUMN "source" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD COLUMN "assessment" text;--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD COLUMN "factors" jsonb;--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "cv_report_deliveries" d SET "user_id" = substring(s."guild_id" from 4) FROM "subscriptions" s WHERE s."id" = d."subscription_id" AND s."guild_id" LIKE 'dm:%';--> statement-breakpoint
DELETE FROM "cv_report_deliveries" WHERE "user_id" IS NULL AND "report_id" IS NULL;--> statement-breakpoint
UPDATE "cv_report_deliveries" d SET "user_id" = r."user_id" FROM "cv_reports" r WHERE d."user_id" IS NULL AND r."id" = d."report_id";--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD COLUMN "trigger" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD COLUMN "window_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD COLUMN "window_start" timestamp with time zone;--> statement-breakpoint
UPDATE "cv_reports" r SET "window_start" = COALESCE((SELECT min(d."delivered_at") FROM "cv_report_deliveries" d WHERE d."report_id" = r."id"), r."created_at"), "window_end" = r."created_at";--> statement-breakpoint
ALTER TABLE "cv_reports" ALTER COLUMN "window_end" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_reports" ALTER COLUMN "window_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD CONSTRAINT "cv_reports_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_report_delivery_user_report_idx" ON "cv_report_deliveries" USING btree ("user_id","report_id");--> statement-breakpoint
ALTER TABLE "cv_reports" DROP COLUMN "postings";