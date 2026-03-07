/**
 * Script to check the current deadline for תרגיל 3
 */

import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { isHomeworkAccessible, getEffectiveDeadline } from '../lib/deadline-utils';

async function checkExercise3Deadline() {
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
    console.log(`\n📅 Current deadline: ${exercise3Set.dueAt}`);
    
    const deadlineDate = new Date(exercise3Set.dueAt);
    console.log(`   Parsed as: ${deadlineDate.toISOString()}`);
    console.log(`   Local time: ${deadlineDate.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
    
    const now = new Date();
    console.log(`\n🕐 Current time: ${now.toISOString()}`);
    console.log(`   Local time: ${now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
    
    console.log(`\n📊 Comparison:`);
    console.log(`   Deadline: ${deadlineDate.getTime()}`);
    console.log(`   Now:      ${now.getTime()}`);
    console.log(`   Difference: ${(deadlineDate.getTime() - now.getTime()) / 1000 / 60} minutes`);
    
    // Check accessibility
    const isAccessible = isHomeworkAccessible(exercise3Set, null);
    console.log(`\n🔍 Is accessible (standard user): ${isAccessible ? '✅ YES' : '❌ NO'}`);
    
    // Check with extended deadline users
    const extendedUsers = ['nakash.tal@gmail.com', 'sagimor202@gmail.com'];
    for (const email of extendedUsers) {
      const effectiveDeadline = getEffectiveDeadline(exercise3Set.dueAt, email);
      const isAccessibleExtended = isHomeworkAccessible(exercise3Set, email);
      console.log(`\n🔍 Is accessible (${email}): ${isAccessibleExtended ? '✅ YES' : '❌ NO'}`);
      console.log(`   Effective deadline: ${effectiveDeadline.toISOString()}`);
      console.log(`   Local time: ${effectiveDeadline.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking deadline:', error);
    process.exit(1);
  }
}

// Run the script
checkExercise3Deadline();
