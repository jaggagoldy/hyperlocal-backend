#!/usr/bin/env node
/*
 * NearByBazar — release scaffolder.
 *
 * Creates a new draft release file in releases/ from template.json, pre-filled
 * with the identity fields you pass. This is step "Prepare Release Notes" of the
 * deployment workflow — you then fill in the change lists and walk `status`
 * from draft -> ready -> released.
 *
 *   npm run release:new -- --version 1.1.0 --name "Customer Discovery" \
 *       --title "Find local businesses faster" --sprint "Sprint 2" --batch "Batch 1"
 *
 * Flags:
 *   --version   (required) semver, e.g. 1.1.0
 *   --name      (required) internal codename
 *   --title     customer-facing headline (defaults to name)
 *   --slug      url-safe id (defaults to slugified name)
 *   --sprint    e.g. "Sprint 2"
 *   --batch     e.g. "Batch 1"
 *   --date      ISO date (defaults to today)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELEASES_DIR = path.resolve(__dirname, '../releases');
const TEMPLATE = path.join(RELEASES_DIR, 'template.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
      else out[key] = true;
    }
  }
  return out;
}

function slugify(str) {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (!args.version || args.version === true) fail('Missing --version (e.g. --version 1.1.0)');
if (!/^\d+\.\d+\.\d+/.test(args.version)) fail(`--version "${args.version}" is not semver (expected x.y.z)`);
if (!args.name || args.name === true) fail('Missing --name (e.g. --name "Customer Discovery")');

const slug = args.slug && args.slug !== true ? slugify(args.slug) : slugify(args.name);
const fileName = `${args.version}-${slug}.json`;
const filePath = path.join(RELEASES_DIR, fileName);

if (fs.existsSync(filePath)) fail(`Release file already exists: releases/${fileName}`);

// Guard against duplicate versions under a different slug.
for (const f of fs.readdirSync(RELEASES_DIR)) {
  if (f === 'template.json' || !f.endsWith('.json')) continue;
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(RELEASES_DIR, f), 'utf8'));
    if (existing.version === args.version) fail(`Version ${args.version} already exists in releases/${f}`);
  } catch { /* ignore unparseable files here; the service logs them */ }
}

const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const release = {
  ...template,
  version: args.version,
  slug,
  name: args.name,
  title: (args.title && args.title !== true) ? args.title : args.name,
  date: (args.date && args.date !== true) ? args.date : today,
  sprint: (args.sprint && args.sprint !== true) ? args.sprint : template.sprint,
  batch: (args.batch && args.batch !== true) ? args.batch : template.batch,
  status: 'draft',
};
release.internal = { ...template.internal, git: { ...template.internal.git, tag: `v${args.version}` } };

fs.writeFileSync(filePath, JSON.stringify(release, null, 2) + '\n');

console.log(`\n✓ Created releases/${fileName}  (status: draft)\n`);
console.log('  Next steps:');
console.log('   1. Fill in summary + public/internal change lists.');
console.log('   2. Set approvals.product / .qa / .deployment as they are granted.');
console.log('   3. Move status: draft -> ready -> released.');
console.log('   4. Tag the deploy:  git tag ' + `v${args.version}` + '\n');
