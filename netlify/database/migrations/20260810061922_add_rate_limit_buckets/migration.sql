CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY,
	"count" integer DEFAULT 0 NOT NULL,
	"resets_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_reset_idx" ON "rate_limit_buckets" ("resets_at");