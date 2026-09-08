ALTER TABLE "digest_messages" RENAME TO "delivery_messages";
--> statement-breakpoint
ALTER INDEX "digest_messages_created_at_idx" RENAME TO "delivery_messages_created_at_idx";
