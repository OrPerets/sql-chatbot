/**
 * Check current week calculation and database state
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';
import { getCurrentWeekContextNormalized } from '../lib/content';

async function checkCurrentWeek() {
  try {
    console.log('🔍 Checking current week calculation...\n');
    
    const { db } = await connectToDatabase();
    
    // 1. Check semester start date in database
    const config = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({ type: 'semester_start' });
    console.log('📅 Semester Config in DB:');
    console.log('  Start Date:', config?.startDate || 'NOT SET');
    console.log('  Updated At:', config?.updatedAt || 'N/A');
    
    if (!config?.startDate) {
      console.log('\n❌ ERROR: Semester start date is not set in database!');
      console.log('   Run: npx tsx scripts/fix-weekly-content-db.ts');
      process.exit(1);
    }
    
    // 2. Calculate week manually
    const startDate = new Date(config.startDate);
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const daysSinceStart = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const rawWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    const week = Math.max(1, Math.min(14, rawWeek));
    
    console.log('\n📊 Week Calculation:');
    console.log('  Semester Start:', startDate.toISOString().split('T')[0]);
    console.log('  Today:', now.toISOString().split('T')[0]);
    console.log('  Days since start:', daysSinceStart);
    console.log('  Raw week:', rawWeek);
    console.log('  Calculated week:', week);
    
    // 3. Check what getCurrentWeekContextNormalized returns
    const context = await getCurrentWeekContextNormalized(null);
    console.log('\n🔧 getCurrentWeekContextNormalized() returns:');
    console.log('  Week Number:', context.weekNumber);
    console.log('  Date Range:', context.dateRange);
    console.log('  Has Content:', !!(context.content && context.content.trim()));
    
    if (context.weekNumber !== week) {
      console.log('\n⚠️  WARNING: Mismatch!');
      console.log(`  Manual calculation: Week ${week}`);
      console.log(`  Function returns: Week ${context.weekNumber}`);
    } else {
      console.log('\n✅ Week calculation matches!');
    }
    
    // 4. Check if week 9 content exists
    const week9Content = await db.collection(COLLECTIONS.WEEKLY_CONTENT).findOne({ week: 9 });
    console.log('\n📚 Week 9 Content in DB:');
    console.log('  Exists:', !!week9Content);
    if (week9Content) {
      console.log('  Date Range:', week9Content.dateRange);
      console.log('  Content Preview:', week9Content.content?.substring(0, 60) + '...');
    }
    
    // 5. Check week 6 content (what assistant thinks it is)
    const week6Content = await db.collection(COLLECTIONS.WEEKLY_CONTENT).findOne({ week: 6 });
    console.log('\n📚 Week 6 Content in DB:');
    console.log('  Exists:', !!week6Content);
    if (week6Content) {
      console.log('  Date Range:', week6Content.dateRange);
      console.log('  Content Preview:', week6Content.content?.substring(0, 60) + '...');
    }
    
    console.log('\n💡 If week is wrong, possible causes:');
    console.log('  1. Semester start date in DB is incorrect');
    console.log('  2. Timezone issues');
    console.log('  3. Assistant is using cached/old data');
    console.log('  4. Assistant is not calling get_course_week_context()');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCurrentWeek();
