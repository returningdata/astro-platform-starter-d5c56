# Kruiger Labs Store Production Setup

This guide covers the values and operator steps required before production sales can be enabled. It never contains live credentials. Keep every secret in Netlify environment variables, never in source files, browser code, screenshots, support tickets, or Discord messages.

## Architecture

The store uses Discord OAuth2 for customer and staff identity, secure database-backed sessions, Netlify Database for commerce records, Netlify Blobs for private ZIP artifacts, Stripe Checkout for payment entry, verified Stripe webhooks for fulfillment, and Discord webhooks for operational notices. Stripe handles card data; Kruiger Labs does not store full card numbers or CVC values.

The production Discord callback is:

```text
https://kruigerlabs.xyz/api/auth/discord/callback
```

The production Stripe webhook is:

```text
https://kruigerlabs.xyz/.netlify/functions/stripe-webhook
```

## 1. Netlify Database

Netlify Database is the Postgres system used by the implementation. The application connects through the Netlify Database integration and Drizzle ORM.

1. Open the Kruiger Labs site in Netlify.
2. Open the database section and confirm the production database is provisioned for the site.
3. Confirm the production environment contains the platform-provided database connection value. The health page accepts `NETLIFY_DATABASE_URL` or `DATABASE_URL` as its configuration indicator.
4. Deploy the site. Netlify applies migration files from `netlify/database/migrations/` to the matching database branch.
5. Open `/staff/store/system-health/` and confirm **Database configured** and **Database reachable** are healthy.

Back up the production database before significant migrations or bulk administrative changes. Use the backup/export controls provided for the Netlify Database project. If a migration fails, do not edit or delete a migration that has already been applied. Correct the schema with a new forward-only migration, test it on a Deploy Preview database branch, and then deploy it to production.

For local development, use the Netlify CLI so functions and the database integration are emulated together:

```bash
/opt/buildhome/node-deps/node_modules/.bin/netlify dev --port 8889
```

## 2. Discord Customer Login

Use a dedicated Discord application for Kruiger Labs website accounts. Do not use a purchased bot's Discord application or token.

1. Open the Discord Developer Portal and create an application named for Kruiger Labs account access.
2. Copy the **Application ID** from General Information. Store it as `DISCORD_OAUTH_CLIENT_ID`.
3. Open OAuth2, reset or create the **Client Secret**, and copy it once. Store it as `DISCORD_OAUTH_CLIENT_SECRET`.
4. Add this exact OAuth2 redirect URI:

```text
https://kruigerlabs.xyz/api/auth/discord/callback
```

5. Store the same URI as `DISCORD_OAUTH_REDIRECT_URI`.
6. The implementation requests `identify` and `guilds.members.read`. It does not request Discord email by default.
7. Add the Kruiger Labs Discord server ID as `KRUIGER_DISCORD_GUILD_ID` so the callback can validate staff role membership.
8. Add the Discord role ID used for the owner as `KRUIGER_OWNER_ROLE_ID`.
9. Generate a long random `SESSION_SECRET`. Use a password manager or cryptographic secret generator; do not reuse a Discord token, OAuth secret, or Stripe key.
10. Redeploy and test **Sign In With Discord** in a private browser window.

The OAuth client secret remains server-side. The browser receives a secure HttpOnly session cookie, not Discord access tokens.

## 3. Staff Access and Recovery

Staff authorization is resolved server-side from Discord guild roles. The owner may map Discord role IDs to permissions in the existing Admin role manager. Newly issued sessions receive the role permissions, so staff should sign out and sign in again after mappings change.

Recommended role mappings:

| Role | Permissions |
| --- | --- |
| Owner | `all` |
| Administrator | `store.analytics.view`, `store.products.view`, `store.products.manage`, `store.orders.view`, `store.orders.manage`, `store.customers.view`, `store.setup.manage`, `store.sales.view`, `store.sales.manage`, `store.entitlements.manage`, `store.logs.view` |
| Store Manager | `store.analytics.view`, `store.products.view`, `store.products.manage`, `store.orders.view`, `store.orders.manage`, `store.sales.view`, `store.sales.manage`, `store.entitlements.manage` |
| Support Staff | `store.orders.view`, `store.orders.manage`, `store.customers.view`, `store.setup.manage` |
| Viewer | `store.analytics.view`, `store.products.view`, `store.orders.view`, `store.sales.view` |

To add a role, enable Discord Developer Mode, copy the numeric role ID, open `/admin`, open the role manager, enter the role ID and name, select only the needed permissions, and save.

For recovery, set `ADMIN_USER_IDS` to a comma-separated allowlist containing the Discord user ID of a trusted owner. `AUTHORIZED_STAFF_IDS` is also accepted as a compatibility alias. A listed user receives owner-level bootstrap access after a new login. Remove temporary recovery IDs after role mappings are repaired.

## 4. Stripe Products and Prices

Use Stripe test mode first. Create one Stripe Product and one-time Price for every item below. Currency is USD.

| Internal item | Amount | Environment variable |
| --- | ---: | --- |
| DM RELAY | $14.99 | `STRIPE_PRICE_DM_RELAY` |
| Manager | $24.99 | `STRIPE_PRICE_MANAGER` |
| Scarlett | $34.99 | `STRIPE_PRICE_SCARLETT` |
| LEO TOOLKIT | $39.99 | `STRIPE_PRICE_LEO_TOOLKIT` |
| IAA BOT | $49.99 | `STRIPE_PRICE_IAA_BOT` |
| Complete Bot Bundle | $119.99 | `STRIPE_PRICE_COMPLETE_BUNDLE` |
| Basic Bot Installation | $14.99 | `STRIPE_PRICE_BASIC_INSTALL` |
| Discord Configuration | $9.99 | `STRIPE_PRICE_DISCORD_CONFIG` |
| MySQL Setup | $9.99 | `STRIPE_PRICE_MYSQL_SETUP` |
| FiveM Integration Setup | $19.99 | `STRIPE_PRICE_FIVEM_SETUP` |
| LEO TOOLKIT Sheets / Backend Setup | $29.99 | `STRIPE_PRICE_LEO_SETUP` |
| IAA BOT Website / OAuth / Backend Setup | $49.99 | `STRIPE_PRICE_IAA_SETUP` |
| DM RELAY Full Setup | $74.99 | `STRIPE_PRICE_FULL_DM_RELAY` |
| Manager Full Setup | $99.99 | `STRIPE_PRICE_FULL_MANAGER` |
| Scarlett Full Setup | $119.99 | `STRIPE_PRICE_FULL_SCARLETT` |
| LEO TOOLKIT Full Setup | $149.99 starting price | `STRIPE_PRICE_FULL_LEO` |
| IAA BOT Full Setup | $199.99 starting price | `STRIPE_PRICE_FULL_IAA` |
| Complete Bundle Full Deployment | $349.99 starting price | `STRIPE_PRICE_FULL_BUNDLE` |

For each item:

1. In Stripe, select the correct test or live mode.
2. Open Product catalog and create or select the Product.
3. Add a one-time USD Price with the exact amount.
4. Copy the Price ID beginning with `price_`.
5. Add the ID to the matching Netlify environment variable.

Obtain `STRIPE_SECRET_KEY` from Stripe Developers > API keys. Use the test secret key during testing and the live secret key only when production sales are ready. Never place the key in the admin UI.

Stripe Price amounts are immutable. A staff price change creates or selects a new Price and retires the old internal active price. Historical order items retain their original Price ID and amounts.

## 5. Stripe Webhook

1. In Stripe Developers, open Webhooks or Event destinations.
2. Add an HTTPS destination using:

```text
https://kruigerlabs.xyz/.netlify/functions/stripe-webhook
```

3. Select only these events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
payment_intent.succeeded
payment_intent.payment_failed
refund.created
refund.updated
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
```

4. Reveal and copy the signing secret beginning with `whsec_`.
5. Store it as `STRIPE_WEBHOOK_SECRET` in Netlify production environment variables.
6. Redeploy.
7. Use Stripe's webhook test action or a test Checkout purchase. Confirm a processed event appears on `/staff/store/system-health/`.

Fulfillment is idempotent and runs from verified webhook events. Visiting `/checkout/success/` does not grant access.

To test refunds, complete a test-mode purchase, open the test payment in Stripe, issue a test refund, and confirm the order and entitlement state updates. For disputes, use Stripe-supported test cards or test-mode dispute simulation. Do not create a real chargeback for testing.

When a dispute opens, the order becomes disputed and affected entitlements are suspended pending review. Updates are logged. A won dispute can restore access; a lost dispute revokes access. Staff can review and override entitlements from the order dashboard.

## 6. Discord Commerce Webhooks

Create separate Discord text channels with limited staff access, then create one webhook in each channel.

1. **Payment Logs** receives verified successful order and ordinary payment records. Store its URL as `DISCORD_PAYMENT_LOG_WEBHOOK_URL`.
2. **Stripe Security Logs** receives disputes, refunds, payment failures, webhook processing failures, and entitlement security actions. Store its URL as `DISCORD_STRIPE_SECURITY_WEBHOOK_URL`.
3. **Store Audit Logs** receives selected product, price, sale, setup, and entitlement administration events. Store its URL as `DISCORD_STORE_AUDIT_WEBHOOK_URL`.

Discord embeds never include Stripe secret keys, OAuth tokens, bot tokens, raw Stripe payloads, or full card data. Set `PAYMENT_LOG_INCLUDE_MASKED_IP=true` only if the privacy policy and operational need support masked network logging. Set it to `false` to disable IP-derived Discord fields.

## 7. Netlify Environment Variables

Open Netlify > Site configuration > Environment variables. Add values to the Production context. Add separate test values to Deploy Preview only when previews must exercise checkout. Do not place live Stripe keys in ordinary previews.

Required production values:

```text
SITE_URL=https://kruigerlabs.xyz
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
DISCORD_OAUTH_CLIENT_ID=
DISCORD_OAUTH_CLIENT_SECRET=
DISCORD_OAUTH_REDIRECT_URI=https://kruigerlabs.xyz/api/auth/discord/callback
SESSION_SECRET=
KRUIGER_DISCORD_GUILD_ID=
KRUIGER_OWNER_ROLE_ID=
ADMIN_USER_IDS=
DATABASE_URL=
DISCORD_PAYMENT_LOG_WEBHOOK_URL=
DISCORD_STRIPE_SECURITY_WEBHOOK_URL=
DISCORD_STORE_AUDIT_WEBHOOK_URL=
PAYMENT_LOG_INCLUDE_MASKED_IP=true
STRIPE_PRICE_DM_RELAY=
STRIPE_PRICE_MANAGER=
STRIPE_PRICE_SCARLETT=
STRIPE_PRICE_LEO_TOOLKIT=
STRIPE_PRICE_IAA_BOT=
STRIPE_PRICE_COMPLETE_BUNDLE=
STRIPE_PRICE_BASIC_INSTALL=
STRIPE_PRICE_DISCORD_CONFIG=
STRIPE_PRICE_MYSQL_SETUP=
STRIPE_PRICE_FIVEM_SETUP=
STRIPE_PRICE_LEO_SETUP=
STRIPE_PRICE_IAA_SETUP=
STRIPE_PRICE_FULL_DM_RELAY=
STRIPE_PRICE_FULL_MANAGER=
STRIPE_PRICE_FULL_SCARLETT=
STRIPE_PRICE_FULL_LEO=
STRIPE_PRICE_FULL_IAA=
STRIPE_PRICE_FULL_BUNDLE=
```

Netlify Database may provide `NETLIFY_DATABASE_URL` automatically. If so, do not copy production database credentials into source code. After adding or changing environment variables, trigger a new production deploy so Functions receive the new values.

For local development, place test-only values in the Netlify local environment mechanism. Never commit a live `.env` file.

## 8. Function and Webhook Logs

In Netlify, open Logs > Functions and inspect these functions:

| Function | Purpose |
| --- | --- |
| `create-checkout-session` | Creates trusted server-side Stripe Checkout Sessions |
| `stripe-webhook` | Verifies Stripe signatures and fulfills orders |
| `auth-discord` | Starts OAuth state and PKCE transaction |
| `auth-discord-callback` | Exchanges the code and creates a secure session |
| `store-download` | Verifies entitlement and streams private files |
| `store-admin` | Handles authorized store administration |
| `store-artifacts` | Uploads and versions private ZIP artifacts |
| `store-health` | Reports configuration without revealing values |

A failed webhook should show both the Stripe delivery response and a Netlify Function log. The Stripe security Discord channel receives a concise failure notice when configured.

## 9. Private Product Files

Product ZIP files are stored in the private Netlify Blob store named `store-artifacts`. They are not public permanent URLs.

1. Open `/staff/store/products/` as an owner or product manager.
2. To load the five supplied buyer ZIPs, use **Bootstrap Supplied Buyer ZIPs** once.
3. For a new release, enter the product slug, version, select a ZIP no larger than the configured upload limit, and upload it.
4. The upload creates a version record, marks it current, and associates the private Blob key with the product.
5. Existing customers with active entitlements receive the current enabled version when they download.
6. To replace a file, upload the corrected ZIP with a new version. Preserve the prior artifact until staff confirms the replacement.
7. To respond to a compromised release, pause sales, suspend affected entitlements if necessary, upload a corrected version, and disable the compromised version through a controlled database/admin update.

Every download checks login, ownership, entitlement status, refund/dispute state, rate limits, and artifact availability. Downloads are logged server-side. Authenticated downloads remain the protection mechanism unless genuinely encrypted customer-specific archives are added later.

## 10. Adding a Product

1. Open `/staff/store/products/`.
2. Enter the product name and a lowercase hyphenated slug.
3. Enter short and full descriptions, category, image URL, requirements, external integration notices, documentation URL, and current version.
4. Select the product type and setup eligibility.
5. Enter the trusted amount in cents.
6. Save as **Draft** for review.
7. Create the Stripe Product and Price in Stripe, or use the controlled create-in-Stripe option if the production Stripe key is configured.
8. Upload the private ZIP and confirm it appears as configured.
9. Preview `/products/<slug>/`.
10. Change the status to **Active**.
11. Confirm the item appears in `/products/`, the Buy Now control is enabled, documentation opens, and a test purchase completes.

Staff-created products use the database-driven catalog and a generic database-backed product detail layout, so source-code changes are not required.

## 11. Sales and Coupons

Create Stripe Coupons or Promotion Codes first when the Checkout discount must be enforced by Stripe.

For a sale, open `/staff/store/sales/`, enter the name, description, start and end times, percent or fixed discount, minimum cart value, maximum uses when needed, product scope, public copy, and the Stripe Coupon ID. Start and end timestamps are enforced server-side. Use **Stop** to disable the sale immediately.

For a coupon, enter the customer-facing code, discount type and value, optional start and expiration, usage limits, product restrictions, and Stripe Promotion Code ID. Disable the coupon to stop it immediately.

Do not change historical order totals. Checkout records the amount Stripe confirms after the discount.

## 12. Product Availability

**Paused** keeps a product visible but disables new sales. Previous purchasers retain eligible downloads. **Hidden** removes the product from the public catalog. **Discontinued** and **Out of Sale** preserve orders and records while communicating a longer-term availability state. Reactivate a product by restoring an active Stripe Price if needed and changing the database status to **Active**.

Never delete a Stripe Product or internal product record merely to stop sales.

## 13. Setup Services

Purchased setup services appear under `/staff/store/setup-services/` and the customer's Client Portal. Staff moves work through:

1. Awaiting Customer Information
2. Ready for Setup
3. In Progress
4. Waiting on Customer
5. Testing
6. Completed
7. Cancelled

The intake form collects operational IDs and URLs but does not request Discord bot tokens in plaintext. Customers should enter secrets directly in their hosting panel or private configuration.

LEO TOOLKIT and IAA BOT full setup prices are starting prices. Custom backend work beyond a compatible existing backend requires a separate quote.

## 14. System Health Review

Open `/staff/store/system-health/` after every configuration change. Confirm:

1. Database is configured and reachable.
2. Stripe secret is configured and the API is reachable.
3. Stripe webhook secret is configured.
4. Payment, security, and audit Discord webhooks show configured.
5. Discord OAuth shows configured and the callback is exact.
6. Private Blob storage is healthy.
7. Every active Stripe Price variable is healthy.
8. Product count is nonzero.
9. The most recent test webhook processed successfully.

The page displays status only and never returns secret values.

## 15. Production Deployment Checklist

Supply and verify every item below before enabling live sales:

- [ ] Production Netlify Database is provisioned and migrations have applied.
- [ ] `SITE_URL` is `https://kruigerlabs.xyz`.
- [ ] A dedicated Discord OAuth application exists.
- [ ] `DISCORD_OAUTH_CLIENT_ID` is set.
- [ ] `DISCORD_OAUTH_CLIENT_SECRET` is set.
- [ ] `DISCORD_OAUTH_REDIRECT_URI` exactly matches `https://kruigerlabs.xyz/api/auth/discord/callback` in Netlify and Discord.
- [ ] `SESSION_SECRET` is a unique cryptographically random value.
- [ ] `KRUIGER_DISCORD_GUILD_ID` and `KRUIGER_OWNER_ROLE_ID` are set.
- [ ] Owner recovery access through `ADMIN_USER_IDS` has been tested and minimized.
- [ ] Staff Discord roles are mapped to the intended permissions.
- [ ] `STRIPE_SECRET_KEY` uses the intended test or live mode.
- [ ] All 18 `STRIPE_PRICE_*` variables contain matching one-time Stripe Price IDs.
- [ ] Stripe webhook destination uses the exact production URL.
- [ ] `STRIPE_WEBHOOK_SECRET` contains that destination's `whsec_` signing secret.
- [ ] Only the documented Stripe events are subscribed.
- [ ] Payment, security, and audit Discord webhooks are configured.
- [ ] `PAYMENT_LOG_INCLUDE_MASKED_IP` matches the privacy decision.
- [ ] Private ZIP artifacts and current versions are uploaded.
- [ ] Product documentation and support links have been checked.
- [ ] A test customer can sign in, buy, return to success, view the order, and download.
- [ ] A test refund updates the order and entitlement.
- [ ] A Stripe-supported test dispute suspends access and reaches the security channel.
- [ ] Product pause, hidden status, price replacement, sale expiration, and coupon disable controls have been tested.
- [ ] Privacy Policy and Terms of Service have been reviewed by the business owner or qualified legal counsel.
- [ ] `/staff/store/system-health/` shows no production-blocking missing or error states.
