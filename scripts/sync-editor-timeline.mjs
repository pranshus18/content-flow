#!/usr/bin/env node
/**
 * Copy canonical timeline schema from shared/ into backend/src/lib/.
 * Run after editing shared/editor-timeline.ts: npm run sync:editor-timeline
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shared = path.join(root, 'shared/editor-timeline.ts');
const backend = path.join(root, 'backend/src/lib/editor-timeline.ts');

const header =
  '/** Keep in sync with ../../../shared/editor-timeline.ts (canonical for frontend). */\n\n';
const body = readFileSync(shared, 'utf8');
writeFileSync(backend, header + body, 'utf8');
console.log('Synced shared/editor-timeline.ts → backend/src/lib/editor-timeline.ts');
