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
  ...timestamps,
});

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
  ...timestamps,
});

export const productVersions = pgTable("product_versions", {
  id: serial().primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  version: text().notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  isCurrent: boolean("is_current").default(false).notNull(),
  notes: text(),
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
