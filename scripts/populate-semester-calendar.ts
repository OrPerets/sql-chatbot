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
    content: `הגדרות בסיסיות / 3 מבחנים - הספר והבוחנות / הגמא מילונים מסכמת
(1) הקדמה / סיכום / הספירות / המספרת המילונית - הגדרת מוטיבציה יצירת ישויות
(2) מבנה פקודה בסיסית / מבנה פקודה מתקדמת / יצירת טבלה חדשה / יצירת DDL / תיאור יעיל / DDL`
  },
  {
    week: 2,
    date: '12.11.2025',
    content: `אילוצים: בחירה / העדה
(2) מבנה פקודה בסיסית / מבנה פקודה מתקדמת / יצירת טבלה חדשה / תוכנת MYSQL הדגרה - פקודת SELECT / רשאונות / פקודת SELECT`
  },
  {
    week: 3,
    date: '19.11.2025',
    content: `אילוצים: הסדר / מכילה טריגר
(3) אילוצים: הסם: בחירה / העדה
(3) פקודת FROM יתר: גבול על וביטמל היראל - משה + MYSQL + WHERE משה + BETWEEN פקודת + אופרטוריים - MYSQL
(4) הרעל על - ה WHERE המשף קוידינט - פקודת / LIKE פקודת / AS / אופרטור יחס יותרוצאית`
  },
  {
    week: 4,
    date: '26.11.2025',
    content: `אילוצים: תחיון / צירוף (3) יחסיים (מקורו)
(4) אילוצים: הסם: בחירה / העדה
(5) אילוצים יחסים: בחירה / יתררידי + תרגילי מהררגמל במדמה ארילוצית יחסים / הממת פקודות התקובצת פוממחיות ומונקציות הקבצה על קבוצת עריבת BY GROUP`
  },
  {
    week: 5,
    date: '3.12.2025',
    content: `+ מטולת תולק (5) SQL ב סוגי משתנים ופונקציות
(תרגילים 5)`
  },
  {
    week: 6,
    date: '10.12.2025',
    content: `בעיורב של COUNT השא הונא (6) / DISTINC פקודת / SQL ב אירוח פקודת תרגול מסכם קבוצה כוחטל - (6) BY GROUP`
  },
  {
    week: 7,
    date: '17.12.2025',
    content: `(תשוא) אירוח פקודת [7]
(7>) JOIN פקודת יחסימן ב SQL ב / USING שומ ON פקודת / צירופי-יחס`
  },
  {
    week: 8,
    date: '24.12.2025',
    content: `בין השואה כין [8] / NULL פקודת
(7) מירקים מסבב סממ מייצרים ומוכנל פקודות סיון / שומל אירוח מל ברירות / פקודת DML כממלומת: INSERT , UPDATE , DELETE`
  },
  {
    week: 9,
    date: '31.12.2025',
    content: `תתי שאילות [9]
(8) Holmes Place מסכם תרגול`
  },
  {
    week: 10,
    date: '7.1.2026',
    content: `/ חללית הווחר [10] DDL פקודת : יר פמחת זר / ראשי פמחת`
  },
  {
    week: 11,
    date: '14.1.2026',
    content: `/ אינדקס - DDL פקודת [11] / ALTER אייבווים
(10) הסטודנט יום מסכם תרגול`
  },
  {
    week: 12,
    date: '21.1.2026',
    content: `/ שיםטש / DROP פקודת [12] / VIEWS השוואות פמיר TABLE ב צפיות / תפונחות הרכבת טבלאות / מתירת`
  },
  {
    week: 13,
    date: '28.1.2026',
    content: `מניכילו טבלאות / טריגרים [13]
(11) ליבירות בדיכה מסכם תרגול - 1 שער`
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

