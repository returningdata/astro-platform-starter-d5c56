export type ProductDetail = {
  slug: string;
  name: string;
  category: string;
  availability: string;
  description: string;
  overview: string;
  capabilities: string[];
  requirements: string[];
  useCases: string[];
  technical: string;
  hosting: string;
  integrations: string[];
  complexity: string;
  docsHref: string;
  logoUrl?: string;
};

export const productDetails: Record<string, ProductDetail> = {
  scarlett: {
    slug: 'scarlett', name: 'Scarlett', category: 'Discord Bots / FiveM', availability: 'Available',
    description: 'Advanced Discord and FiveM community management with moderation, status monitoring, verification, roles, protection systems, and configurable integrations.',
    overview: 'Scarlett combines day-to-day Discord administration with optional FiveM server monitoring. It is intended for communities that want moderation, verification, role workflows, server status, global administration tools, and MySQL-backed records in one deployable application.',
    capabilities: ['Moderation, verification, welcome, whitelist, and reaction-role workflows', 'FiveM status checks using standard server endpoints', 'Role assignment, stripping, permission, and protected-role controls', 'Global ban, kick, nickname, blacklist, and administration tools', 'Configurable branding, links, channels, guild allowlists, and logging'],
    requirements: ['Node.js 18 or newer; Node.js 20 LTS recommended', 'A Discord application and bot token', 'MySQL or MariaDB', 'A FiveM server only when FiveM features are used'],
    useCases: ['FiveM communities operating Discord and game services together', 'Staff teams that need consistent moderation and role controls', 'Communities that publish live FiveM status and connect links'],
    technical: 'Node.js application using Discord application commands, a JavaScript configuration file, MySQL or MariaDB storage, and optional HTTP access to FiveM status endpoints.',
    hosting: 'Requires an always-on Node.js host that can reach Discord, the configured database, and any FiveM server endpoints.',
    integrations: ['Discord', 'MySQL or MariaDB', 'FiveM / CFX', 'Optional Manager status service'], complexity: 'Intermediate', docsHref: '/docs/scarlett/'
  },
  manager: {
    slug: 'manager', name: 'Manager', category: 'Discord Bots / FiveM', availability: 'Available',
    description: 'Multi purpose Discord and FiveM management with role administration, giveaways, vehicles, Tebex, FiveGuard utilities, tags, statistics, and database-backed configuration.',
    overview: 'Manager is a configurable community operations bot for Discord and FiveM teams. It centralizes common staff tasks while allowing optional integrations to be enabled only when the corresponding service is available.',
    capabilities: ['Role requests, temporary roles, user access, and role administration', 'Giveaways, tags, server links, and configurable community utilities', 'Vehicle registration, ownership, garage, and approval workflows', 'Optional Tebex lookup and FiveGuard unban integrations', 'Telemetry-backed statistics through the manager_telemetry table'],
    requirements: ['Node.js 18 or newer; Node.js 20 LTS recommended', 'A Discord application', 'MySQL or MariaDB', 'Optional Tebex, FiveGuard, OpenAI, and FiveM services'],
    useCases: ['FiveM communities with structured staff and vehicle workflows', 'Discord teams consolidating several management utilities', 'Servers that need optional store, anticheat, or telemetry connections'],
    technical: 'Node.js Discord application configured through config.js and backed by MySQL or MariaDB. External integrations remain optional and require compatible credentials or endpoints.',
    hosting: 'Requires an always-on Node.js environment with outbound access to Discord, the database, and any enabled integrations.',
    integrations: ['Discord', 'MySQL or MariaDB', 'FiveM / CFX', 'Tebex', 'FiveGuard', 'Optional OpenAI API'], complexity: 'Intermediate', docsHref: '/docs/manager/'
  },
  'dm-relay': {
    slug: 'dm-relay', name: 'DM RELAY', category: 'Discord Bots / Automation', availability: 'Available',
    description: 'Private Discord communication relay that lets community members contact an owner without messaging the owner’s personal account.',
    overview: 'DM RELAY receives direct messages through a dedicated bot account and privately forwards them to the configured owner. Replies, conversation closure, blocking, attachments, and persistent controls remain inside Discord.',
    capabilities: ['Private user-to-owner relay with attachment forwarding', 'Owner Reply modal, Close Conversation, and Block User controls', 'Owner-only unblock and status commands', 'Optional server log channel', 'Automatic MySQL table creation and persistent controls across restarts'],
    requirements: ['Python 3.9 or newer', 'A Discord application with Message Content Intent', 'MySQL or MariaDB', 'An always-on Python host'],
    useCases: ['Community owners who want a separate contact identity', 'Private support or escalation channels handled by one owner', 'Communities that need auditable conversation state without exposing a personal account'],
    technical: 'Python Discord application configured with environment variables. It automatically creates users, conversations, and relay_messages tables in the configured database.',
    hosting: 'Requires an always-on Python environment capable of reaching Discord and MySQL or MariaDB.',
    integrations: ['Discord direct messages', 'MySQL or MariaDB'], complexity: 'Easy', docsHref: '/docs/dm-relay/'
  },
  'leo-toolkit': {
    slug: 'leo-toolkit', name: 'LEO TOOLKIT', category: 'Discord Bots / Automation', availability: 'Available',
    description: 'Google Sheets powered law enforcement roster and personnel management with ranks, callsigns, transfers, employee history, and Discord synchronization.',
    overview: 'LEO TOOLKIT is the Discord client for a roster-management system. A compatible backend performs Google authentication, spreadsheet operations, department configuration, callsign allocation, and API authorization.',
    capabilities: ['Department and spreadsheet configuration', 'Ranks, callsigns, promotions, demotions, transfers, and personnel history', 'Discord role and nickname synchronization', 'Roster auditing and member synchronization where supported', 'Multiple departments, guilds, and spreadsheets through the backend'],
    requirements: ['Python 3.8 or newer', 'A Discord application', 'A compatible LEO TOOLKIT backend API', 'Google Cloud project, Sheets API, and service account', 'Department spreadsheets shared with the service account'],
    useCases: ['Law-enforcement roleplay departments using Google Sheets rosters', 'Multi-department communities with controlled rank and callsign workflows', 'Teams that need Discord and spreadsheet records kept aligned'],
    technical: 'Python Discord client calling an authenticated companion API. Google service-account credentials belong on the backend, not in the bot or browser.',
    hosting: 'The bot requires Python hosting. The separate backend also needs secure, internet-reachable hosting and access to Google APIs.',
    integrations: ['Discord', 'LEO TOOLKIT backend API', 'Google Cloud', 'Google Sheets API'], complexity: 'Advanced', docsHref: '/docs/leo-toolkit/'
  },
  'iaa-bot': {
    slug: 'iaa-bot', name: 'IAA BOT', category: 'Discord Bots / Automation / Web', availability: 'Available',
    description: 'Internal Affairs and intelligence management with Discord OAuth authorization, server intelligence, blacklists, investigations, cases, staff permissions, approvals, and a secured website integration.',
    overview: 'IAA BOT is the Discord component of a wider Internal Affairs system. A compatible HTTPS website and backend provide Discord OAuth2, staff authorization, intelligence records, cases, audit logs, workflows, and the signed API used by the bot.',
    capabilities: ['Discord OAuth2 authorization and authorization-status workflows', 'Authorized user and server intelligence lookups', 'Blacklist, investigation, recruitment, merge, alternate-account, punishment, and poach workflows', 'Staff profiles, roles, permissions, cases, reviews, and audit records', 'Bearer authentication plus timestamped HMAC SHA256 request signing'],
    requirements: ['Python 3.11 or newer', 'Discord applications and the required guilds', 'An HTTPS website with server-side OAuth2 handling', 'A compatible secured IAA API and persistent backend database', 'Private API key and separate signing secret'],
    useCases: ['Internal Affairs teams operating across one or more Discord communities', 'Organizations requiring controlled authorization before intelligence lookup', 'Staff teams that need approval workflows and auditable decisions'],
    technical: 'Python Discord client connected to a separately deployed website and backend. Requests use a bearer API key and HMAC SHA256 signatures with timestamp and nonce replay protection.',
    hosting: 'The bot and website/backend may be hosted separately. Both must remain reachable, and the website must use HTTPS.',
    integrations: ['Discord', 'Discord OAuth2', 'Secured IAA backend API', 'Persistent website database'], complexity: 'Advanced', docsHref: '/docs/iaa-bot/'
  },
  'complete-bot-bundle': {
    slug: 'complete-bot-bundle', name: 'Complete Bot Bundle', category: 'Discord Bots / Bundle', availability: 'Available',
    description: 'All five Kruiger Labs buyer-ready bot products in one source-included, self-hosted software bundle.',
    overview: 'The Complete Bot Bundle includes DM RELAY, Manager, Scarlett, LEO TOOLKIT, and IAA BOT. The individual total is $164.95. The bundle price is $119.99, saving $44.96.',
    capabilities: ['Includes all five buyer-ready bot products', 'One customer account and entitlement view', 'Documentation for every included product', 'Optional full deployment service', 'Future current-version downloads while entitlement remains active'],
    requirements: ['Runtime, database, hosting, and external service requirements vary by included product', 'LEO TOOLKIT requires a compatible backend', 'IAA BOT requires a compatible HTTPS website/backend'],
    useCases: ['Communities operating multiple Discord and FiveM systems', 'Teams needing management, relay, roster, and Internal Affairs tools', 'Buyers who want the complete product catalogue at a lower combined price'],
    technical: 'The bundle grants separate entitlements to each included software product. Each product remains independently configured and hosted according to its documentation.',
    hosting: 'Hosting is not included. Products can use separate suitable hosting environments where their runtimes or companion backends differ.',
    integrations: ['Discord', 'FiveM optional', 'MySQL or MariaDB', 'Google Sheets and Google Cloud', 'Discord OAuth2 and secured APIs'], complexity: 'Varies by product', docsHref: '/docs/'
  }
};
