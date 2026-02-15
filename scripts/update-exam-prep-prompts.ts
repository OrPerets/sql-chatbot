/**
 * Updates prompt and instructions for all 10 questions in "הכנה למבחן" / "תרגיל הכנה למבחן".
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
      "הציגו את כל המבחנים שמתקיימים בשבועיים הקרובים יחד עם מספר הנרשמים המאושרים לכל מבחן. כללו רק הרשמות בסטטוס 'approved'. מיינו לפי תאריך מבחן מהקרוב לרחוק.",
    instructions: "סכמה: מזהה מבחן, קוד קורס, תאריך מבחן, כמות נרשמים מאושרים",
  },
  {
    prompt:
      "הציגו את שמות הסטודנטים אשר לא רשומים לאף מבחן, ממויינים בסדר יורד עפ״י שם.",
    instructions: "סכמה: תעודת סטודנט, שם מלא",
  },
  {
    prompt:
      "הציגו לכל מבחן את הציון הגבוה ביותר ואת הציון הנמוך ביותר ואת מספר הנבחנים. הציגו רק מבחנים שיש להם ציונים. מיינו לפי מזהה מבחן.",
    instructions: "סכמה: מזהה מבחן, קוד קורס, ציון מקסימלי, ציון מינימלי, מספר נבחנים",
  },
  {
    prompt:
      "הציגו את ממוצע הציון לכל חוג בכל קורס מבחן, יחד עם מספר הסטודנטים שנבחנו. הציגו רק חוגים עם לפחות 3 נבחנים. מיינו לפי חוג ולאחר מכן לפי קוד קורס.",
    instructions: "סכמה: חוג, קוד קורס, ממוצע ציון, מספר נבחנים",
  },
  {
    prompt:
      "הציגו את הסטודנטים שניגשו ליותר ממבחן אחד, כולל מספר המבחנים וממוצע הציון שלהם. חשבו לפי מבחנים שונים שהסטודנט נרשם אליהם. הציגו רק סטודנטים עם יותר ממבחן אחד.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, מספר מבחנים, ממוצע ציון",
  },
  {
    prompt:
      "הציגו את המבחנים שהתקיימו בחדר 'A1' או שמשכם מעל 120 דקות. מיינו לפי משך מבחן מהארוך לקצר.",
    instructions: "סכמה: מזהה מבחן, קוד קורס, משך דקות, חדר",
  },
  {
    prompt:
      "הציגו את רשימת הסטודנטים עם סטטוס הרשמה 'waitlist' יחד עם פרטי המבחן. מיינו לפי תאריך מבחן ולאחר מכן לפי שם משפחה.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, תאריך מבחן, סטטוס",
  },
  {
    prompt:
      "הציגו לכל סטודנט את תאריך ההרשמה האחרון שלו למבחן ואת סטטוס ההרשמה האחרון. הציגו גם סטודנטים שלא נרשמו, עם ערכים ריקים. מיינו לפי שם מלא.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, תאריך הרשמה אחרון, סטטוס הרשמה אחרון",
  },
  {
    prompt:
      "הציגו את הסטודנטים שנרשמו למבחן אך עדיין לא קיבלו ציון. כללו רק הרשמות מאושרות. הציגו את הסטודנט, פרטי המבחן וסטטוס הרשמה.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, סטטוס",
  },
  {
    prompt:
      "הציגו את הסטודנטים שקיבלו ציון גבוה מהממוצע במבחן שלהם. מיינו לפי מזהה מבחן ולאחר מכן לפי ציון מהגבוה לנמוך.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, ציון, ממוצע מבחן",
  },
  // 11: Subqueries
  {
    prompt:
      "הציגו את הסטודנטים שקיבלו ציון גבוה מהממוצע הכולל של כל הציונים במערכת. השתמשו בתת-שאילתה לחישוב הממוצע הכולל. הציגו תעודת סטודנט, שם מלא, ציון וממוצע כללי. מיינו לפי ציון יורד.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, ציון, ממוצע כללי",
  },
  // 12: String functions (CONCAT, LENGTH)
  {
    prompt:
      "הציגו רשימת סטודנטים עם השם המלא בפורמט 'משפחה, פרטי' (שרשור שם משפחה, פסיק ורווח, שם פרטי) ואורך השם המלא בתווים. מיינו לפי שם משפחה ואז לפי שם פרטי.",
    instructions: "סכמה: שם מלא (משפחה פרטי), אורך שם",
  },
  // 13: JOINs
  {
    prompt:
      "הציגו טבלה שמקשרת סטודנטים, מבחנים וציונים: שם הסטודנט (שרשור פרטי ומשפחה), קוד הקורס, תאריך המבחן, החדר והציון. כלול רק נבחנים שקיבלו ציון. השתמשו ב-JOIN בין הטבלאות הרלוונטיות. מיינו לפי שם סטודנט ולפי תאריך מבחן.",
    instructions: "סכמה: שם סטודנט, קוד קורס, תאריך מבחן, חדר, ציון",
  },
  // 14: Advanced – top 3 per exam
  {
    prompt:
      "לכל מבחן, הציגו את שלושת הסטודנטים עם הציונים הגבוהים ביותר (מקום 1–3). הציגו מזהה מבחן, קוד קורס, דירוג (1/2/3), תעודת סטודנט, שם מלא וציון. במקרה שוויון בציון קבעו לפי מזהה סטודנט. שאלה מתקדמת – נדרש שימוש בתת-שאילתות או ב-JOIN מתאים.",
    instructions: "סכמה: מזהה מבחן, קוד קורס, דירוג, תעודת סטודנט, שם מלא, ציון",
  },
  // 15: Advanced – exams with above-average score spread
  {
    prompt:
      "הציגו את המבחנים שבהם פער הציונים (הפרש בין מקסימום למינימום) גדול מהפער הממוצע בכל המבחנים. הציגו מזהה מבחן, קוד קורס, ציון מינימלי, ציון מקסימלי, פער במבחן זה וממוצע הפער בכל המבחנים. מיינו לפי פער יורד. שאלה מתקדמת – נדרש חישוב ממוצע פערים בתת-שאילתה והשוואה.",
    instructions: "סכמה: מזהה מבחן, קוד קורס, ציון מינימלי, ציון מקסימלי, פער במבחן, ממוצע פער כללי",
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
