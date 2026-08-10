/**
 * Shared, non-database site content for the public Kruiger Labs experience.
 *
 * Product data continues to come from `src/data/portal.ts`, which is the
 * existing catalogue the documentation and portal pages already read from.
 * This file only holds navigation, service categories and other structural
 * copy that has no backing table.
 */

export const SITE = {
    name: 'Kruiger Labs LLC',
    shortName: 'Kruiger Labs',
    url: 'https://kruigerlabs.xyz',
    title: 'Kruiger Labs | Software, Infrastructure & Digital Solutions',
    description:
        'Kruiger Labs builds professional Discord systems, FiveM infrastructure, web applications, cloud solutions, automation tools, and custom software.',
    discord: 'http://kruigerlabs.discord.kruigerlabs.xyz/',
    ogImage: '/assets/brand/kruiger-labs-banner.png'
} as const;

export type NavItem = { label: string; href: string; external?: boolean };

/** Primary navigation. Every destination is an existing or newly added route. */
export const NAV: NavItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Services', href: '/services' },
    { label: 'CloudNord', href: '/cloudnord' },
    { label: 'Documentation', href: '/docs' },
    { label: 'Support', href: '/support' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
];

/** Right-hand navigation actions. */
export const NAV_ACTIONS = {
    portal: { label: 'Client Portal', href: '/customer' },
    discord: { label: 'Discord', href: SITE.discord, external: true },
    start: { label: 'Get Started', href: '/contact' }
} as const;

export type ServiceCategory = {
    slug: string;
    title: string;
    description: string;
    icon: string;
};

/** "What we build" — the seven capability areas. */
export const SERVICES: ServiceCategory[] = [
    {
        slug: 'software-development',
        title: 'Software Development',
        description: 'Custom applications, automation platforms, dashboards, APIs, and backend systems.',
        icon: 'code'
    },
    {
        slug: 'discord-systems',
        title: 'Discord Systems',
        description: 'Professional Discord bots, moderation, community automation, management tools, and custom integrations.',
        icon: 'discord'
    },
    {
        slug: 'fivem-development',
        title: 'FiveM Development',
        description: 'Server infrastructure, logging, administration systems, Discord integrations, APIs, and custom resources.',
        icon: 'gamepad'
    },
    {
        slug: 'cloud-hosting',
        title: 'Cloud & Hosting',
        description: 'Reliable infrastructure for websites, bots, gaming communities, databases, and application workloads.',
        icon: 'cloud'
    },
    {
        slug: 'web-development',
        title: 'Web Development',
        description: 'Modern responsive websites, customer portals, dashboards, internal systems, and full-stack applications.',
        icon: 'globe'
    },
    {
        slug: 'automation-ai',
        title: 'Automation & AI',
        description: 'Automation workflows, AI-assisted moderation, intelligent tooling, and custom business systems.',
        icon: 'cpu'
    },
    {
        slug: 'security',
        title: 'Security',
        description: 'Infrastructure security, authentication, logging, anti-abuse systems, permissions, and monitoring.',
        icon: 'shield'
    }
];

/** CloudNord — the hosting and infrastructure side of the ecosystem. */
export const CLOUDNORD = {
    headline: 'Powered for Performance',
    subheadline:
        'Cloud infrastructure and hosting solutions designed for modern communities, applications, bots, and game servers.',
    categories: [
        {
            title: 'Game Hosting',
            description: 'Managed game server infrastructure for FiveM and community servers, deployed and maintained by Kruiger Labs.',
            icon: 'gamepad'
        },
        {
            title: 'Discord Bot Hosting',
            description: 'Always-on hosting for Discord applications, with process supervision, logging, and update deployment.',
            icon: 'discord'
        },
        {
            title: 'VPS',
            description: 'Isolated virtual servers for teams that need root access, custom runtimes, and full environment control.',
            icon: 'server'
        },
        {
            title: 'Web Hosting',
            description: 'Hosting and deployment for websites, portals, and static or server-rendered front ends.',
            icon: 'globe'
        },
        {
            title: 'Application Hosting',
            description: 'Managed runtimes for APIs, workers, dashboards, and database-backed application workloads.',
            icon: 'cloud'
        }
    ]
} as const;

/** Why Kruiger Labs — capability statements, no invented metrics. */
export const WHY = [
    {
        title: 'Built for Real Communities',
        description: 'Systems are designed around how staff teams, departments, and community operators actually work day to day.',
        icon: 'users'
    },
    {
        title: 'Modern Infrastructure',
        description: 'Serverless functions, managed Postgres, object storage, and edge delivery instead of fragile single-box setups.',
        icon: 'server'
    },
    {
        title: 'Security Focused',
        description: 'Server-side session validation, CSRF protection, rate limiting, audit trails, and least-privilege role mapping.',
        icon: 'shield'
    },
    {
        title: 'Scalable Architecture',
        description: 'Multi-server and multi-tenant support, with configuration held per community rather than hard-coded.',
        icon: 'layers'
    },
    {
        title: 'Professional Support',
        description: 'A documented support centre with authenticated ticketing, plus direct contact through Discord.',
        icon: 'lifebuoy'
    },
    {
        title: 'Custom Development',
        description: 'Bespoke bots, integrations, portals, and internal tooling built to a specification, not a template.',
        icon: 'code'
    }
] as const;

/** Technologies genuinely used across Kruiger Labs projects. */
export const TECHNOLOGIES = [
    'Astro',
    'React',
    'Node.js',
    'TypeScript',
    'Python',
    'PostgreSQL',
    'Drizzle ORM',
    'Netlify',
    'Netlify Functions',
    'Edge Functions',
    'Discord API',
    'REST APIs',
    'OAuth 2.0',
    'Cloud Infrastructure'
] as const;

/** Enquiry categories used by the contact page. */
export const CONTACT_CATEGORIES = [
    'General',
    'Custom Development',
    'Discord Bots',
    'FiveM',
    'Web Development',
    'CloudNord',
    'Partnerships',
    'Support'
] as const;

/** Product filter facets shown on the products page. */
export const PRODUCT_FILTERS = ['All', 'Discord', 'FiveM', 'Web', 'Automation', 'Infrastructure', 'Other'] as const;

/** Product slugs that have a dedicated marketing page. */
const PRODUCT_PAGES = new Set(['scarlett', 'manager', 'dm-relay', 'leo-toolkit', 'iaa-bot']);

/** Product slugs that have a documentation article. */
const PRODUCT_DOCS = new Set(['scarlett', 'manager', 'dm-relay', 'leo-toolkit', 'iaa-bot']);

/**
 * Resolves the links shown on a product card. Only routes that actually exist
 * are returned, so no card can point at a 404.
 */
export function productLinks(slug: string) {
    return {
        href: PRODUCT_PAGES.has(slug) ? `/products/${slug}` : `/contact?product=${encodeURIComponent(slug)}`,
        docsHref: PRODUCT_DOCS.has(slug) ? `/docs/${slug}` : undefined,
        hasPage: PRODUCT_PAGES.has(slug)
    };
}

/**
 * Maps a catalogue category from `src/data/portal.ts` onto a public filter
 * facet, so the filter bar works against real product data.
 */
export function filterFacet(category: string): string {
    const value = category.toLowerCase();
    if (value.includes('discord')) return 'Discord';
    if (value.includes('roleplay') || value.includes('game') || value.includes('fivem')) return 'FiveM';
    if (value.includes('website') || value.includes('web')) return 'Web';
    if (value.includes('automation')) return 'Automation';
    if (value.includes('hosting') || value.includes('infrastructure') || value.includes('cloudnord')) return 'Infrastructure';
    if (value.includes('integration')) return 'Automation';
    return 'Other';
}
