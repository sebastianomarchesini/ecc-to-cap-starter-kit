#!/usr/bin/env node
// Removes the <atom:link .../> elements from a saved OData V2 $metadata (EDMX) file.
//
// SAP Gateway writes the system's own URL into these links (rel="self" and
// rel="latest-version"), so a $metadata document saved from your ECC carries
// your internal host name and port. Nothing in CAP needs them: cds import
// reads the entity types and sets, not the links.
//
//   node scripts/strip-metadata-links.mjs srv/external/SAMPLEFLIGHT.edmx
//   node scripts/strip-metadata-links.mjs --check srv/external/*.edmx
//
// --check changes nothing and exits with code 1 if any file still has a link,
// so it can run in CI before anything is pushed.

import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const files = args.filter((a) => a !== '--check');

if (files.length === 0) {
  console.error('usage: strip-metadata-links.mjs [--check] <file.edmx> [...]');
  process.exit(2);
}

const ATOM_LINK = /<atom:link\b[^>]*\/>/g;
let dirty = 0;

for (const file of files) {
  const xml = readFileSync(file, 'utf8');
  const links = xml.match(ATOM_LINK) ?? [];
  if (links.length === 0) {
    console.log(`ok     ${file}`);
    continue;
  }
  if (check) {
    dirty++;
    console.error(`LINKS  ${file}: ${links.length} <atom:link> element(s) still present`);
    continue;
  }
  writeFileSync(file, xml.replace(ATOM_LINK, ''));
  console.log(`fixed  ${file}: removed ${links.length} <atom:link> element(s)`);
}

if (dirty > 0) {
  console.error('\nRun: node scripts/strip-metadata-links.mjs <file.edmx>');
  process.exit(1);
}
