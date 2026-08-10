CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token_hash" text NOT NULL UNIQUE,
	"user_id" integer NOT NULL,
	"roles" jsonb DEFAULT '[]' NOT NULL,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"is_in_guild" boolean DEFAULT false NOT NULL,
	"csrf_token" text NOT NULL,
	"ip_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"description" text DEFAULT '' NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"product_ids" jsonb DEFAULT '[]' NOT NULL,
	"maximum_uses" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"stripe_promotion_code_id" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"stripe_dispute_id" text NOT NULL UNIQUE,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"reason" text,
	"status" text NOT NULL,
	"previous_status" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"order_id" uuid NOT NULL,
	"entitlement_id" uuid,
	"version" text NOT NULL,
	"result" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"suspension_reason" text,
	"maximum_downloads" integer,
	"download_count" integer DEFAULT 0 NOT NULL,
	"abuse_locked_until" timestamp with time zone,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_at" timestamp with time zone,
	"restored_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"price_id" uuid,
	"product_name" text NOT NULL,
	"product_slug" text NOT NULL,
	"item_type" text DEFAULT 'product' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"stripe_price_id" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"sequence_id" serial UNIQUE,
	"order_number" text UNIQUE,
	"user_id" integer NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_checkout_session_id" text UNIQUE,
	"stripe_payment_intent_id" text,
	"stripe_customer_id" text,
	"coupon_code" text,
	"ip_hash" text,
	"masked_ip" text,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"stripe_payment_intent_id" text UNIQUE,
	"stripe_charge_id" text,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_stripe_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"stripe_event_id" text NOT NULL UNIQUE,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"product_id" integer NOT NULL,
	"label" text DEFAULT 'Standard' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_price_id" text UNIQUE,
	"active" boolean DEFAULT true NOT NULL,
	"is_starting_at" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"stripe_refund_id" text NOT NULL UNIQUE,
	"stripe_payment_intent_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"product_ids" jsonb DEFAULT '[]' NOT NULL,
	"all_products" boolean DEFAULT false NOT NULL,
	"minimum_cart_cents" integer DEFAULT 0 NOT NULL,
	"maximum_uses" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"public_badge" text,
	"banner" text,
	"stripe_coupon_id" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_intake_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"setup_service_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"status" text DEFAULT 'awaiting_customer_information' NOT NULL,
	"assigned_to" integer,
	"customer_visible_note" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"author_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_versions" ADD COLUMN "artifact_key" text;--> statement-breakpoint
ALTER TABLE "product_versions" ADD COLUMN "download_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "full_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_type" text DEFAULT 'software' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "documentation_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "current_version" text DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "artifact_key" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "setup_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "commerce_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "one_time_purchase" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "self_hosted" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_included" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "no_monthly_license_fee" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "requirements" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "external_integrations" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "included_product_slugs" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "availability_message" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "customer_role" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_ip_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_customer_id_key" UNIQUE("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_expiry_idx" ON "auth_sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "download_user_idx" ON "downloads" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_order_product_unique" ON "entitlements" ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "entitlement_user_idx" ON "entitlements" ("user_id","status");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX "order_user_idx" ON "orders" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_payment_idx" ON "orders" ("payment_status","fulfillment_status");--> statement-breakpoint
CREATE INDEX "stripe_event_status_idx" ON "processed_stripe_events" ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_price_active_idx" ON "product_prices" ("product_id","active");--> statement-breakpoint
CREATE INDEX "setup_status_idx" ON "setup_services" ("status","created_at");--> statement-breakpoint
CREATE INDEX "staff_note_entity_idx" ON "staff_notes" ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_entitlement_id_entitlements_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "entitlements"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_id_product_prices_id_fkey" FOREIGN KEY ("price_id") REFERENCES "product_prices"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "setup_intake_submissions" ADD CONSTRAINT "setup_intake_submissions_q8Oa4MZuRsYj_fkey" FOREIGN KEY ("setup_service_id") REFERENCES "setup_services"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "setup_intake_submissions" ADD CONSTRAINT "setup_intake_submissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "setup_services" ADD CONSTRAINT "setup_services_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "setup_services" ADD CONSTRAINT "setup_services_order_item_id_order_items_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "setup_services" ADD CONSTRAINT "setup_services_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "setup_services" ADD CONSTRAINT "setup_services_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "setup_services" ADD CONSTRAINT "setup_services_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
INSERT INTO "products" (
  "slug", "name", "description", "full_description", "category", "status", "access_type",
  "customer_only", "support_available", "published", "product_type", "documentation_url",
  "current_version", "artifact_key", "featured", "sale_eligible", "setup_eligible",
  "commerce_enabled", "requirements", "external_integrations", "included_product_slugs", "sort_order"
) VALUES
('dm-relay', 'DM RELAY', 'Private Discord communication relay for owner and staff contact.', 'Private Discord communication relay with owner reply, close, block, attachment forwarding, and MySQL persistence.', 'Discord / Automation', 'active', 'paid', false, true, true, 'software', '/docs/dm-relay/', 'Buyer release', 'products/dm-relay/DM-RELAY-Buyer-Ready.zip', true, true, true, true, '["Python 3.9+","Discord application","MySQL or MariaDB"]', '["Discord","MySQL or MariaDB"]', '[]', 10),
('manager', 'Manager', 'Discord and FiveM management with vehicles, Tebex, FiveGuard, tags, and statistics.', 'Multi-purpose Discord and FiveM management with database-backed configuration and optional service integrations.', 'Discord / FiveM', 'active', 'paid', false, true, true, 'software', '/docs/manager/', 'Buyer release', 'products/manager/Manager-Buyer-Ready.zip', true, true, true, true, '["Node.js 18+","MySQL or MariaDB"]', '["Discord","FiveM","Tebex optional","FiveGuard optional"]', '[]', 20),
('scarlett', 'Scarlett', 'Advanced Discord and FiveM moderation, verification, roles, protection, and status.', 'Discord and FiveM community management with moderation, status monitoring, verification, global tools, and MySQL storage.', 'Discord / FiveM', 'active', 'paid', false, true, true, 'software', '/docs/scarlett/', 'Buyer release', 'products/scarlett/Scarlett-Buyer-Ready-Full.zip', true, true, true, true, '["Node.js 18+","MySQL or MariaDB","FiveM optional"]', '["Discord","FiveM optional","MySQL or MariaDB"]', '[]', 30),
('leo-toolkit', 'LEO TOOLKIT', 'Google Sheets powered law enforcement roster and personnel management.', 'Discord roster and department management client requiring a compatible backend API and Google Sheets integration.', 'Discord / Automation', 'active', 'paid', false, true, true, 'software', '/docs/leo-toolkit/', 'Buyer release', 'products/leo-toolkit/LEO-TOOLKIT-Buyer-Ready.zip', true, true, true, true, '["Python 3.8+","Compatible backend API","Google Cloud service account"]', '["Discord","Google Sheets","Google Cloud","Companion backend"]', '[]', 40),
('iaa-bot', 'IAA BOT', 'Internal Affairs, Discord OAuth authorization, intelligence, cases, and secured workflows.', 'Discord Internal Affairs and intelligence client requiring a compatible HTTPS website/backend, Discord OAuth2, and signed API.', 'Discord / Automation / Web', 'active', 'paid', false, true, true, 'software', '/docs/iaa-bot/', 'Buyer release', 'products/iaa-bot/IAA-BOT-Buyer-Ready.zip', true, true, true, true, '["Python 3.11+","HTTPS website/backend","Discord OAuth2","Compatible signed API"]', '["Discord","Discord OAuth2","Companion website/backend"]', '[]', 50),
('complete-bot-bundle', 'Complete Bot Bundle', 'All five Kruiger Labs buyer-ready bots in one purchase.', 'Includes DM RELAY, Manager, Scarlett, LEO TOOLKIT, and IAA BOT. Individual value is $164.95; bundle savings are $44.96.', 'Bundle', 'active', 'paid', false, true, true, 'bundle', '/docs/', 'Buyer release', NULL, true, true, true, true, '["Runtime and integration requirements vary by included product"]', '["Discord","FiveM optional","MySQL or MariaDB","Google Sheets","Discord OAuth2"]', '["dm-relay","manager","scarlett","leo-toolkit","iaa-bot"]', 5),
('basic-bot-installation', 'Basic Bot Installation', 'Dependency installation and process startup for a supported purchased bot.', 'Installation service covering runtime verification, dependency installation, startup configuration, and initial process launch.', 'Setup Service', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["dm-relay","manager","scarlett","leo-toolkit","iaa-bot"]', 100),
('discord-configuration', 'Discord Configuration', 'Discord application, invite, intents, IDs, and role hierarchy configuration.', 'Configuration service for a customer-owned Discord application and the non-secret Discord IDs required by the purchased product.', 'Setup Service', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["dm-relay","manager","scarlett","leo-toolkit","iaa-bot"]', 110),
('mysql-setup', 'MySQL Setup', 'Database creation, access configuration, and required schema import.', 'Database service for supported MySQL or MariaDB products. Credentials remain customer-controlled.', 'Setup Service', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["dm-relay","manager","scarlett"]', 120),
('fivem-integration-setup', 'FiveM Integration Setup', 'Connect supported FiveM status, CFX, and server settings.', 'Configuration service for supported Scarlett or Manager FiveM integration using customer-provided non-secret server information.', 'Setup Service', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["manager","scarlett"]', 130),
('leo-sheets-backend-setup', 'LEO TOOLKIT Sheets / Backend Setup', 'Configure an existing compatible backend, service account, and department sheets.', 'Setup covers a compatible existing backend. Custom backend development or major spreadsheet redesign requires a separate quote.', 'Setup Service', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["leo-toolkit"]', 140),
('iaa-website-oauth-backend-setup', 'IAA BOT Website / OAuth / Backend Setup', 'Configure an existing compatible IAA website/backend, OAuth application, and signed API.', 'Setup covers a compatible existing website/backend. A complete custom OAuth or backend platform requires a separate quote.', 'Setup Service', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["iaa-bot"]', 150),
('full-setup-dm-relay', 'DM RELAY Full Setup', 'Complete supported installation and configuration service for DM RELAY.', 'Full setup for the buyer-ready product within the documented scope. Customer-owned credentials remain private.', 'Full Setup', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["dm-relay"]', 200),
('full-setup-manager', 'Manager Full Setup', 'Complete supported installation and configuration service for Manager.', 'Full setup for the buyer-ready product and supported configured integrations within the agreed scope.', 'Full Setup', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["manager"]', 210),
('full-setup-scarlett', 'Scarlett Full Setup', 'Complete supported installation and configuration service for Scarlett.', 'Full setup for the buyer-ready product and supported configured integrations within the agreed scope.', 'Full Setup', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["scarlett"]', 220),
('full-setup-leo-toolkit', 'LEO TOOLKIT Full Setup', 'Full deployment using a compatible backend, starting at the listed price.', 'Custom backend development beyond a compatible existing backend requires a separate quote.', 'Full Setup', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["leo-toolkit"]', 230),
('full-setup-iaa-bot', 'IAA BOT Full Setup', 'Full deployment using a compatible website/backend, starting at the listed price.', 'Custom OAuth platform or backend development beyond a compatible existing system requires a separate quote.', 'Full Setup', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["iaa-bot"]', 240),
('full-deployment-complete-bundle', 'Complete Bundle Full Deployment', 'Full deployment of the five-product bundle, starting at the listed price.', 'Deployment scope depends on hosting, databases, FiveM, Google services, and compatible backend availability. Custom development is quoted separately.', 'Full Setup', 'active', 'paid', true, true, false, 'setup_service', NULL, 'Service', NULL, false, false, false, true, '[]', '[]', '["complete-bot-bundle"]', 250),
('custom-integration-development', 'Custom Integration / Development', 'Custom commands, websites, APIs, migrations, OAuth, FiveM, Discord, Google Sheets, and licensing work.', 'Quoted development outside normal setup scope. Use the existing Kruiger Labs contact or support system.', 'Custom Development', 'active', 'quote', false, true, true, 'custom', NULL, 'Custom', NULL, false, false, false, false, '[]', '[]', '[]', 300)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "full_description" = EXCLUDED."full_description",
  "category" = EXCLUDED."category",
  "product_type" = EXCLUDED."product_type",
  "documentation_url" = EXCLUDED."documentation_url",
  "artifact_key" = COALESCE("products"."artifact_key", EXCLUDED."artifact_key"),
  "requirements" = EXCLUDED."requirements",
  "external_integrations" = EXCLUDED."external_integrations",
  "included_product_slugs" = EXCLUDED."included_product_slugs",
  "setup_eligible" = EXCLUDED."setup_eligible",
  "commerce_enabled" = EXCLUDED."commerce_enabled",
  "sort_order" = EXCLUDED."sort_order";
--> statement-breakpoint
INSERT INTO "product_prices" ("product_id", "label", "amount_cents", "currency", "active", "is_starting_at")
SELECT p.id, v.label, v.amount_cents, 'usd', true, v.is_starting_at
FROM (VALUES
  ('dm-relay', 'Software', 1499, false),
  ('manager', 'Software', 2499, false),
  ('scarlett', 'Software', 3499, false),
  ('leo-toolkit', 'Software', 3999, false),
  ('iaa-bot', 'Software', 4999, false),
  ('complete-bot-bundle', 'Bundle', 11999, false),
  ('basic-bot-installation', 'Setup service', 1499, false),
  ('discord-configuration', 'Setup service', 999, false),
  ('mysql-setup', 'Setup service', 999, false),
  ('fivem-integration-setup', 'Setup service', 1999, false),
  ('leo-sheets-backend-setup', 'Setup service', 2999, false),
  ('iaa-website-oauth-backend-setup', 'Setup service', 4999, false),
  ('full-setup-dm-relay', 'Full setup', 7499, false),
  ('full-setup-manager', 'Full setup', 9999, false),
  ('full-setup-scarlett', 'Full setup', 11999, false),
  ('full-setup-leo-toolkit', 'Full setup', 14999, true),
  ('full-setup-iaa-bot', 'Full setup', 19999, true),
  ('full-deployment-complete-bundle', 'Full deployment', 34999, true)
) AS v(slug, label, amount_cents, is_starting_at)
JOIN "products" p ON p.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM "product_prices" pp WHERE pp.product_id = p.id AND pp.active = true
);
