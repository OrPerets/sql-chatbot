import "dotenv/config";

import {
  createHomeworkSet,
  getHomeworkService,
  updateHomeworkSet,
} from "../lib/homework";
import {
  createQuestion,
  getQuestionsByHomeworkSet,
  getQuestionsService,
} from "../lib/questions";
import type { HomeworkSet, Question } from "../app/homework/types";

type ImportQuestion = Pick<
  Question,
  "prompt" | "instructions" | "expectedOutputDescription" | "starterSql" | "expectedResultSchema" | "points" | "maxAttempts" | "evaluationMode"
>;

interface HomeworkImportSpec {
  title: string;
  aliases: string[];
  overview: string;
  backgroundStory: string;
  dataStructureNotes: string;
  dueAt: string;
  availableFrom: string;
  availableUntil: string;
  published: boolean;
  visibility: HomeworkSet["visibility"];
  questions: ImportQuestion[];
}

const HW1: HomeworkImportSpec = {
  title: "תרגיל בית 1",
  aliases: ["תרגיל בית 1", "תרגיל 1"],
  overview: "תרגיל SQL מעשי על עובדים, מחלקות, תפקידים ואתרים גלובליים.",
  backgroundStory:
    "בבסיס הנתונים מפורטים פרטי עובדים השייכים למחלקות שונות במפעל גלובלי, לצד תפקידים, רמות שכר ומיקומים גאוגרפיים שונים. על בסיס ארבע הטבלאות המרכזיות יש לכתוב שאילתות SQL לפתרון בעיות סינון, מיון, חישוב וחיבורים.",
  dataStructureNotes:
    "הטבלאות המרכזיות הן Employees, Departments, Jobs, Locations. Employees מקושרת ל-Departments דרך department_id ול-Jobs דרך job_id. Departments מקושרת ל-Locations דרך location_id.",
  availableFrom: "2025-11-25T00:00:00.000Z",
  availableUntil: "2025-12-02T21:59:00.000Z",
  dueAt: "2025-12-02T21:59:00.000Z",
  published: false,
  visibility: "draft",
  questions: [
    {
      prompt:
        "הציגו את השם הפרטי, שם המשפחה ושנת הלידה, עבור העובדים שנולדו בין השנים 1995 ל-2025 (ללא הקצוות) והמשכורת שלהם נעה בין 6,380 ל-8,090 ₪ (לא כולל קצוות).",
      instructions: "החזירו רק עובדים העומדים בשני התנאים יחד.",
      expectedOutputDescription: "הפלט צריך לכלול שם פרטי, שם משפחה ושנת לידה.",
      starterSql: `SELECT first_name, last_name, birth_date
FROM employees
WHERE birth_date > 1995
  AND birth_date < 2025
  AND salary > 6380
  AND salary < 8090;`,
      expectedResultSchema: [
        { column: "first_name", type: "string" },
        { column: "last_name", type: "string" },
        { column: "birth_date", type: "number" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "הציגו את שם המשפחה והשם הפרטי של העובדים אשר גילם פחות מ-23 ומשכורתם גדולה מ-2,230 אירו, לפי השער היציג כיום של 3.78 ₪ ל-1 אירו.",
      instructions: "אפשר לחשב את סכום הסף בשקלים או להמיר את המשכורת לאירו.",
      expectedOutputDescription: "הפלט צריך לכלול שם משפחה ושם פרטי של עובדים מתאימים.",
      starterSql: `SELECT last_name, first_name
FROM employees
WHERE (2025 - birth_date) < 23
  AND (salary / 3.78) > 2230;`,
      expectedResultSchema: [
        { column: "last_name", type: "string" },
        { column: "first_name", type: "string" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "לאור המצב בארץ, הוחלט שכל מי שעובד בתפקיד פקידותי (clerk) בישראל יקבל העלאה של 13.5%. הציגו שם משפחה, שם פרטי, השכר לפני התוספת והשכר החדש לאחר התוספת.",
      instructions: "חברו את טבלאות העובדים, התפקידים, המחלקות והמיקומים.",
      expectedOutputDescription: "הפלט צריך לכלול שם משפחה, שם פרטי, שכר ישן ושכר חדש לאחר העלאה.",
      starterSql: `SELECT e.last_name,
       e.first_name,
       e.salary AS old_salary,
       e.salary * 1.135 AS new_salary
FROM employees e
JOIN jobs j ON e.job_id = j.job_id
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE l.country = 'Israel'
  AND j.job_title = 'clerk';`,
      expectedResultSchema: [
        { column: "last_name", type: "string" },
        { column: "first_name", type: "string" },
        { column: "old_salary", type: "number" },
        { column: "new_salary", type: "number" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "הציגו את מס' ת.ז של העובדים שעובדים בעיר ששמה מכיל בדיוק 5 תווים ושהמדינה בה הם עובדים מכילה את האות \"a\" אך לא מכילה את האות \"e\". יש למיין לפי תעודת זהות בסדר יורד.",
      instructions: "השתמשו בבדיקות תבנית לעיר ולמדינה.",
      expectedOutputDescription: "הפלט צריך לכלול את מזהה העובד בלבד, במיון יורד.",
      starterSql: `SELECT e.employee_id
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE l.city LIKE '_____'
  AND l.country LIKE '%a%'
  AND l.country NOT LIKE '%e%'
ORDER BY e.employee_id DESC;`,
      expectedResultSchema: [{ column: "employee_id", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "הציגו את ת.ז. של העובד, קוד העבודה, שם המחלקה והמשכורת רק עבור העובדים שמשכורתם היא לפחות 9,669 ₪ וששם המשפחה שלהם מכיל את האות \"M\" וששם המחלקה בה הם עובדים לא מכיל את האות \"D\". מיין לפי משכורת בסדר עולה.",
      instructions: "שימו לב לסינון לפי אות בשם המשפחה ולשלילת אות בשם המחלקה.",
      expectedOutputDescription: "הפלט צריך לכלול מזהה עובד, קוד עבודה, שם מחלקה ומשכורת.",
      starterSql: `SELECT e.employee_id,
       e.job_id,
       d.department_name,
       e.salary
FROM employees e
JOIN departments d ON e.department_id = d.department_id
WHERE e.salary >= 9669
  AND e.last_name LIKE '%M%'
  AND d.department_name NOT LIKE '%D%'
ORDER BY e.salary ASC;`,
      expectedResultSchema: [
        { column: "employee_id", type: "string" },
        { column: "job_id", type: "string" },
        { column: "department_name", type: "string" },
        { column: "salary", type: "number" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "הציגו את ת.ז. של העובד ואת הגיל שלו רק עבור עובדים שעובדים ברחוב שמכיל את האות \"a\". סדרו לפי גיל בסדר יורד, ובמקרה של גיל זהה לפי תאריך תחילת העסקה בסדר עולה.",
      instructions: "חברו עובדים למחלקות ולמיקומים כדי להגיע לשם הרחוב.",
      expectedOutputDescription: "הפלט צריך לכלול מזהה עובד וגיל, עם מיון דו-שלבי.",
      starterSql: `SELECT e.employee_id,
       2025 - e.birth_date AS age
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE l.street LIKE '%a%'
ORDER BY age DESC, e.hire_date ASC;`,
      expectedResultSchema: [
        { column: "employee_id", type: "string" },
        { column: "age", type: "number" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "עבור כל תחום עיסוק בטבלת JOBS, הציגו את קטגורית התפקיד ואת השכר הממוצע לאותו תפקיד בדולרים לפי שער של 3.29 ₪. אין להשתמש בפונקציות הקבצה.",
      instructions: "השתמשו רק בטבלת JOBS.",
      expectedOutputDescription: "הפלט צריך לכלול job_title ו-average_of_salary_in_dollars.",
      starterSql: `SELECT job_title,
       ((min_salary + max_salary) / 2) / 3.29 AS average_of_salary_in_dollars
FROM jobs;`,
      expectedResultSchema: [
        { column: "job_title", type: "string" },
        { column: "average_of_salary_in_dollars", type: "number" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "הציגו שם משפחה, שם פרטי ותיאור תפקיד של העובדים שעובדים בטוקיו. מיין לפי משכורת בסדר עולה, ובמקרה של משכורת זהה לפי תאריך תחילת העסקה בסדר יורד.",
      instructions: "חברו את ארבע הטבלאות הרלוונטיות.",
      expectedOutputDescription: "הפלט צריך לכלול שם משפחה, שם פרטי ותיאור תפקיד.",
      starterSql: `SELECT e.last_name,
       e.first_name,
       j.job_title
FROM employees e
JOIN jobs j ON e.job_id = j.job_id
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE LOWER(l.city) = 'tokyo'
ORDER BY e.salary ASC, e.hire_date DESC;`,
      expectedResultSchema: [
        { column: "last_name", type: "string" },
        { column: "first_name", type: "string" },
        { column: "job_title", type: "string" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "עבור המחלקה שמכילה לפחות 3 פעמים את האות e בשם המחלקה, הציגו את כל פרטי העובדים שעובדים במחלקה זו מלבד עובדים שהם מהנדסים.",
      instructions: "יש להחזיר את כל העמודות מטבלת העובדים.",
      expectedOutputDescription: "הפלט צריך לכלול את כל עמודות העובד עבור עובדים במחלקות מתאימות שאינם engineers.",
      starterSql: `SELECT e.*
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN jobs j ON e.job_id = j.job_id
WHERE d.department_name LIKE '%e%e%e%'
  AND LOWER(j.job_title) <> 'engineer';`,
      expectedResultSchema: [],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
    {
      prompt:
        "הציגו את שמות המשפחה של העובדים ששם המשפחה שלהם מתחיל באות \"A\" או ששמם הפרטי מסתיים באות \"A\", ובנוסף ששם העיר בה הם עובדים מכיל '-' או ששם הרחוב בו הם עובדים מכיל '-'.",
      instructions: "החזירו רק את שם המשפחה.",
      expectedOutputDescription: "הפלט צריך לכלול שמות משפחה בלבד.",
      starterSql: `SELECT e.last_name
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE (e.last_name LIKE 'A%' OR e.first_name LIKE '%A')
  AND (l.city LIKE '%-%' OR l.street LIKE '%-%');`,
      expectedResultSchema: [{ column: "last_name", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "auto",
    },
  ],
};

const HW2: HomeworkImportSpec = {
  title: "תרגיל בית 2",
  aliases: ["תרגיל בית 2", "תרגיל 2"],
  overview: "תרגיל באלגברת יחסים על חוקרים, אוניברסיטאות ופרסומים אקדמיים.",
  backgroundStory:
    "מסד הנתונים מתאר מוסדות אקדמיים וחוקרים מרחבי העולם, יחד עם מאמרים שפורסמו בתחום תעשייה וניהול. התרגיל מתמקד בכתיבת ביטויי אלגברת יחסים על גבי סכמות הנתונים ללא רשומות בפועל.",
  dataStructureNotes:
    "הטבלאות הן Researchers(researcherName, universityName, researcherAddress, researcherGrant), Universities(universityName, state, NumberOfPublications), Publications(articleName, field, authorName, year). חוקר מזוהה גם כמחבר במאמרים, ושם האוניברסיטה קושר בין Researchers ל-Universities.",
  availableFrom: "2025-12-16T00:00:00.000Z",
  availableUntil: "2025-12-23T21:59:00.000Z",
  dueAt: "2025-12-23T21:59:00.000Z",
  published: false,
  visibility: "draft",
  questions: [
    {
      prompt:
        "הציגו את שמות האוניברסיטאות שנמצאות באיטליה, פורטוגל וספרד. הפתרון צריך לכלול את פקודת האיחוד או החיתוך.",
      instructions: "אלגברת יחסים בלבד.",
      expectedOutputDescription: "הפלט צריך לכלול שמות אוניברסיטאות ללא שדות נוספים.",
      starterSql: `π universityName (σ state = 'IT' (Universities))
∪ π universityName (σ state = 'PO' (Universities))
∪ π universityName (σ state = 'SP' (Universities))`,
      expectedResultSchema: [{ column: "universityName", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "הציגו את רשימת הארצות בהן יש אוניברסיטאות שפרסמו מעל 16 מאמרים. יש להציג את רשימת הארצות ללא כפילויות.",
      instructions: "השתמשו בהטלה לאחר סינון.",
      expectedOutputDescription: "הפלט צריך לכלול רשימת מדינות ללא כפילויות.",
      starterSql: `π state (σ NumberOfPublications > 16 (Universities))`,
      expectedResultSchema: [{ column: "state", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "הציגו את שם וסכום מלגת המחקר של החוקרים השייכים לאוניברסיטה שפרסמה פחות מ-8 מאמרים. יש לפתור בשתי דרכים שונות.",
      instructions: "רצוי להראות גם פתרון עם מכפלה וגם פתרון יעיל יותר עם צירוף.",
      expectedOutputDescription: "הפלט צריך לכלול researcherName ו-researcherGrant.",
      starterSql: `אפשרות יעילה:
π researcherName, researcherGrant
(σ NumberOfPublications < 8 (Universities ⨝ Researchers))`,
      expectedResultSchema: [
        { column: "researcherName", type: "string" },
        { column: "researcherGrant", type: "number" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "הציגו את שמות החוקרים ושמות האוניברסיטאות בהן הם מלמדים, רק עבור חוקרים הגרים במדינה בה הם מלמדים.",
      instructions: "בדקו התאמה בין researcherAddress לבין state לאחר הצירוף.",
      expectedOutputDescription: "הפלט צריך לכלול researcherName ו-universityName.",
      starterSql: `π researcherName, universityName
(σ researcherAddress = state (Universities ⨝ Researchers))`,
      expectedResultSchema: [
        { column: "researcherName", type: "string" },
        { column: "universityName", type: "string" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "הציגו את שמות וכתובות החוקרים שפרסמו מאמר ביחד עם החוקרת Prof. Nadya Segev.",
      instructions: "אפשר להשתמש בשינוי שם לטבלת Publications כדי להשוות מחברים על אותו articleName.",
      expectedOutputDescription: "הפלט צריך לכלול שמות וכתובות של חוקרים שפרסמו יחד עם Nadya Segev.",
      starterSql: `π P1.authorName, P1.authorAddress
(σ Publications.articleName = P1.articleName
 ∧ Publications.authorName = 'Prof. Nadya Segev'
 ∧ P1.authorName <> 'Prof. Nadya Segev'
 (Publications × ρ P1(Publications)))`,
      expectedResultSchema: [
        { column: "authorName", type: "string" },
        { column: "authorAddress", type: "string" },
      ],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "שמות החוקרים שפרסמו מאמר בנושא AI אך לא פרסמו אף מאמר בנושא DB.",
      instructions: "השתמשו בפעולת הפרש בין שתי הטלות.",
      expectedOutputDescription: "הפלט צריך לכלול שמות חוקרים בלבד.",
      starterSql: `π authorName (σ field = 'AI' (Publications))
−
π authorName (σ field = 'DB' (Publications))`,
      expectedResultSchema: [{ column: "authorName", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "שמות המאמרים שפורסמו על ידי חוקרים השייכים לאחת מהאוניברסיטאות בישראל. יש לפתור בדרך היעילה ביותר.",
      instructions: "צמצמו יחסים לפני המכפלה/הצירוף.",
      expectedOutputDescription: "הפלט צריך לכלול שמות מאמרים בלבד.",
      starterSql: `π articleName
(σ state = 'Israel' ((Universities ⨝ Researchers) ⨝ Publications))`,
      expectedResultSchema: [{ column: "articleName", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "שמות כל האוניברסיטאות שפרסמו מעל 13 מאמרים אך אין בהן חוקר שפרסם מאמר בנושא SQL בשנת 2025.",
      instructions: "השתמשו בפעולת הפרש.",
      expectedOutputDescription: "הפלט צריך לכלול שמות אוניברסיטאות בלבד.",
      starterSql: `π universityName (σ NumberOfPublications > 13 (Universities))
−
π universityName
(σ field = 'SQL' ∧ year = 2025
 ((Universities ⨝ Researchers) ⨝ Publications))`,
      expectedResultSchema: [{ column: "universityName", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "שמות האוניברסיטאות בסין שפרסמו יותר מאמרים מאשר אוניברסיטת ייל בארה\"ב.",
      instructions: "אפשר להשתמש בשינוי שם לאותה טבלה או בפתרון דו-שלבי.",
      expectedOutputDescription: "הפלט צריך לכלול שמות אוניברסיטאות בסין שעומדות בתנאי ההשוואה.",
      starterSql: `π U1.universityName
(σ U1.state = 'China'
 ∧ U2.universityName = 'Yale'
 ∧ U2.state = 'US'
 ∧ U1.NumberOfPublications > U2.NumberOfPublications
 (ρ U1(Universities) × ρ U2(Universities)))`,
      expectedResultSchema: [{ column: "universityName", type: "string" }],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
    {
      prompt:
        "עליכם לכתוב שאילתא באלגברת יחסים עם לפחות 4 פעולות, ולהסביר בשורה אחת מה עושה השאילתא.",
      instructions: "זוהי שאלה פתוחה. יש לצרף גם הסבר מילולי קצר.",
      expectedOutputDescription: "הפלט הוא ביטוי אלגברת יחסים תקין והסבר מילולי קצר על מטרתו.",
      starterSql: "",
      expectedResultSchema: [],
      points: 10,
      maxAttempts: 3,
      evaluationMode: "manual",
    },
  ],
};

async function upsertHomework(spec: HomeworkImportSpec) {
  const homeworkService = await getHomeworkService();
  const questionsService = await getQuestionsService();
  const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });

  const existing = allHomeworkSets.items.find((hw) => spec.aliases.includes(hw.title));

  const payload: Omit<HomeworkSet, "id" | "createdAt" | "updatedAt"> = {
    title: spec.title,
    courseId: "sql-course",
    dueAt: spec.dueAt,
    availableFrom: spec.availableFrom,
    availableUntil: spec.availableUntil,
    published: spec.published,
    entryMode: "listed",
    datasetPolicy: "shared",
    questionOrder: [],
    visibility: spec.visibility,
    createdBy: "admin",
    overview: spec.overview,
    backgroundStory: spec.backgroundStory,
    dataStructureNotes: spec.dataStructureNotes,
  };

  const homeworkSet = existing
    ? await updateHomeworkSet(existing.id, payload)
    : await createHomeworkSet(payload);

  if (!homeworkSet) {
    throw new Error(`Failed to upsert homework set: ${spec.title}`);
  }

  const currentQuestions = await getQuestionsByHomeworkSet(homeworkSet.id);
  for (const question of currentQuestions) {
    await questionsService.deleteQuestion(question.id);
  }

  const questionIds: string[] = [];
  for (const question of spec.questions) {
    const created = await createQuestion({
      homeworkSetId: homeworkSet.id,
      prompt: question.prompt,
      instructions: question.instructions,
      expectedOutputDescription: question.expectedOutputDescription,
      starterSql: question.starterSql,
      expectedResultSchema: question.expectedResultSchema,
      gradingRubric: [],
      datasetId: undefined,
      maxAttempts: question.maxAttempts,
      points: question.points,
      evaluationMode: question.evaluationMode,
    });
    questionIds.push(created.id);
  }

  await updateHomeworkSet(homeworkSet.id, {
    title: spec.title,
    questionOrder: questionIds,
    overview: spec.overview,
    backgroundStory: spec.backgroundStory,
    dataStructureNotes: spec.dataStructureNotes,
    dueAt: spec.dueAt,
    availableFrom: spec.availableFrom,
    availableUntil: spec.availableUntil,
    published: spec.published,
    visibility: spec.visibility,
    entryMode: "listed",
  });

  return { homeworkSetId: homeworkSet.id, questionCount: questionIds.length };
}

async function normalizeHomeworkTitles() {
  const homeworkService = await getHomeworkService();
  const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });

  const hw3 = allHomeworkSets.items.find((hw) => hw.title === "תרגיל 3");
  if (hw3) {
    await updateHomeworkSet(hw3.id, { title: "תרגיל בית 3" });
  }

  const examPrep = allHomeworkSets.items.find((hw) => hw.title === "תרגיל הכנה למבחן");
  if (examPrep) {
    await updateHomeworkSet(examPrep.id, { title: "הכנה למבחן" });
  }
}

async function main() {
  await normalizeHomeworkTitles();
  const hw1 = await upsertHomework(HW1);
  const hw2 = await upsertHomework(HW2);

  console.log(
    JSON.stringify(
      {
        success: true,
        imported: [
          { title: HW1.title, ...hw1 },
          { title: HW2.title, ...hw2 },
        ],
        normalizedTitles: ["תרגיל בית 3", "הכנה למבחן"],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Failed to import HW1/HW2:", error);
  process.exitCode = 1;
});
