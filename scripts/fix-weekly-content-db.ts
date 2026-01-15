/**
 * Fix weekly content in database - clean Hebrew text
 * 
 * This script fixes corrupted/mixed Hebrew-gibberish content in the weekly_content collection
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';

interface WeeklyContentDoc {
  week: number;
  content: string;
  dateRange: string;
  updatedBy: string;
  updatedAt: string;
}

// Semester data
const SEMESTER_START_DATE = '2025-11-05'; // 5.11.2025

// Clean weekly content based on documentation
const CLEAN_WEEKLY_CONTENT: Array<{week: number, content: string}> = [
  {
    week: 1,
    content: `הגדרות בסיסיות / DDL / יצירת טבלאות

נושאים עיקריים:
- הגדרות בסיסיות במסדי נתונים
- DDL (Data Definition Language)
- יצירת טבלאות
- מבנה פקודה בסיסית ומתקדמת
- המספרת המילונית - הגדרת מוטיבציה יצירת ישויות`
  },
  {
    week: 2,
    content: `אילוצים / SELECT / MYSQL

נושאים עיקריים:
- אילוצים: בחירה, העדה
- פקודת SELECT
- תוכנת MYSQL
- רשאונות
- מבנה פקודה בסיסית ומתקדמת`
  },
  {
    week: 3,
    content: `FROM / WHERE / BETWEEN / LIKE

נושאים עיקריים:
- פקודת FROM
- פקודת WHERE
- אופרטוריים: BETWEEN, LIKE
- אופרטור יחס
- AS`
  },
  {
    week: 4,
    content: `צירוף יחסיים / GROUP BY

נושאים עיקריים:
- אילוצים: תחיון, צירוף יחסיים
- פקודת GROUP BY
- פונקציות התקבצות
- תרגול צירוף יחסיים`
  },
  {
    week: 5,
    content: `משתנים ופונקציות ב-SQL

נושאים עיקריים:
- סוגי משתנים ב-SQL
- פונקציות ב-SQL
- תרגול`
  },
  {
    week: 6,
    content: `COUNT / DISTINCT / GROUP BY

נושאים עיקריים:
- פקודת COUNT
- פקודת DISTINCT
- פקודת GROUP BY מתקדמת
- תרגול מסכם קבוצה`
  },
  {
    week: 7,
    content: `JOIN / ON / USING

נושאים עיקריים:
- פקודת JOIN
- צירופי-יחס
- ON / USING
- INNER JOIN, LEFT JOIN, RIGHT JOIN`
  },
  {
    week: 8,
    content: `NULL / DML: INSERT, UPDATE, DELETE

נושאים עיקריים:
- NULL
- פקודת INSERT
- פקודת UPDATE
- פקודת DELETE
- DML (Data Manipulation Language)`
  },
  {
    week: 9,
    content: `תתי שאילות / תרגול Holmes Place

נושאים עיקריים:
- תתי שאילות (Sub-queries)
- שאילתות מקוננות
- תרגול מסכם - Holmes Place`
  },
  {
    week: 10,
    content: `מפתח ראשי / מפתח זר / DDL

נושאים עיקריים:
- מפתח ראשי (Primary Key)
- מפתח זר (Foreign Key)
- DDL מתקדם`
  },
  {
    week: 11,
    content: `ALTER / אינדקס / תרגול

נושאים עיקריים:
- פקודת ALTER
- פקודת ALTER TABLE
- אינדקס
- תרגול מסכם`
  },
  {
    week: 12,
    content: `DROP / VIEWS / טבלאות זמניות

נושאים עיקריים:
- פקודת DROP
- פקודת DROP TABLE
- VIEWS (צפיות)
- טבלאות זמניות`
  },
  {
    week: 13,
    content: `טריגרים / טבלאות וירטואליות

נושאים עיקריים:
- טריגרים (Triggers)
- טבלאות וירטואליות
- תרגול מסכם`
  }
];

async function fixWeeklyContent() {
  try {
    console.log('🔌 Connecting to database...');
    const { db } = await connectToDatabase();
    
    // 1. Set semester start date
    console.log('📅 Setting semester start date:', SEMESTER_START_DATE);
    await db.collection(COLLECTIONS.SEMESTER_CONFIG).replaceOne(
      { type: 'semester_start' },
      { 
        type: 'semester_start', 
        startDate: SEMESTER_START_DATE,
        updatedAt: new Date().toISOString()
      },
      { upsert: true }
    );
    console.log('✅ Semester start date set successfully');
    
    // 2. Calculate date ranges for each week
    const startDate = new Date(SEMESTER_START_DATE);
    
    // 3. Fix weekly content
    console.log('📚 Fixing weekly content...');
    let successCount = 0;
    
    for (const week of CLEAN_WEEKLY_CONTENT) {
      const weekStart = new Date(startDate.getTime() + (week.week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const dateRange = `${weekStart.toLocaleDateString('he-IL')} - ${weekEnd.toLocaleDateString('he-IL')}`;
      
      const weekDoc: WeeklyContentDoc = {
        week: week.week,
        content: week.content.trim(),
        dateRange: dateRange,
        updatedBy: 'admin-fix-script',
        updatedAt: new Date().toISOString()
      };
      
      // Get existing content to compare
      const existing = await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).findOne({ week: week.week });
      
      await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).replaceOne(
        { week: week.week },
        weekDoc,
        { upsert: true }
      );
      
      successCount++;
      const changed = existing && existing.content !== week.content.trim();
      console.log(`✅ Week ${week.week}: ${changed ? 'UPDATED' : 'VERIFIED'} - ${dateRange}`);
    }
    
    console.log(`\n🎉 Successfully fixed ${successCount} weeks of content!`);
    
    // 4. Verify the data
    console.log('\n🔍 Verifying data...');
    const weeklyContent = await db.collection(COLLECTIONS.WEEKLY_CONTENT).find({}).sort({ week: 1 }).toArray();
    
    console.log(`📚 Total Weeks in Database: ${weeklyContent.length}`);
    
    // Show sample weeks
    if (weeklyContent.length > 0) {
      console.log('\n📖 Sample - Week 1:');
      console.log(`   Date Range: ${weeklyContent[0].dateRange}`);
      console.log(`   Content Preview: ${weeklyContent[0].content.substring(0, 80)}...`);
      
      if (weeklyContent.length >= 7) {
        console.log(`\n📖 Sample - Week 7 (JOIN):`);
        const week7 = weeklyContent.find(w => w.week === 7);
        if (week7) {
          console.log(`   Date Range: ${week7.dateRange}`);
          console.log(`   Content Preview: ${week7.content.substring(0, 80)}...`);
        }
      }
      
      if (weeklyContent.length >= 9) {
        console.log(`\n📖 Sample - Week 9 (Sub-queries):`);
        const week9 = weeklyContent.find(w => w.week === 9);
        if (week9) {
          console.log(`   Date Range: ${week9.dateRange}`);
          console.log(`   Content Preview: ${week9.content.substring(0, 80)}...`);
        }
      }
    }
    
    console.log('\n✅ Database fix completed successfully!');
    console.log('💡 You can now view the clean content in the admin panel at /admin/mcp-michael');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing weekly content:', error);
    process.exit(1);
  }
}

// Run the fix
fixWeeklyContent();
