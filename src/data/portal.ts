export type CommandOption = { name: string; description: string; required?: boolean; choices?: string[] };
export type BotCommand = {
  name: string;
  category: string;
  description: string;
  permission: string;
  role: string;
  options: CommandOption[];
  example: string;
  response: string;
  related: string[];
  errors: string[];
  notes: string;
};

const option = (name: string, description?: string, choices?: string[]): CommandOption => ({
  name,
  description: description || `Provides the ${name.replaceAll("_", " ")} for this command.`,
  choices,
});

const permissions: Record<string, [string, string]> = {
  Cases: ["Manage cases", "Investigator"], Investigations: ["Manage investigations", "Investigator"],
  Blacklists: ["Submit blacklist requests", "Staff"], Punishments: ["Submit punishment requests", "Staff"],
  Reviews: ["Review assigned submissions", "Reviewer"], Appeals: ["Manage appeals", "Internal Affairs Command"],
  Records: ["View authorised records", "Investigator"], Configuration: ["Configure server settings", "System Administrator"],
  Administration: ["Administer the product", "System Administrator"], Information: ["Use application commands", "Read Only"],
};

function command(name: string, category: string, description: string, options: (string | CommandOption)[] = [], overrides: Partial<BotCommand> = {}): BotCommand {
  const [permission, role] = permissions[category];
  return {
    name, category, description, permission, role,
    options: options.map((item) => typeof item === "string" ? option(item) : item),
    example: `${name}${options.length ? ` ${options.slice(0, 2).map((item) => `${typeof item === "string" ? item : item.name}:…`).join(" ")}` : ""}`,
    response: "Returns a structured Discord embed confirming the action and records the event in the relevant audit trail.",
    related: [],
    errors: ["You do not have the configured role.", "The server setup is incomplete.", "The referenced record could not be found."],
    notes: "Availability is controlled by the server's configurable Discord role mappings and privacy policy.",
    ...overrides,
  };
}

const caseTypes = ["User", "Server", "Staff", "Punishment", "Blacklist", "Misconduct", "Appeal", "Other"];
const priorities = ["Low", "Normal", "High", "Critical"];
const punishmentTypes = ["Warning", "Strike", "Verbal Warning", "Written Warning", "Suspension", "Demotion", "Removal", "Department Blacklist", "Community Blacklist", "Temporary Ban", "Permanent Ban", "Other"];

export const commands: BotCommand[] = [
  command("/case create", "Cases", "Creates a new Internal Affairs case.", [option("type", "Case classification.", caseTypes), "subject", "reason", option("priority", "Operational priority.", priorities), "confidential", "assigned_investigator", "evidence", "notes"], {
    response: "Generates a unique case number, posts a professional case embed in the configured case channel, creates a private or staff-only thread, records the creator and timestamp, sets status to Open, and notifies an assigned investigator.", related: ["/case user", "/case server", "/case view"] }),
  command("/case user", "Cases", "Creates a case involving a Discord user.", ["member", "reason", option("priority", "Operational priority.", priorities), "evidence", "assigned_investigator", "confidential"], {
    response: "Creates the user case, checks information available to the bot, lists visible mutual servers, flags configured risk keywords only as review indicators, posts findings in the case thread, and creates an investigation log. It never claims access to servers where the bot is not installed.", related: ["/investigate user", "/record user"] }),
  command("/case server", "Cases", "Creates an investigation involving a Discord server.", ["server_id", "server_name", "reason", "owner_id", "invite", option("priority", "Operational priority.", priorities), "evidence", "assigned_investigator"], {
    response: "Creates a server-investigation case, stores supplied server details, creates a review thread, checks prior records, shows blacklist or investigation history, and writes to the configured server-investigation log.", related: ["/investigate server", "/record server"] }),
  command("/case view", "Cases", "Displays an authorised case record.", ["case_number"], { related: ["/case history", "/case export"] }),
  command("/case search", "Cases", "Searches cases using one or more filters.", ["query", "status", option("type", "Case classification.", caseTypes), "investigator", "subject", "date_range"]),
  command("/case update", "Cases", "Updates case information.", ["case_number", "status", option("priority", "Operational priority.", priorities), "assigned_investigator", "reason", "notes"]),
  command("/case assign", "Cases", "Assigns or reassigns an investigator.", ["case_number", "investigator"]),
  command("/case close", "Cases", "Closes a case with a final outcome.", ["case_number", "outcome", "summary", "final_action", "evidence_summary"]),
  command("/case reopen", "Cases", "Reopens a closed case.", ["case_number", "reason"]),
  command("/case delete", "Cases", "Deletes or archives a case after explicit confirmation.", ["case_number", "reason", "confirmation"], { permission: "Permanently manage case data", role: "Bot Owner", notes: "Highly restricted. The bot requires confirmation, records the actor and reason, and prefers archival where retention policy permits." }),
  command("/case export", "Cases", "Creates a downloadable or copyable case summary.", ["case_number", option("format", "Export representation.", ["Text", "Markdown", "JSON", "PDF-ready report data"])], { response: "Produces a privacy-filtered export in the requested format according to the operator's export permission." }),
  command("/case history", "Cases", "Displays the full history and audit trail of a case.", ["case_number"]),
  command("/case note", "Cases", "Adds an internal note to a case.", ["case_number", "note", "confidential"]),
  command("/case evidence", "Cases", "Adds evidence to a case.", ["case_number", "evidence_type", "description", "attachment", "link"]),

  command("/investigate user", "Investigations", "Begins or updates a user investigation.", ["member", "reason", "case_number", "evidence", option("priority", "Operational priority.", priorities)], { response: "Displays known cases, blacklist and punishment history, visible mutual servers, and configured risk indicators; writes findings to the investigation thread and records the operator." }),
  command("/investigate server", "Investigations", "Begins or updates a server investigation.", ["server_id", "reason", "case_number", "invite", "owner_id", "evidence"]),
  command("/investigate staff", "Investigations", "Creates an investigation involving a staff member.", ["member", "reason", "department", "rank", option("priority", "Operational priority.", priorities), "evidence", "confidential"]),
  command("/investigate lookup", "Investigations", "Searches existing investigation records.", ["user", "server_id", "case_number"]),

  command("/blacklistuser request", "Blacklists", "Submits a user-blacklist request for review.", ["member", "reason", "evidence", "case_number", "severity", "duration", "notes"], { response: "Posts an embed to the configured review channel, records submitter and case, creates a discussion thread, runs permitted mutual-server checks, and shows Approve and Deny controls. Self-approval is blocked unless configured. Each review updates the original message; approved stage-one requests move to High Command and the completed request shows both reviewers." }),
  command("/blacklistuser view", "Blacklists", "Displays a user blacklist record.", ["member", "user_id"]),
  command("/blacklistuser remove", "Blacklists", "Submits or completes a user-blacklist removal.", ["member", "reason", "evidence", "authorisation"]),
  command("/blacklistuser history", "Blacklists", "Displays a user's blacklist history.", ["member", "user_id"]),
  command("/blacklistserver request", "Blacklists", "Submits a server-blacklist request for review.", ["server_id", "server_name", "reason", "owner_id", "invite", "evidence", "case_number", "severity", "notes"], { response: "Posts to the correct review channel with Approve and Deny controls, creates a discussion thread, shows previous server investigations, enforces the configured review count, forwards approved stage-one requests to High Command, and updates the original request with the final decision and reviewer names." }),
  command("/blacklistserver view", "Blacklists", "Displays a blacklisted server record.", ["server_id"]),
  command("/blacklistserver remove", "Blacklists", "Removes or requests removal of a server blacklist.", ["server_id", "reason", "evidence", "authorisation"]),
  command("/blacklistserver history", "Blacklists", "Displays a server's blacklist and investigation history.", ["server_id"]),
  command("/blacklist search", "Blacklists", "Searches all blacklist records.", ["query", "type", "status", "severity"]),

  command("/punishment request", "Punishments", "Submits a punishment request against a member or staff member.", ["member", option("punishment_type", "Requested action.", punishmentTypes), "reason", "duration", "evidence", "case_number", "department", "notes"], {
    response: "Sends the request to the configured first-stage channel with Approve and Deny controls and a restricted thread. It presents authorised related records and visible mutual-server findings. After the required first review, it moves to the configured High Command channel for a distinct final reviewer unless override is authorised. Completion updates the original message with status, submitter, both reviewers, dates, final reason, and case number.", related: ["/review approve", "/review deny", "/review request-info"] }),
  command("/punishment view", "Punishments", "Displays a punishment request or completed punishment.", ["request_id", "member"]),
  command("/punishment history", "Punishments", "Displays a member's punishment history.", ["member", "user_id"]),
  command("/punishment revoke", "Punishments", "Revokes an active punishment.", ["punishment_id", "reason", "authorisation"]),
  command("/punishment edit", "Punishments", "Edits a pending punishment request.", ["request_id", option("punishment_type", "Requested action.", punishmentTypes), "duration", "reason", "evidence", "notes"]),
  command("/punishment cancel", "Punishments", "Cancels a pending punishment request.", ["request_id", "reason"]),

  command("/review approve", "Reviews", "Approves a pending submission at the current review stage.", ["request_id", "reason", "notes"], { response: "Records the reviewer and reason, updates the original request, and either advances it to final review or completes it when the final stage is satisfied." }),
  command("/review deny", "Reviews", "Denies a pending submission at the current review stage.", ["request_id", "reason", "notes"], { response: "Records the reviewer and reason, marks the request Denied, notifies the submitter, and updates the original request message." }),
  command("/review request-info", "Reviews", "Requests additional information from the submitter.", ["request_id", "information_needed"]),
  command("/review override", "Reviews", "Overrides a review decision when authorised.", ["request_id", "decision", "reason"], { permission: "Override final decisions", role: "Bot Owner / authorised High Command", notes: "Limited to the highest configured roles. Every override is confirmed and written to the audit log." }),
  command("/review queue", "Reviews", "Displays pending reviews.", ["type", option("priority", "Operational priority.", priorities), "stage", "reviewer"]),
  command("/review claim", "Reviews", "Claims a pending review.", ["request_id"]),
  command("/review release", "Reviews", "Releases a claimed review.", ["request_id", "reason"]),
  command("/review history", "Reviews", "Shows completed reviews for a reviewer or request.", ["reviewer", "request_id"]),

  command("/appeal create", "Appeals", "Creates an appeal record.", ["member", "punishment_id", "reason", "evidence", "statement"]),
  command("/appeal view", "Appeals", "Displays an appeal.", ["appeal_id"]),
  command("/appeal approve", "Appeals", "Approves an appeal and records the resulting action.", ["appeal_id", "reason", "action"]),
  command("/appeal deny", "Appeals", "Denies an appeal.", ["appeal_id", "reason"]),
  command("/appeal history", "Appeals", "Displays appeal history.", ["member", "user_id"]),

  command("/record user", "Records", "Displays the available Internal Affairs record for a user.", ["member", "user_id"], { response: "Shows authorised open and closed cases, blacklist, punishment, appeal and investigation history, staff notes, and permitted mutual-server findings." }),
  command("/record server", "Records", "Displays the available record for a Discord server.", ["server_id"]),
  command("/record add-note", "Records", "Adds an authorised administrative note.", ["subject", "note", "visibility"]),
  command("/record remove-note", "Records", "Removes an administrative note with a reason.", ["note_id", "reason"]),

  command("/setup", "Configuration", "Starts the guided IAA BOT setup wizard.", [], { response: "Guides administrators through roles, channels, notifications, review requirements, branding, numbering, threads, mentions, and data-retention settings." }),
  command("/config view", "Configuration", "Displays the current server configuration."),
  command("/config channel", "Configuration", "Updates a configured channel.", ["channel_type", "channel"]),
  command("/config role", "Configuration", "Updates a configured permission-group role.", ["permission_group", "role"]),
  command("/config reviews", "Configuration", "Configures review requirements.", ["request_type", "first_stage_reviews", "final_stage_reviews", "allow_same_reviewer", "require_reason"]),
  command("/config branding", "Configuration", "Updates bot branding.", ["name", "logo", "primary_colour", "footer", "thumbnail"]),
  command("/config cases", "Configuration", "Configures case settings.", ["case_prefix", "starting_number", option("default_priority", "Default case priority.", priorities), "automatic_threads", "archive_duration"]),
  command("/config privacy", "Configuration", "Configures privacy and data visibility.", ["record_visibility", "confidential_role", "data_retention", "export_permissions"]),
  command("/config reset", "Configuration", "Resets part or all of the configuration after confirmation.", ["confirmation"], { role: "Bot Owner / System Administrator" }),

  command("/admin sync", "Administration", "Synchronises commands, roles, or configuration.", ["target"]),
  command("/admin health", "Administration", "Displays bot and database status."),
  command("/admin diagnostics", "Administration", "Runs complete configuration and service checks.", [], { response: "Reports missing permissions or channels, deleted roles, invalid channel access, database and command-registration status, webhooks, and review-workflow readiness." }),
  command("/admin permissions", "Administration", "Displays the bot's required Discord permissions."),
  command("/admin archive", "Administration", "Archives old cases or requests.", ["type", "before", "status"]),
  command("/admin restore", "Administration", "Restores an archived record.", ["record_id"]),
  command("/admin purge", "Administration", "Permanently removes selected data after confirmation.", ["record_id", "confirmation"], { permission: "Permanently purge retained data", role: "Bot Owner", notes: "Restricted, logged, protected by confirmation, and subject to applicable legal or contractual retention requirements." }),
  command("/admin maintenance", "Administration", "Enables or disables maintenance mode.", ["status", "reason"]),

  command("/help", "Information", "Displays the command help centre."),
  command("/help command", "Information", "Displays help for one command.", ["command"]),
  command("/about", "Information", "Displays product and Kruiger Labs LLC information."),
  command("/status", "Information", "Displays bot, database, and service status."),
  command("/privacy", "Information", "Displays the product privacy notice."),
  command("/terms", "Information", "Displays the product terms of use."),
  command("/support", "Information", "Provides customer support options and links."),
  command("/invite", "Information", "Displays the authorised bot-invite link when enabled."),
];

export const commandCategories = Object.keys(permissions);

export const products = [
  { name: "Scarlett", slug: "scarlett", category: "Discord Bots / FiveM", facets: ["Discord", "FiveM", "Automation"], status: "Available", version: "Buyer release", description: "Advanced Discord and FiveM community management with moderation, server status monitoring, verification, role management, global administration tools, protection systems, and configurable integrations.", featured: true, customerOnly: false },
  { name: "Manager", slug: "manager", category: "Discord Bots / FiveM", facets: ["Discord", "FiveM", "Automation"], status: "Available", version: "Buyer release", description: "Multi purpose Discord and FiveM management with role administration, giveaways, vehicle systems, Tebex integration, FiveGuard utilities, tags, statistics, and database backed configuration.", featured: true, customerOnly: false },
  { name: "DM RELAY", slug: "dm-relay", category: "Discord Bots / Automation", facets: ["Discord", "Automation"], status: "Available", version: "Buyer release", description: "Private Discord communication relay that lets community members contact an owner or staff representative without directly messaging their personal Discord account.", featured: true, customerOnly: false },
  { name: "LEO TOOLKIT", slug: "leo-toolkit", category: "Discord Bots / Automation", facets: ["Discord", "Automation", "Other"], status: "Available", version: "Buyer release", description: "Google Sheets powered law enforcement roster and personnel management for departments that need structured ranks, callsigns, promotions, transfers, employee records, and Discord synchronization.", featured: true, customerOnly: false },
  { name: "IAA BOT", slug: "iaa-bot", category: "Discord Bots / Automation / Web", facets: ["Discord", "Automation", "Web"], status: "Available", version: "Buyer release", description: "Internal Affairs and intelligence management system with Discord OAuth authorization, server intelligence, blacklists, investigations, cases, staff permissions, approvals, and secured website integration.", featured: true, customerOnly: false, logo: "/assets/internal-affairs/logo.png" },
  { name: "Discord Bot Development", slug: "discord-bot-development", category: "Custom Development", status: "Available", version: "Custom", description: "Purpose-built Discord applications, workflows, moderation systems, and integrations.", customerOnly: false },
  { name: "Custom Websites", slug: "custom-websites", category: "Websites", status: "Available", version: "Custom", description: "Responsive websites and customer portals designed around your organisation.", customerOnly: false },
  { name: "Netlify Applications", slug: "netlify-applications", category: "Websites", status: "Available", version: "Custom", description: "Modern Netlify applications with serverless functions, databases, forms, and identity.", customerOnly: false },
  { name: "Discord Integrations", slug: "discord-integrations", category: "Integrations", status: "Available", version: "Custom", description: "Secure Discord integrations connecting community tools, dashboards, and workflows.", customerOnly: false },
  { name: "Automation Systems", slug: "automation-systems", category: "Automation", status: "Available", version: "Custom", description: "Reliable automation for notifications, approvals, operations, and repetitive administration.", customerOnly: false },
  { name: "Game Community Tools", slug: "game-community-tools", category: "Roleplay Systems", status: "Available", version: "Custom", description: "Community management tools for roleplay, gaming, staff, and multi-server organisations.", customerOnly: false },
  { name: "Hosting Solutions", slug: "hosting-solutions", category: "Hosting", status: "Available", version: "Managed", description: "Managed hosting and deployment support for Kruiger Labs LLC projects.", customerOnly: true },
  { name: "Custom Development", slug: "custom-development", category: "Custom Development", status: "Available", version: "Custom", description: "Consultation, implementation, and long-term technical support for specialised systems.", customerOnly: false },
];

export const features = ["User investigations", "Discord server investigations", "Staff investigations", "Case creation", "Unique case numbers", "Case status tracking", "Case notes", "Evidence attachments and links", "Witness statements", "Investigator assignments", "Private investigation threads", "User and server blacklist requests", "Punishment requests", "Multi-stage approval workflows", "High Command final review", "Double-review support", "Reviewer names on completed requests", "Investigation, punishment, and blacklist logs", "Case, user, and server history", "Searchable records", "Role and department-based access", "Configurable review and log channels", "Automatic Discord threads", "Embed submissions", "Buttons and modal forms", "Command autocomplete", "Confirmation prompts", "Audit trails", "Exportable case summaries", "Privacy controls", "Staff accountability records", "Multi-server support", "Customer support tools"];

export const roles = [
  ["Bot Owner", "Full access to commands, configuration, data, retention actions, and authorised overrides."],
  ["System Administrator", "Configures the bot, runs diagnostics, manages records, and oversees workflows."],
  ["High Command", "Conducts final reviews, views restricted records, and performs permitted overrides."],
  ["Internal Affairs Command", "Manages investigations, case assignments, reviews, and confidential records."],
  ["Senior Investigator", "Creates and manages cases, submits and reviews permitted requests, and accesses investigation records."],
  ["Investigator", "Creates cases, gathers evidence, adds notes, and submits requests."],
  ["Reviewer", "Reviews assigned first-stage requests."],
  ["Department Command", "Views and submits department records when permitted."],
  ["Staff", "Submits requests and views their own submissions."],
  ["Read Only", "Views authorised documentation and selected records without making changes."],
];

export const troubleshooting = [
  ["Commands are not appearing", ["Discord command registration may still be propagating.", "The bot was invited without application commands.", "Server integration permissions are disabled.", "The command is restricted by a configured role."], "Confirm the invite includes application commands, review Server Settings → Integrations, check role mappings, then run /admin sync and /admin diagnostics."],
  ["Approve and Deny buttons are missing", ["The review message is old or invalid.", "The workflow or review channel is not configured.", "The viewer lacks reviewer permission.", "The request is already complete."], "Check the configured review channel and reviewer role, confirm the bot can send messages and components, then inspect the request status."],
  ["High Command cannot complete final review", ["The High Command role is not configured.", "Final-review channel access is missing.", "Stage one is incomplete.", "Same-reviewer restrictions or an existing claim blocks the action."], "Verify High Command role mapping and final channel permissions, then confirm a different authorised reviewer is completing stage two."],
  ["A request did not move to final review", ["The required first-stage reviews were not reached.", "The final channel was deleted or is inaccessible.", "The database update failed.", "More information is required."], "Run /admin diagnostics and inspect the request thread for the outstanding review count or information request."],
  ["Mutual servers are not showing", ["The bot only sees mutual servers where it is installed.", "Required access is missing.", "No visible mutual server exists.", "Privacy settings restrict results."], "This is expected when no authorised mutual-server data is available. The bot never has access to a user's complete Discord server list."],
  ["Threads are not being created", ["The bot cannot create threads.", "The parent channel does not support the selected thread type.", "The active-thread limit was reached.", "The configured channel was deleted."], "Grant the appropriate thread permissions, verify the parent channel, archive stale threads, and rerun diagnostics."],
  ["Case records are missing", ["The case number is incorrect.", "The case was archived.", "The viewer lacks permission.", "The case is confidential.", "The database is unavailable."], "Search by subject or investigator, include archived records when authorised, and ask an administrator to check service health."],
  ["Configuration is incomplete", ["A required role, channel, review stage, or privacy setting is missing."], "Run /admin diagnostics. Confirm administrative, investigator, reviewer and High Command roles; case and investigation channels; both review channels; blacklist, appeal and audit channels; case numbering; thread settings; privacy; and retention."],
];

export const faqs = [
  ["What is IAA BOT?", "A Discord Internal Affairs and intelligence system that operates with a compatible secured website/backend."],
  ["Who is the bot intended for?", "Roleplay and gaming communities, staff teams, departments, law-enforcement groups, and multi-server organisations."],
  ["Can it be used across multiple Discord servers?", "Yes. Each server keeps its own configuration and access rules while authorised multi-server records can be supported."],
  ["Can it see every server a user is in?", "No. It can only identify mutual servers where the bot is installed and has the necessary access."],
  ["How do case numbers work?", "Administrators configure a prefix and starting number; the bot then issues unique sequential references."],
  ["Can case records be deleted?", "Authorised owners can archive or remove data subject to confirmation, audit logging, and retention policy."],
  ["How are confidential cases protected?", "Confidential roles, restricted channels and threads, server-side permissions, and filtered exports limit access."],
  ["Can reviewers approve their own requests?", "Not by default. An explicit authorised configuration or override is required."],
  ["Can High Command perform the second review?", "Yes. High Command and authorised higher roles are intended to complete final review."],
  ["Can two High Command members review the same request?", "Yes, provided review-count and distinct-reviewer rules permit it."],
  ["How do I change review channels?", "Use /config channel and select the first-stage or final-review channel type."],
  ["How do I change reviewer roles?", "Use /config role for Reviewer or High Command, then run /admin diagnostics."],
  ["Can the bot automatically ban users?", "Only when that optional feature is enabled and the bot receives Ban Members permission."],
  ["Can punishments require manual execution?", "Yes. Review and record workflows can remain separate from Discord moderation actions."],
  ["How are appeals handled?", "Appeals have dedicated create, view, approve, deny, and history commands with audit records."],
  ["Can I export case records?", "Yes, where authorised, in text, Markdown, JSON, or PDF-ready report data."],
  ["Are actions logged?", "Yes. Case, review, configuration, data-management, and override actions create audit trails."],
  ["How long is data stored?", "Retention is configurable and should match your organisation's policy and applicable requirements."],
  ["Can Kruiger Labs customise the bot?", "Yes. Custom configuration and development enquiries are supported."],
  ["How do I report a bug?", "Open the Support Centre, choose Bug Report, and include steps, commands, screenshots, and the error message."],
  ["How do I request a feature?", "Choose Feature Request in the Support Centre and describe the problem, desired workflow, and expected outcome."],
  ["Where can I get customer support?", "Use the Kruiger Labs LLC Docs Support Centre or sign in to view and reply to your tickets."],
];

export const services = ["Kruiger Labs Website", "Documentation Portal", "Authentication", "Customer Dashboard", "Support System", "IAA BOT", "IAA Backend", "Discord API Connection", "Case System", "Review System", "Notification System"];

export const docNav = [
  ["Home", "/docs"], ["Product Catalogue", "/docs/catalogue"], ["Scarlett", "/docs/scarlett"], ["Manager", "/docs/manager"], ["DM RELAY", "/docs/dm-relay"], ["LEO TOOLKIT", "/docs/leo-toolkit"], ["IAA BOT", "/docs/iaa-bot"],
  ["Setup Guides", "/docs/setup"], ["Command Reference", "/docs/commands"], ["Permissions", "/docs/permissions"],
  ["Workflows", "/docs/workflows"], ["Integrations", "/docs/integrations"], ["Troubleshooting", "/docs/troubleshooting"],
  ["Frequently Asked Questions", "/docs/faq"], ["Changelog", "/docs/changelog"], ["Service Status", "/docs/status"],
  ["Support", "/docs/support"], ["Contact Kruiger Labs", "/docs/contact"],
];

export const searchEntries = [
  ...products.map((product) => ({ title: product.name, excerpt: product.description, category: "Product", href: ["scarlett", "manager", "dm-relay", "leo-toolkit", "iaa-bot"].includes(product.slug) ? `/docs/${product.slug}` : "/docs/catalogue", version: product.version })),
  ...commands.map((item) => ({ title: item.name, excerpt: `${item.description} ${item.response}`, category: item.category, href: `/docs/commands#${item.name.replace(/[ /]/g, "-").replace(/^-+/, "")}`, version: "1.0" })),
  ...troubleshooting.map(([title, causes, resolution]) => ({ title: String(title), excerpt: `${(causes as string[]).join(" ")} ${resolution}`, category: "Troubleshooting", href: `/docs/troubleshooting#${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, version: "1.0" })),
  ...faqs.map(([title, answer]) => ({ title, excerpt: answer, category: "FAQ", href: "/docs/faq", version: "1.0" })),
];
