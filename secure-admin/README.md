# AMARYT Admin — server-enforced email OTP gate

This folder contains a Cloudflare Worker that serves the existing AMARYT
dashboard ONLY after the administrator verifies a one-time email code.

**Current status:** this is source code in a feature branch, NOT deployed.
GitHub Pages remains public until explicitly unpublished.

## What it does

- The public login screen shows **إيميل الأدمن** only, not the real address.
- The email address, Resend API key, sender and OTP signing secret are stored
  in Cloudflare Worker secrets, never inside GitHub or JavaScript sent to visitors.
- Requesting a code sends a six-digit OTP to the configured administrator
  address; codes expire after 5 minutes and permit at most five attempts.
- Email request and verification endpoints have IP-based rate limits and an
  hourly global email-send ceiling. These are anti-abuse safeguards, not a
  substitute for Cloudflare WAF/Turnstile at scale.
- Code hashes, session IDs and throttling counters are stored in D1; raw OTP
  codes are NOT stored. Sessions expire after four hours.
- The Worker gates EVERY static asset with run_worker_first=true and exposes
  /catalog only after authentication; its session cookie is HttpOnly, Secure,
  SameSite=Strict. A logout button revokes the session.
- Existing catalog edits still go through GitHub Issues and verify ownership
  of the repository before writing, independently from email OTP.

## Prerequisites

- A Cloudflare account with Workers + D1 access.
- An email delivery account with Resend, a verified sender domain, and a
  sending-only API key. Resend and Cloudflare have free tiers subject to
  limits and changes. You can use your existing domain for the sender.
- Access to the administrator mailbox.

## Deployment (never put real values in this repository)

From the repository root:

1. Change to the secure-admin directory.
2. Install Wrangler and log into Cloudflare.
3. Create a D1 database named amaryt-auth.
4. Copy its real database ID into wrangler.jsonc instead of
   REPLACE_WITH_YOUR_D1_DATABASE_ID.
5. Apply schema.sql to the remote D1 database.
6. Store all four values as Worker secrets, NOT source code or GitHub files:
   ADMIN_EMAIL (the intended destination mailbox),
   RESEND_API_KEY (Resend sending-only key),
   RESEND_FROM (a sender address on the verified domain),
   OTP_SECRET (at least 32 bytes of cryptographically random text).
7. Deploy using Wrangler.

Example commands:

    cd secure-admin
    npm install
    npx wrangler login
    npx wrangler d1 create amaryt-auth
    # Copy the ID printed above into wrangler.jsonc, then:
    npx wrangler d1 execute amaryt-auth --remote --file=schema.sql
    npx wrangler secret put ADMIN_EMAIL
    npx wrangler secret put RESEND_API_KEY
    npx wrangler secret put RESEND_FROM
    npx wrangler secret put OTP_SECRET
    npx wrangler deploy

The secret commands will prompt for values without storing them in shell
history. Create OTP_SECRET with a password manager or a secure random generator,
e.g. openssl rand -hex 32.

Open the deployed workers.dev URL. The login screen requires a code sent to
the admin email before any HTML/CSS/JS dashboard assets or /catalog are served.

## Retire the original public site

**Mandatory before claiming private access:** the original GitHub Pages
dashboard at https://amaryt1.github.io/Mstoda/ is public and bypasses
the Worker. Once the Worker login is tested, open:

Mstoda > Settings > Pages > menu (...) > Unpublish site.

Do not republish the original admin-pages.yml workflow. Keep the secure
Cloudflare address as the only dashboard entry point.

## Critical limitation: raw IPA links remain public!

The upstream Mstoda repository is PUBLIC and apps.json still contains
downloadURL fields. Anybody who knows its raw GitHub URL can still read those
links even if the dashboard is hidden. Git history also retains old URLs.
**Do not claim that the IPA files are private.**

To actually restrict access to IPA links, a separate migration is required:

1. Put private download metadata in a private database or private repository;
   expose only non-sensitive public app metadata to regular clients.
2. Serve downloads through a backend that authenticates the requesting client
   and issues expiring, access-controlled HTTPS URLs.
3. Update the iOS app to use that backend instead of reading public raw IPA
   links from apps.json; confirm authorized Apple distribution rules.
4. Revoke or rotate old publicly exposed IPA download links where the hosting
   provider allows this.

Anyone legitimately allowed to download an IPA can still copy its bytes, so
download controls reduce casual leakage rather than guarantee non-extraction.

## Tests

    node --check src/worker.js
    node --test tests/*.test.mjs

This branch also runs automated CI, including checks for unauthorized asset
access, private email handling, OTP flows, session revocation and D1 schema.

## Account security

Only the mailbox holder receives the OTP, while catalog mutation still
requires repository owner authentication through GitHub. Turn on 2FA for
GitHub and Gmail. Do not share OTP codes, API keys or recovery codes.
