CREATE TABLE "cv_report_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"seen_id" integer NOT NULL,
	"report_id" integer,
	"posting" jsonb NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"keywords" text,
	"source" text NOT NULL,
	"postings" jsonb NOT NULL,
	"jobs" jsonb NOT NULL,
	"cv_filename" text,
	"cv_uploaded_at" timestamp with time zone,
	"factors" jsonb,
	"grade" text,
	"summary" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD CONSTRAINT "cv_report_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_report_deliveries" ADD CONSTRAINT "cv_report_deliveries_report_id_cv_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."cv_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_reports" ADD CONSTRAINT "cv_reports_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cv_report_delivery_seen_uidx" ON "cv_report_deliveries" USING btree ("seen_id");--> statement-breakpoint
CREATE INDEX "cv_report_delivery_subscription_idx" ON "cv_report_deliveries" USING btree ("subscription_id","id");--> statement-breakpoint
CREATE INDEX "cv_reports_user_created_idx" ON "cv_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "cv_reports_pending_idx" ON "cv_reports" USING btree ("status");