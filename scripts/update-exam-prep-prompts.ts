/**
 * Updates prompt and instructions for all 14 questions in "הכנה למבחן" / "תרגיל הכנה למבחן".
 * - prompt = the question text (including sorting/filter rules)
 * - instructions = schema only, e.g. "סכמה: שם סטודנט"
 *
 * Run: npx tsx scripts/update-exam-prep-prompts.ts
 */

import { connectToDatabase } from "../lib/database";
import { getHomeworkService } from "../lib/homework";
import { getQuestionsByHomeworkSet, updateQuestion } from "../lib/questions";

const REFINED_QUESTIONS = [
  {
    prompt:
      "הציגו את כל סבבי הדיבייט שמתקיימים בשבועיים הקרובים יחד עם מספר המשתתפים המאושרים לכל סבב. כללו רק הרשמות בסטטוס 'approved'. מיינו לפי תאריך הסבב מהקרוב לרחוק.",
    instructions: "סכמה: מזהה סבב, קוד נושא, תאריך סבב, כמות משתתפים מאושרים",
  },
  {
    prompt:
      "הציגו את שמות המשתתפים אשר לא רשומים לאף סבב דיבייט, ממויינים בסדר יורד עפ״י שם.",
    instructions: "סכמה: מזהה משתתף, שם מלא",
  },
  {
    prompt:
      "הציגו לכל סבב דיבייט את הציון הגבוה ביותר ואת הציון הנמוך ביותר ואת מספר המשתתפים שנשפטו. הציגו רק סבבים שיש להם תוצאות. מיינו לפי מזהה סבב.",
    instructions: "סכמה: מזהה סבב, קוד נושא, ציון מקסימלי, ציון מינימלי, מספר משתתפים",
  },
  {
    prompt:
      "הציגו את ממוצע הציון לכל בית ספר בכל נושא דיבייט, יחד עם מספר המשתתפים שנשפטו. הציגו רק בתי ספר עם לפחות 3 משתתפים. מיינו לפי בית ספר ולאחר מכן לפי קוד נושא.",
    instructions: "סכמה: בית ספר, קוד נושא, ממוצע ציון, מספר משתתפים",
  },
  {
    prompt:
      "הציגו את המשתתפים שהשתתפו ביותר מסבב דיבייט אחד, כולל מספר הסבבים וממוצע הציון שלהם. חשבו לפי סבבים שונים שהמשתתף נרשם אליהם. הציגו רק משתתפים עם יותר מסבב אחד.",
    instructions: "סכמה: מזהה משתתף, שם מלא, מספר סבבים, ממוצע ציון",
  },
  {
    prompt:
      "הציגו את סבבי הדיבייט שהתקיימו באולם 'North Hall' או שמשכם מעל 120 דקות. מיינו לפי משך הסבב מהארוך לקצר.",
    instructions: "סכמה: מזהה סבב, קוד נושא, משך דקות, אולם",
  },
  {
    prompt:
      "הציגו את רשימת המשתתפים עם סטטוס הרשמה 'waitlist' יחד עם פרטי סבב הדיבייט. מיינו לפי תאריך הסבב ולאחר מכן לפי שם משפחה.",
    instructions: "סכמה: מזהה משתתף, שם מלא, מזהה סבב, קוד נושא, תאריך סבב, סטטוס",
  },
  {
    prompt:
      "הציגו את המשתתפים שנרשמו לסבב דיבייט אך עדיין לא קיבלו ציון. כללו רק הרשמות מאושרות. הציגו את המשתתף, פרטי הסבב וסטטוס הרשמה.",
    instructions: "סכמה: מזהה משתתף, שם מלא, מזהה סבב, קוד נושא, סטטוס",
  },
  {
    prompt:
      "הציגו את המשתתפים שקיבלו ציון גבוה מהממוצע בסבב הדיבייט שלהם. מיינו לפי מזהה סבב ולאחר מכן לפי ציון מהגבוה לנמוך.",
    instructions: "סכמה: מזהה משתתף, שם מלא, מזהה סבב, ציון, ממוצע סבב",
  },
  // 11: Subqueries
  {
    prompt:
      "הציגו את המשתתפים שקיבלו ציון גבוה מהממוצע הכולל של כל הציונים במערכת. השתמשו בתת-שאילתה לחישוב הממוצע הכולל. הציגו מזהה משתתף, שם מלא, ציון וממוצע כללי. מיינו לפי ציון יורד.",
    instructions: "סכמה: מזהה משתתף, שם מלא, ציון, ממוצע כללי",
  },
  // 12: String functions (CONCAT, LENGTH)
  {
    prompt:
      "הציגו רשימת משתתפים עם השם המלא בפורמט 'משפחה, פרטי' (שרשור שם משפחה, פסיק ורווח, שם פרטי) ואורך השם המלא בתווים. מיינו לפי שם משפחה ואז לפי שם פרטי.",
    instructions: "סכמה: שם מלא (משפחה, פרטי), אורך שם",
  },
  // 13: JOINs
  {
    prompt:
      "הציגו טבלה שמקשרת משתתפים, סבבי דיבייט ותוצאות: שם המשתתף (שרשור פרטי ומשפחה), קוד הנושא, תאריך הסבב, האולם והציון. כללו רק משתתפים שקיבלו ציון. השתמשו ב-JOIN בין הטבלאות הרלוונטיות. מיינו לפי שם משתתף ולפי תאריך סבב.",
    instructions: "סכמה: שם משתתף, קוד נושא, תאריך סבב, אולם, ציון",
  },
  // 13: Advanced – top 3 per debate
  {
    prompt:
      "לכל סבב דיבייט, הציגו את שלושת המשתתפים עם הציונים הגבוהים ביותר (מקום 1–3). הציגו מזהה סבב, קוד נושא, דירוג (1/2/3), מזהה משתתף, שם מלא וציון. במקרה שוויון בציון קבעו לפי מזהה משתתף. שאלה מתקדמת – נדרש שימוש בתת-שאילתות או ב-JOIN מתאים.",
    instructions: "סכמה: מזהה סבב, קוד נושא, דירוג, מזהה משתתף, שם מלא, ציון",
  },
  // 14: Advanced – debates with above-average score spread
  {
    prompt:
      "הציגו את סבבי הדיבייט שבהם פער הציונים (הפרש בין מקסימום למינימום) גדול מהפער הממוצע בכל הסבבים. הציגו מזהה סבב, קוד נושא, ציון מינימלי, ציון מקסימלי, פער בסבב זה וממוצע הפער בכל הסבבים. מיינו לפי פער יורד. שאלה מתקדמת – נדרש חישוב ממוצע פערים בתת-שאילתה והשוואה.",
    instructions: "סכמה: מזהה סבב, קוד נושא, ציון מינימלי, ציון מקסימלי, פער בסבב, ממוצע פער כללי",
  },
];

async function main() {
  await connectToDatabase();
  const homeworkService = await getHomeworkService();
  const allSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
  const examPrepSet = allSets.items.find(
    (hw) => hw.title === "תרגיל הכנה למבחן" || hw.title === "הכנה למבחן"
  );

  if (!examPrepSet) {
    console.error('❌ Homework set "הכנה למבחן" / "תרגיל הכנה למבחן" not found');
    process.exit(1);
  }

  const questionOrder = examPrepSet.questionOrder || [];
  const existingQuestions = await getQuestionsByHomeworkSet(examPrepSet.id);

  if (existingQuestions.length !== REFINED_QUESTIONS.length) {
    console.error(
      `❌ Expected ${REFINED_QUESTIONS.length} questions, found ${existingQuestions.length}`
    );
    process.exit(1);
  }

  // Match by questionOrder so we update Q1, Q2, ... in the right order
  const orderedIds = questionOrder.length === existingQuestions.length
    ? questionOrder
    : existingQuestions.map((q) => q.id);

  console.log(`✅ Found set: ${examPrepSet.title} (${existingQuestions.length} questions)\n`);

  for (let i = 0; i < REFINED_QUESTIONS.length; i++) {
    const questionId = orderedIds[i];
    const existing = existingQuestions.find((q) => q.id === questionId);
    if (!existing) {
      console.error(`❌ Question ${i + 1} (id ${questionId}) not found`);
      process.exit(1);
    }

    const { prompt, instructions } = REFINED_QUESTIONS[i];
    if (existing.prompt === prompt && existing.instructions === instructions) {
      console.log(`${i + 1}. [unchanged] ${prompt.substring(0, 50)}...`);
      continue;
    }

    const updated = await updateQuestion(existing.id, { prompt, instructions });
    if (updated) {
      console.log(`${i + 1}. [updated] ${prompt.substring(0, 50)}...`);
      console.log(`   instructions: ${instructions}`);
    } else {
      console.error(`❌ Failed to update question ${i + 1}`);
      process.exit(1);
    }
  }

  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
