# NearByBazar — Release Registry

This directory is the **single source of truth for every NearByBazar deployment**.

Each release is one JSON file: `releases/<version>-<slug>.json`. The files are
git-tracked, so the release history *is* the commit history. Nothing here touches
the production database — the Release Management system is intentionally file-based
so cutting a release never requires a schema migration.

## What consumes these files

- **Public "What's New"** (`/whats-new`) — reads only the customer-facing fields
  (`summary`, `public.*`) from releases whose `status` is `released`.
- **Internal release tooling** (`GET /api/v1/releases/internal`, superadmin-only) —
  reads every field, including approvals, technical changelog, git refs, migration
  and rollback notes.

## Cutting a new release

```bash
npm run release:new -- --version 1.1.0 --name "Customer Discovery" --sprint "Sprint 2" --batch "Batch 1"
```

That scaffolds a new `draft` file from `template.json`. You then fill it in and walk
it through the workflow by editing `status` and `approvals`:

```
draft  →  ready  →  released
```

See `docs/RELEASE_MANAGEMENT.md` for the full workflow and field reference.

## Status lifecycle

| status     | meaning                                              | shown on /whats-new |
| ---------- | ---------------------------------------------------- | ------------------- |
| `draft`    | being written; not yet reviewed                      | no                  |
| `ready`    | approved internally, awaiting deployment             | no                  |
| `released` | shipped to production and tagged                      | **yes**             |
