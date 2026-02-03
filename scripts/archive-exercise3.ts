/**
 * Archive "תרגיל 3" / "תרגיל בית 3" so it no longer appears for students.
 * Students will only see "הכנה למבחן" (or other published non-archived sets).
 *
 * Usage: npx tsx scripts/archive-exercise3.ts
 */

import { getHomeworkService } from "../lib/homework";

async function main() {
  const homeworkService = await getHomeworkService();
  const all = await homeworkService.listHomeworkSets({ pageSize: 1000 });
  const exercise3 = all.items.find(
    (hw) => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3"
  );

  if (!exercise3) {
    console.log("No homework set 'תרגיל 3' or 'תרגיל בית 3' found. Nothing to archive.");
    process.exit(0);
    return;
  }

  await homeworkService.updateHomeworkSet(exercise3.id, {
    published: false,
    visibility: "archived",
  });

  console.log(`Archived: "${exercise3.title}" (ID: ${exercise3.id})`);
  console.log("Students will no longer see this set in the student interface.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
