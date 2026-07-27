CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY,
	"actor_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
	"id" serial PRIMARY KEY,
	"product_id" integer,
	"version" text NOT NULL,
	"release_date" timestamp with time zone NOT NULL,
	"new_features" jsonb DEFAULT '[]' NOT NULL,
	"improvements" jsonb DEFAULT '[]' NOT NULL,
	"bug_fixes" jsonb DEFAULT '[]' NOT NULL,
	"security_updates" jsonb DEFAULT '[]' NOT NULL,
	"breaking_changes" jsonb DEFAULT '[]' NOT NULL,
	"migration_instructions" text,
	"known_issues" jsonb DEFAULT '[]' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_options" (
	"id" serial PRIMARY KEY,
	"command_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"choices" jsonb DEFAULT '[]' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"required_permission" text NOT NULL,
	"required_role" text NOT NULL,
	"example_usage" text NOT NULL,
	"expected_response" text NOT NULL,
	"related_commands" jsonb DEFAULT '[]' NOT NULL,
	"common_errors" jsonb DEFAULT '[]' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_articles" (
	"id" serial PRIMARY KEY,
	"product_id" integer,
	"category_id" integer,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_only" boolean DEFAULT false NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"search_keywords" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_categories" (
	"id" serial PRIMARY KEY,
	"product_id" integer,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_feedback" (
	"id" serial PRIMARY KEY,
	"article_slug" text NOT NULL,
	"helpful" boolean NOT NULL,
	"comment" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY,
	"product_id" integer,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linked_discord_servers" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"product_id" integer,
	"discord_server_id" text NOT NULL,
	"server_name" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_licences" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"licence_reference" text NOT NULL UNIQUE,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_versions" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"version" text NOT NULL,
	"release_date" timestamp with time zone,
	"is_current" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"access_type" text DEFAULT 'paid' NOT NULL,
	"customer_only" boolean DEFAULT false NOT NULL,
	"logo_url" text,
	"support_available" boolean DEFAULT true NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_incidents" (
	"id" serial PRIMARY KEY,
	"service_id" integer,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"impact" text NOT NULL,
	"message" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"status" text DEFAULT 'operational' NOT NULL,
	"public_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_attachments" (
	"id" serial PRIMARY KEY,
	"ticket_id" integer NOT NULL,
	"message_id" integer,
	"blob_key" text NOT NULL UNIQUE,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY,
	"ticket_id" integer NOT NULL,
	"author_id" integer,
	"author_type" text NOT NULL,
	"message" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY,
	"ticket_number" text NOT NULL UNIQUE,
	"user_id" integer,
	"customer_name" text NOT NULL,
	"discord_username" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"email" text NOT NULL,
	"product" text NOT NULL,
	"server_name" text,
	"server_id" text,
	"category" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"steps_attempted" text,
	"relevant_command" text,
	"related_record_id" text,
	"error_message" text,
	"diagnostic_consent" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "troubleshooting_articles" (
	"id" serial PRIMARY KEY,
	"product_id" integer,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"symptoms" text NOT NULL,
	"causes" jsonb DEFAULT '[]' NOT NULL,
	"resolution" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"discord_id" text NOT NULL UNIQUE,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"email" text,
	"is_customer" boolean DEFAULT false NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_command_unique" ON "commands" ("product_id","name");--> statement-breakpoint
CREATE INDEX "documentation_search_idx" ON "documentation_articles" ("title","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_server_unique" ON "linked_discord_servers" ("user_id","discord_server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_version_unique" ON "product_versions" ("product_id","version");--> statement-breakpoint
CREATE INDEX "ticket_owner_idx" ON "support_tickets" ("user_id","status");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "command_options" ADD CONSTRAINT "command_options_command_id_commands_id_fkey" FOREIGN KEY ("command_id") REFERENCES "commands"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documentation_articles" ADD CONSTRAINT "documentation_articles_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documentation_articles" ADD CONSTRAINT "documentation_articles_mpjGumctusm9_fkey" FOREIGN KEY ("category_id") REFERENCES "documentation_categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "documentation_articles" ADD CONSTRAINT "documentation_articles_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "documentation_categories" ADD CONSTRAINT "documentation_categories_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documentation_feedback" ADD CONSTRAINT "documentation_feedback_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "linked_discord_servers" ADD CONSTRAINT "linked_discord_servers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "linked_discord_servers" ADD CONSTRAINT "linked_discord_servers_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "product_licences" ADD CONSTRAINT "product_licences_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_licences" ADD CONSTRAINT "product_licences_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_incidents" ADD CONSTRAINT "service_incidents_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticket_id_support_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_message_id_support_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "troubleshooting_articles" ADD CONSTRAINT "troubleshooting_articles_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;