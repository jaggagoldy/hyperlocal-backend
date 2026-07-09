# Demo & Test Accounts — convention (no live secrets)

> Sanitized reference (P0.1). This file replaces the former root-level
> `DEV_TEST_CREDENTIALS.md` and `PROD_DEMO_CREDENTIALS.md`, which listed working
> login passwords in the repository. **No passwords are documented here.**

The platform ships with seedable demo/test accounts so the app can be explored
without onboarding real merchants. They are created by the seed scripts, not by
hand, and the password is defined **only** in those scripts — read the script if
you need it locally.

## Local development

- Seeded into the **local** `hyperlocal_dev` database only — never production.
- Emails follow `vendorN@test.com` / `userN@test.com`.
- Created by: `scripts/seed-dev-testdata.cjs` (and the other `scripts/seed-*` files).
- The shared dev password is defined in that seed script.

## Production demo data (pre-launch only)

- Demo rows are tagged `metaData.isDemo = true` and use the `@nbb-demo.test` domain.
- Created / removed by the dedicated scripts (`scripts/seed-*`, `scripts/remove-prod-demo.cjs`).
- **Required before public launch:** remove all production demo accounts and
  rotate/retire the shared demo password. This is a production-data action and
  must be run deliberately with founder authorization:

  ```bash
  DATABASE_URL="<prod-neon-url>" node scripts/remove-prod-demo.cjs --yes
  ```

  Tracked as a launch task in `releases/P0/risks.md` (R8) — it is **not** a P0
  development blocker, but it **is** a pre-public-launch blocker.

## Rule going forward

Never commit working credentials (passwords, tokens, API keys, connection
strings) to the repository — not even for demo accounts. Document the
*convention* and point at the seed script; keep the actual secret in the script
or in environment configuration.
