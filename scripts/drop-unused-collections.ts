#!/usr/bin/env ts-node
/**
 * Drop unused MongoDB collections (from db-report cleanup candidates).
 * Run with --dry-run to only list what would be dropped.
 *
 * Usage:
 *   npm run drop-unused-collections              # actually drop
 *   npm run drop-unused-collections -- --dry-run # preview only
 */

import { connectToDatabase } from '../lib/database';

const COLLECTIONS_TO_DROP = [
  'commentBank',
  'comment_bank',
  'examAnswers',
  'examGrades',
  'hw1_departments',
  'hw1_employees',
  'hw1_jobs',
  'hw1_locations',
  'question2',
  'summer',
  'winter',
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('🔍 DRY RUN – no collections will be dropped.\n');
  }

  console.log('Connecting to database...');
  const { db } = await connectToDatabase();
  const dbName = db.databaseName;
  console.log(`Database: ${dbName}\n`);

  const existing = await db.listCollections().toArray();
  const existingNames = new Set(existing.map((c) => c.name));

  for (const name of COLLECTIONS_TO_DROP) {
    if (!existingNames.has(name)) {
      console.log(`⏭️  ${name}: not present, skipping`);
      continue;
    }
    const coll = db.collection(name);
    const count = await coll.countDocuments();

    if (dryRun) {
      console.log(`[dry-run] Would drop "${name}" (${count} documents)`);
      continue;
    }

    try {
      await coll.drop();
      console.log(`✅ Dropped "${name}" (${count} documents)`);
    } catch (err) {
      console.error(`❌ Failed to drop "${name}":`, err instanceof Error ? err.message : err);
    }
  }

  console.log(dryRun ? '\nDone (dry run). Run without --dry-run to drop.' : '\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
