CREATE TABLE "cv_profiles" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"filename" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
