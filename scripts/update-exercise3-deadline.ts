/**
 * Script to update the deadline for תרגיל 3
 * Sets the deadline to January 13th, 2026 at 23:59
 * Extended deadline users (nakash.tal@gmail.com, sagimor202@gmail.com) 
 * will automatically get 2 additional days (until January 15th, 2026 at 23:59)
 */

import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';

async function updateExercise3Deadline() {
  try {
    const { db } = await connectToDatabase();
    const homeworkService = await getHomeworkService();

    // Find the homework set "תרגיל 3" or "תרגיל בית 3"
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(
      hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3"
    );

    if (!exercise3Set) {
      console.error('❌ Homework set "תרגיל 3" or "תרגיל בית 3" not found');
      process.exit(1);
    }

    console.log(`✅ Found homework set: ${exercise3Set.title} (ID: ${exercise3Set.id})`);
    console.log(`   Current deadline: ${exercise3Set.dueAt}`);

    // Set deadline to January 13th, 2026 at 23:59:59 (Israel time)
    // In January, Israel is on IST (Israel Standard Time) which is UTC+2
    // So 23:59:59 IST = 21:59:59 UTC
    const deadlineDate = new Date('2026-01-13T21:59:59.000Z'); // 23:59:59 Israel time (UTC+2)
    const deadlineISO = deadlineDate.toISOString();

    console.log(`\n🔄 Updating deadline to: ${deadlineISO}`);
    console.log(`   (January 13th, 2026 at 23:59 Israel time)`);

    const updated = await homeworkService.updateHomeworkSet(exercise3Set.id, {
      dueAt: deadlineISO,
    });

    if (!updated) {
      console.error('❌ Failed to update homework set');
      process.exit(1);
    }

    console.log(`\n✅ Successfully updated deadline!`);
    console.log(`   New deadline: ${updated.dueAt}`);
    console.log(`\n📋 Extended deadline users (2 additional days until January 15th, 2026 at 23:59):`);
    console.log(`   - nakash.tal@gmail.com`);
    console.log(`   - sagimor202@gmail.com`);
    console.log(`\n💡 The deadline extension is automatically handled by the deadline-utils.ts module.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating deadline:', error);
    process.exit(1);
  }
}

// Run the script
updateExercise3Deadline();
