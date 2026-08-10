import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: serial().primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text().notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  email: text(),
  isCustomer: boolean("is_customer").default(false).notNull(),
  isStaff: boolean("is_staff").default(false).notNull(),
  accountStatus: text("account_status").default("active").notNull(),
  customerRole: text("customer_role").default("customer").notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastLoginIpHash: text("last_login_ip_hash"),
  ...timestamps,
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid().defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roles: jsonb().$type<string[]>().default([]).notNull(),
  permissions: jsonb().$type<string[]>().default([]).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isOwner: boolean("is_owner").default(false).notNull(),
  isInGuild: boolean("is_in_guild").default(false).notNull(),
  csrfToken: text("csrf_token").notNull(),
  ipHash: text("ip_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("auth_session_user_idx").on(table.userId), index("auth_session_expiry_idx").on(table.expiresAt)]);


export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text().primaryKey(),
  count: integer().default(0).notNull(),
  resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("rate_limit_reset_idx").on(table.resetsAt)]);

export const staffRoles = pgTable("staff_roles", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text().notNull(),
  permissions: jsonb().$type<string[]>().default([]).notNull(),
  ...timestamps,
});

export const products = pgTable("products", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull(),
  category: text().notNull(),
  status: text().default("available").notNull(),
  accessType: text("access_type").default("paid").notNull(),
  customerOnly: boolean("customer_only").default(false).notNull(),
  logoUrl: text("logo_url"),
  supportAvailable: boolean("support_available").default(true).notNull(),
  published: boolean().default(true).notNull(),
  fullDescription: text("full_description").default("").notNull(),
  productType: text("product_type").default("software").notNull(),
  documentationUrl: text("documentation_url"),
  currentVersion: text("current_version").default("1.0").notNull(),
  artifactKey: text("artifact_key"),
  stripeProductId: text("stripe_product_id"),
  featured: boolean().default(false).notNull(),
  saleEligible: boolean("sale_eligible").default(true).notNull(),
  setupEligible: boolean("setup_eligible").default(false).notNull(),
  commerceEnabled: boolean("commerce_enabled").default(false).notNull(),
  oneTimePurchase: boolean("one_time_purchase").default(true).notNull(),
  selfHosted: boolean("self_hosted").default(true).notNull(),
  sourceIncluded: boolean("source_included").default(true).notNull(),
  noMonthlyLicenseFee: boolean("no_monthly_license_fee").default(true).notNull(),
  requirements: jsonb().$type<string[]>().default([]).notNull(),
  externalIntegrations: jsonb("external_integrations").$type<string[]>().default([]).notNull(),
  includedProductSlugs: jsonb("included_product_slugs").$type<string[]>().default([]).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  availabilityMessage: text("availability_message"),
  ...timestamps,
});

export const productVersions = pgTable("product_versions", {
  id: serial().primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  version: text().notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  isCurrent: boolean("is_current").default(false).notNull(),
  notes: text(),
  artifactKey: text("artifact_key"),
  downloadEnabled: boolean("download_enabled").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("product_version_unique").on(table.productId, table.version)]);

export const productLicences = pgTable("product_licences", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  licenceReference: text("licence_reference").notNull().unique(),
  status: text().default("active").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
});

export const productPrices = pgTable("product_prices", {
  id: uuid().defaultRandom().primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text().default("Standard").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text().default("usd").notNull(),
  stripePriceId: text("stripe_price_id").unique(),
  active: boolean().default(true).notNull(),
  isStartingAt: boolean("is_starting_at").default(false).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("product_price_active_idx").on(table.productId, table.active)]);

export const sales = pgTable("sales", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  description: text().default("").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  productIds: jsonb("product_ids").$type<number[]>().default([]).notNull(),
  allProducts: boolean("all_products").default(false).notNull(),
  minimumCartCents: integer("minimum_cart_cents").default(0).notNull(),
  maximumUses: integer("maximum_uses"),
  perUserLimit: integer("per_user_limit").default(1).notNull(),
  uses: integer().default(0).notNull(),
  enabled: boolean().default(true).notNull(),
  publicBadge: text("public_badge"),
  banner: text(),
  stripeCouponId: text("stripe_coupon_id"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const coupons = pgTable("coupons", {
  id: uuid().defaultRandom().primaryKey(),
  code: text().notNull().unique(),
  description: text().default("").notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  productIds: jsonb("product_ids").$type<number[]>().default([]).notNull(),
  maximumUses: integer("maximum_uses"),
  perUserLimit: integer("per_user_limit").default(1).notNull(),
  uses: integer().default(0).notNull(),
  enabled: boolean().default(true).notNull(),
  stripePromotionCodeId: text("stripe_promotion_code_id"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const orders = pgTable("orders", {
  id: uuid().defaultRandom().primaryKey(),
  sequenceId: serial("sequence_id").notNull().unique(),
  orderNumber: text("order_number").unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  paymentStatus: text("payment_status").default("pending").notNull(),
  fulfillmentStatus: text("fulfillment_status").default("pending").notNull(),
  subtotalCents: integer("subtotal_cents").default(0).notNull(),
  discountCents: integer("discount_cents").default(0).notNull(),
  totalCents: integer("total_cents").default(0).notNull(),
  currency: text().default("usd").notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCustomerId: text("stripe_customer_id"),
  couponCode: text("coupon_code"),
  ipHash: text("ip_hash"),
  maskedIp: text("masked_ip"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("order_user_idx").on(table.userId, table.createdAt), index("order_payment_idx").on(table.paymentStatus, table.fulfillmentStatus)]);

export const orderItems = pgTable("order_items", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  priceId: uuid("price_id").references(() => productPrices.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  productSlug: text("product_slug").notNull(),
  itemType: text("item_type").default("product").notNull(),
  quantity: integer().default(1).notNull(),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  stripePriceId: text("stripe_price_id"),
  metadata: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("order_item_order_idx").on(table.orderId)]);

export const payments = pgTable("payments", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeChargeId: text("stripe_charge_id"),
  status: text().notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text().default("usd").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  ...timestamps,
});

export const refunds = pgTable("refunds", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  stripeRefundId: text("stripe_refund_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text().default("usd").notNull(),
  status: text().notNull(),
  reason: text(),
  ...timestamps,
});

export const disputes = pgTable("disputes", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  stripeDisputeId: text("stripe_dispute_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  reason: text(),
  status: text().notNull(),
  previousStatus: text("previous_status"),
  amountCents: integer("amount_cents").notNull(),
  currency: text().default("usd").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  ...timestamps,
});

export const entitlements = pgTable("entitlements", {
  id: uuid().defaultRandom().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  status: text().default("active").notNull(),
  suspensionReason: text("suspension_reason"),
  maximumDownloads: integer("maximum_downloads"),
  downloadCount: integer("download_count").default(0).notNull(),
  abuseLockedUntil: timestamp("abuse_locked_until", { withTimezone: true }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  restoredAt: timestamp("restored_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("entitlement_order_product_unique").on(table.orderId, table.productId), index("entitlement_user_idx").on(table.userId, table.status)]);

export const downloads = pgTable("downloads", {
  id: uuid().defaultRandom().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  entitlementId: uuid("entitlement_id").references(() => entitlements.id, { onDelete: "set null" }),
  version: text().notNull(),
  result: text().notNull(),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("download_user_idx").on(table.userId, table.createdAt)]);

export const setupServices = pgTable("setup_services", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  status: text().default("awaiting_customer_information").notNull(),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  customerVisibleNote: text("customer_visible_note"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("setup_status_idx").on(table.status, table.createdAt)]);

export const setupIntakeSubmissions = pgTable("setup_intake_submissions", {
  id: uuid().defaultRandom().primaryKey(),
  setupServiceId: uuid("setup_service_id").notNull().references(() => setupServices.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  data: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const processedStripeEvents = pgTable("processed_stripe_events", {
  id: uuid().defaultRandom().primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  status: text().default("processing").notNull(),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("stripe_event_status_idx").on(table.status, table.createdAt)]);

export const staffNotes = pgTable("staff_notes", {
  id: uuid().defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  note: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("staff_note_entity_idx").on(table.entityType, table.entityId)]);

export const documentationCategories = pgTable("documentation_categories", {
  id: serial().primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
});

export const documentationArticles = pgTable("documentation_articles", {
  id: serial().primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => documentationCategories.id, { onDelete: "set null" }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  summary: text().notNull(),
  content: text().notNull(),
  status: text().default("draft").notNull(),
  customerOnly: boolean("customer_only").default(false).notNull(),
  version: text().default("1.0").notNull(),
  searchKeywords: text("search_keywords").default("").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("documentation_search_idx").on(table.title, table.slug)]);

export const commands = pgTable("commands", {
  id: serial().primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text().notNull(),
  category: text().notNull(),
  description: text().notNull(),
  requiredPermission: text("required_permission").notNull(),
  requiredRole: text("required_role").notNull(),
  exampleUsage: text("example_usage").notNull(),
  expectedResponse: text("expected_response").notNull(),
  relatedCommands: jsonb("related_commands").$type<string[]>().default([]).notNull(),
  commonErrors: jsonb("common_errors").$type<string[]>().default([]).notNull(),
  notes: text().default("").notNull(),
  published: boolean().default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("product_command_unique").on(table.productId, table.name)]);

export const commandOptions = pgTable("command_options", {
  id: serial().primaryKey(),
  commandId: integer("command_id").notNull().references(() => commands.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text().notNull(),
  required: boolean().default(false).notNull(),
  choices: jsonb().$type<string[]>().default([]).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const faqs = pgTable("faqs", {
  id: serial().primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  question: text().notNull(),
  answer: text().notNull(),
  category: text().default("general").notNull(),
  published: boolean().default(true).notNull(),
  ...timestamps,
});

export const troubleshootingArticles = pgTable("troubleshooting_articles", {
  id: serial().primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  symptoms: text().notNull(),
  causes: jsonb().$type<string[]>().default([]).notNull(),
  resolution: text().notNull(),
  published: boolean().default(true).notNull(),
  ...timestamps,
});

export const changelogEntries = pgTable("changelog_entries", {
  id: serial().primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  version: text().notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }).notNull(),
  newFeatures: jsonb("new_features").$type<string[]>().default([]).notNull(),
  improvements: jsonb().$type<string[]>().default([]).notNull(),
  bugFixes: jsonb("bug_fixes").$type<string[]>().default([]).notNull(),
  securityUpdates: jsonb("security_updates").$type<string[]>().default([]).notNull(),
  breakingChanges: jsonb("breaking_changes").$type<string[]>().default([]).notNull(),
  migrationInstructions: text("migration_instructions"),
  knownIssues: jsonb("known_issues").$type<string[]>().default([]).notNull(),
  published: boolean().default(true).notNull(),
  ...timestamps,
});

export const supportTickets = pgTable("support_tickets", {
  id: serial().primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  discordUsername: text("discord_username").notNull(),
  discordUserId: text("discord_user_id").notNull(),
  email: text().notNull(),
  product: text().notNull(),
  serverName: text("server_name"),
  serverId: text("server_id"),
  category: text().notNull(),
  priority: text().default("normal").notNull(),
  subject: text().notNull(),
  description: text().notNull(),
  stepsAttempted: text("steps_attempted"),
  relevantCommand: text("relevant_command"),
  relatedRecordId: text("related_record_id"),
  errorMessage: text("error_message"),
  diagnosticConsent: boolean("diagnostic_consent").default(false).notNull(),
  status: text().default("open").notNull(),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("ticket_owner_idx").on(table.userId, table.status)]);

export const supportMessages = pgTable("support_messages", {
  id: serial().primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  authorType: text("author_type").notNull(),
  message: text().notNull(),
  internal: boolean().default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const supportAttachments = pgTable("support_attachments", {
  id: serial().primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => supportMessages.id, { onDelete: "cascade" }),
  blobKey: text("blob_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer().notNull(),
  scanStatus: text("scan_status").default("quarantined").notNull(),
  customerAccessible: boolean("customer_accessible").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  status: text().default("operational").notNull(),
  publicMessage: text("public_message"),
  ...timestamps,
});

export const serviceIncidents = pgTable("service_incidents", {
  id: serial().primaryKey(),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
  title: text().notNull(),
  status: text().notNull(),
  impact: text().notNull(),
  message: text().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentationFeedback = pgTable("documentation_feedback", {
  id: serial().primaryKey(),
  articleSlug: text("article_slug").notNull(),
  helpful: boolean().notNull(),
  comment: text(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial().primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text().notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const linkedDiscordServers = pgTable("linked_discord_servers", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  discordServerId: text("discord_server_id").notNull(),
  serverName: text("server_name").notNull(),
  verified: boolean().default(false).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("linked_server_unique").on(table.userId, table.discordServerId)]);
