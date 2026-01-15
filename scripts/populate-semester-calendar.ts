import { connectToDatabase, COLLECTIONS } from '../lib/database';

interface WeeklyContentDoc {
  week: number;
  content: string;
  dateRange: string;
  updatedBy: string;
  updatedAt: string;
}

// Semester data from the provided calendar
const SEMESTER_START_DATE = '2025-11-05'; // 5.11.2025

const WEEKLY_CONTENT: Array<{week: number, date: string, content: string}> = [
  {
    week: 1,
    date: '5.11.2025',
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
    date: '12.11.2025',
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
    date: '19.11.2025',
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
    date: '26.11.2025',
    content: `צירוף יחסיים / GROUP BY

נושאים עיקריים:
- אילוצים: תחיון, צירוף יחסיים
- פקודת GROUP BY
- פונקציות התקבצות
- תרגול צירוף יחסיים`
  },
  {
    week: 5,
    date: '3.12.2025',
    content: `משתנים ופונקציות ב-SQL

נושאים עיקריים:
- סוגי משתנים ב-SQL
- פונקציות ב-SQL
- תרגול`
  },
  {
    week: 6,
    date: '10.12.2025',
    content: `COUNT / DISTINCT / GROUP BY

נושאים עיקריים:
- פקודת COUNT
- פקודת DISTINCT
- פקודת GROUP BY מתקדמת
- תרגול מסכם קבוצה`
  },
  {
    week: 7,
    date: '17.12.2025',
    content: `JOIN / ON / USING

נושאים עיקריים:
- פקודת JOIN
- צירופי-יחס
- ON / USING
- INNER JOIN, LEFT JOIN, RIGHT JOIN`
  },
  {
    week: 8,
    date: '24.12.2025',
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
    date: '31.12.2025',
    content: `תתי שאילות / תרגול Holmes Place

נושאים עיקריים:
- תתי שאילות (Sub-queries)
- שאילתות מקוננות
- תרגול מסכם - Holmes Place`
  },
  {
    week: 10,
    date: '7.1.2026',
    content: `מפתח ראשי / מפתח זר / DDL

נושאים עיקריים:
- מפתח ראשי (Primary Key)
- מפתח זר (Foreign Key)
- DDL מתקדם`
  },
  {
    week: 11,
    date: '14.1.2026',
    content: `ALTER / אינדקס / תרגול

נושאים עיקריים:
- פקודת ALTER
- פקודת ALTER TABLE
- אינדקס
- תרגול מסכם`
  },
  {
    week: 12,
    date: '21.1.2026',
    content: `DROP / VIEWS / טבלאות זמניות

נושאים עיקריים:
- פקודת DROP
- פקודת DROP TABLE
- VIEWS (צפיות)
- טבלאות זמניות`
  },
  {
    week: 13,
    date: '28.1.2026',
    content: `טריגרים / טבלאות וירטואליות

נושאים עיקריים:
- טריגרים (Triggers)
- טבלאות וירטואליות
- תרגול מסכם`
  }
];

async function populateSemesterCalendar() {
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
    
    // 3. Insert weekly content
    console.log('📚 Inserting weekly content...');
    let successCount = 0;
    
    for (const week of WEEKLY_CONTENT) {
      const weekStart = new Date(startDate.getTime() + (week.week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const dateRange = `${weekStart.toLocaleDateString('he-IL')} - ${weekEnd.toLocaleDateString('he-IL')}`;
      
      const weekDoc: WeeklyContentDoc = {
        week: week.week,
        content: week.content,
        dateRange: dateRange,
        updatedBy: 'admin-migration',
        updatedAt: new Date().toISOString()
      };
      
      await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).replaceOne(
        { week: week.week },
        weekDoc,
        { upsert: true }
      );
      
      successCount++;
      console.log(`✅ Week ${week.week} (${week.date}): Content inserted`);
    }
    
    console.log(`\n🎉 Successfully populated ${successCount} weeks of content!`);
    console.log(`📊 Semester: ${SEMESTER_START_DATE} - ${WEEKLY_CONTENT.length} weeks`);
    
    // 4. Verify the data
    console.log('\n🔍 Verifying data...');
    const semesterConfig = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({ type: 'semester_start' });
    const weeklyContent = await db.collection(COLLECTIONS.WEEKLY_CONTENT).find({}).sort({ week: 1 }).toArray();
    
    console.log(`\n📅 Semester Start Date: ${semesterConfig?.startDate}`);
    console.log(`📚 Total Weeks in Database: ${weeklyContent.length}`);
    
    // Show first and last week as examples
    if (weeklyContent.length > 0) {
      console.log('\n📖 Sample - Week 1:');
      console.log(`   Date Range: ${weeklyContent[0].dateRange}`);
      console.log(`   Content Preview: ${weeklyContent[0].content.substring(0, 100)}...`);
      
      const lastWeek = weeklyContent[weeklyContent.length - 1];
      console.log(`\n📖 Sample - Week ${lastWeek.week}:`);
      console.log(`   Date Range: ${lastWeek.dateRange}`);
      console.log(`   Content Preview: ${lastWeek.content.substring(0, 100)}...`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('💡 You can now view this in the admin panel at /admin/mcp-michael');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating semester calendar:', error);
    process.exit(1);
  }
}

// Run the migration
populateSemesterCalendar();

