#!/usr/bin/env ts-node

import { DEFAULT_ADMIN_EMAILS } from '../lib/admin-emails';
import { DEFAULT_ACADEMIC_PERIOD, isNonEmptyAcademicValue } from '../lib/academic-period';
import { COLLECTIONS, connectToDatabase } from '../lib/database';

const PRIVILEGED_ROLES = ['admin', 'instructor', 'teacher', 'builder'];

function isApplyMode() {
  return process.argv.includes('--apply');
}

async function main() {
  const apply = isApplyMode();
  const { db } = await connectToDatabase();
  const adminEmails = DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase());

  const candidates = await db.collection(COLLECTIONS.USERS)
    .find({
      email: { $nin: adminEmails },
      role: { $nin: PRIVILEGED_ROLES },
      $or: [
        { year: { $exists: false } },
        { year: null },
        { year: '' },
        { semester: { $exists: false } },
        { semester: null },
        { semester: '' },
      ],
    })
    .project({ email: 1, firstName: 1, lastName: 1, name: 1, year: 1, semester: 1, role: 1 })
    .toArray();

  const updates = candidates
    .map((user) => {
      const $set: Record<string, number> = {};
      if (!isNonEmptyAcademicValue(user.year)) {
        $set.year = DEFAULT_ACADEMIC_PERIOD.year;
      }
      if (!isNonEmptyAcademicValue(user.semester)) {
        $set.semester = DEFAULT_ACADEMIC_PERIOD.semester;
      }
      return {
        user,
        update: Object.keys($set).length > 0 ? { $set } : null,
      };
    })
    .filter((item) => item.update);

  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`Target period: ${DEFAULT_ACADEMIC_PERIOD.year}/${DEFAULT_ACADEMIC_PERIOD.semester}`);
  console.log(`Candidate non-admin users missing year or semester: ${candidates.length}`);
  console.log(`Users that would be updated: ${updates.length}`);

  updates.slice(0, 25).forEach(({ user, update }) => {
    console.log(`${user.email || user._id}: ${JSON.stringify(update?.$set)}`);
  });

  if (!apply) {
    console.log('No writes performed. Re-run with --apply to update these users.');
    return;
  }

  if (updates.length === 0) {
    console.log('No updates needed.');
    return;
  }

  const result = await db.collection(COLLECTIONS.USERS).bulkWrite(
    updates.map(({ user, update }) => ({
      updateOne: {
        filter: { _id: user._id },
        update,
      },
    })),
  );

  console.log(`Matched: ${result.matchedCount}`);
  console.log(`Modified: ${result.modifiedCount}`);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
}).then(() => {
  process.exit(0);
});
