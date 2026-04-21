import type { DatasetTablePreview } from "@/app/homework/types";

export const EXAM_PREP_TITLES = ["תרגיל הכנה למבחן", "הכנה למבחן"] as const;
export const EXAM_PREP_TITLE = "הכנה למבחן";
export const EXAM_PREP_DATASET_NAME = "הכנה למבחן - מסד תחרות דיבייט";
export const EXAM_PREP_ANNOUNCEMENT = "שאלות לקראת הבחינה שתערך ב 15.04";

export const EXAM_PREP_OVERVIEW =
  "סט תרגול להכנה למבחן SQL המתמקד בניתוח תחרות דיבייט, הרשמות ותוצאות.";

export const EXAM_PREP_BACKGROUND_STORY = `בתרגיל זה נשתמש במסד נתונים המתאר תחרות דיבייט ארצית לבתי ספר. הנתונים כוללים סבבי דיבייט, משתתפים, הרשמות לסבבים ותוצאות שיפוט.

הטבלאות המרכזיות הן:
1) Debates (DebateID, TopicCode, DebateDate, DurationMinutes, Hall)
2) Contestants (ContestantID, FirstName, LastName, School, GradeLevel)
3) Enrollments (EnrollmentID, ContestantID, DebateID, RegisteredAt, Status)
4) Results (ContestantID, DebateID, Score, JudgedAt, FirstDebateDate - תאריך ההשתתפות הראשונה)

המטרה היא לכתוב שאילתות שמסייעות למארגני התחרות להבין דפוסי הרשמה, נוכחות והישגים.`;

export function isExamPrepTitle(title?: string | null): boolean {
  return EXAM_PREP_TITLES.some((candidate) => candidate === title);
}

export const EXAM_PREP_PREVIEW_TABLES: DatasetTablePreview[] = [
  {
    name: "Debates",
    columns: ["DebateID", "TopicCode", "DebateDate", "DurationMinutes", "Hall"],
    rows: [
      { DebateID: 1, TopicCode: "POL101", DebateDate: "2026-02-15", DurationMinutes: 90, Hall: "North Hall" },
      { DebateID: 2, TopicCode: "ENV202", DebateDate: "2026-02-18", DurationMinutes: 120, Hall: "East Hall" },
      { DebateID: 3, TopicCode: "TECH101", DebateDate: "2026-02-22", DurationMinutes: 150, Hall: "North Hall" },
      { DebateID: 4, TopicCode: "EDU202", DebateDate: "2026-02-25", DurationMinutes: 90, Hall: "West Hall" },
      { DebateID: 5, TopicCode: "MEDIA201", DebateDate: "2026-03-01", DurationMinutes: 135, Hall: "North Hall" },
      { DebateID: 6, TopicCode: "ETH301", DebateDate: "2026-03-05", DurationMinutes: 105, Hall: "South Hall" },
      { DebateID: 7, TopicCode: "HEALTH101", DebateDate: "2026-03-08", DurationMinutes: 80, Hall: "City Hall" },
      { DebateID: 8, TopicCode: "LAW201", DebateDate: "2026-03-11", DurationMinutes: 140, Hall: "North Hall" },
      { DebateID: 9, TopicCode: "ECON330", DebateDate: "2026-03-14", DurationMinutes: 110, Hall: "Innovation Hall" },
      { DebateID: 10, TopicCode: "CULT220", DebateDate: "2026-03-18", DurationMinutes: 100, Hall: "Central Hall" },
    ],
  },
  {
    name: "Contestants",
    columns: ["ContestantID", "FirstName", "LastName", "School", "GradeLevel"],
    rows: [
      { ContestantID: 1001, FirstName: "Eli", LastName: "Cohen", School: "Herzl High", GradeLevel: 10 },
      { ContestantID: 1002, FirstName: "Maya", LastName: "Levy", School: "Rabin High", GradeLevel: 10 },
      { ContestantID: 1003, FirstName: "David", LastName: "Israeli", School: "Herzl High", GradeLevel: 11 },
      { ContestantID: 1004, FirstName: "Sarah", LastName: "Mizrahi", School: "Rabin High", GradeLevel: 10 },
      { ContestantID: 1005, FirstName: "Yossi", LastName: "Avraham", School: "Herzl High", GradeLevel: 11 },
      { ContestantID: 1006, FirstName: "Ronit", LastName: "Dahan", School: "Rabin High", GradeLevel: 9 },
      { ContestantID: 1007, FirstName: "Amit", LastName: "Ben-David", School: "Herzl High", GradeLevel: 10 },
      { ContestantID: 1008, FirstName: "Noa", LastName: "Shimon", School: "Galil School", GradeLevel: 9 },
      { ContestantID: 1009, FirstName: "Tom", LastName: "Gal", School: "Herzl High", GradeLevel: 12 },
      { ContestantID: 1010, FirstName: "Hila", LastName: "Adari", School: "Rabin High", GradeLevel: 11 },
    ],
  },
  {
    name: "Enrollments",
    columns: ["EnrollmentID", "ContestantID", "DebateID", "RegisteredAt", "Status"],
    rows: [
      { EnrollmentID: 1, ContestantID: 1001, DebateID: 1, RegisteredAt: "2026-01-10", Status: "approved" },
      { EnrollmentID: 2, ContestantID: 1001, DebateID: 2, RegisteredAt: "2026-01-12", Status: "approved" },
      { EnrollmentID: 3, ContestantID: 1001, DebateID: 5, RegisteredAt: "2026-01-18", Status: "approved" },
      { EnrollmentID: 4, ContestantID: 1002, DebateID: 1, RegisteredAt: "2026-01-11", Status: "approved" },
      { EnrollmentID: 5, ContestantID: 1002, DebateID: 3, RegisteredAt: "2026-01-14", Status: "waitlist" },
      { EnrollmentID: 6, ContestantID: 1003, DebateID: 1, RegisteredAt: "2026-01-09", Status: "approved" },
      { EnrollmentID: 7, ContestantID: 1003, DebateID: 2, RegisteredAt: "2026-01-13", Status: "approved" },
      { EnrollmentID: 8, ContestantID: 1004, DebateID: 2, RegisteredAt: "2026-01-11", Status: "approved" },
      { EnrollmentID: 9, ContestantID: 1005, DebateID: 3, RegisteredAt: "2026-01-14", Status: "approved" },
      { EnrollmentID: 10, ContestantID: 1009, DebateID: 8, RegisteredAt: "2026-01-21", Status: "approved" },
    ],
  },
  {
    name: "Results",
    columns: ["ContestantID", "DebateID", "Score", "JudgedAt", "FirstDebateDate"],
    rows: [
      { ContestantID: 1001, DebateID: 1, Score: 85, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1001, DebateID: 2, Score: 90, JudgedAt: "2026-02-19", FirstDebateDate: "2026-02-18" },
      { ContestantID: 1002, DebateID: 1, Score: 78, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1003, DebateID: 1, Score: 92, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1003, DebateID: 2, Score: 88, JudgedAt: "2026-02-19", FirstDebateDate: "2026-02-18" },
      { ContestantID: 1003, DebateID: 3, Score: 95, JudgedAt: "2026-02-23", FirstDebateDate: "2026-02-22" },
      { ContestantID: 1005, DebateID: 3, Score: 84, JudgedAt: "2026-02-23", FirstDebateDate: "2026-02-22" },
      { ContestantID: 1007, DebateID: 1, Score: 91, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1009, DebateID: 5, Score: 89, JudgedAt: "2026-03-02", FirstDebateDate: "2026-03-01" },
      { ContestantID: 1010, DebateID: 6, Score: 82, JudgedAt: "2026-03-06", FirstDebateDate: "2026-03-05" },
    ],
  },
];

export const EXAM_PREP_QUESTIONS = [
  {
    prompt:
      "הציגו את כל סבבי הדיבייט שמתקיימים בשבועיים הקרובים יחד עם מספר המשתתפים המאושרים לכל סבב. כללו רק הרשמות בסטטוס 'approved'. מיינו לפי תאריך הסבב מהקרוב לרחוק.",
    instructions:
      "סכמה: מזהה סבב, קוד נושא, תאריך סבב, כמות משתתפים מאושרים",
    starterSql:
      "SELECT d.DebateID, d.TopicCode, d.DebateDate, COUNT(e.EnrollmentID) AS approved_count FROM Debates d JOIN Enrollments e ON e.DebateID = d.DebateID WHERE e.Status = 'approved' AND DATEDIFF(d.DebateDate, CURDATE()) >= 0 AND DATEDIFF(d.DebateDate, CURDATE()) <= 14 GROUP BY d.DebateID, d.TopicCode, d.DebateDate ORDER BY d.DebateDate",
    expectedResultSchema: [
      { column: "מזהה סבב", type: "number" },
      { column: "קוד נושא", type: "string" },
      { column: "תאריך סבב", type: "date" },
      { column: "כמות משתתפים מאושרים", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את המשתתפים אשר לא רשומים לאף סבב דיבייט, כאשר שמות המשתתפים מוצגים בשרשור של שם פרטי ושם משפחה בעמודה אחת. מיינו בסדר יורד עפ״י השם המלא.",
    instructions: "סכמה: מזהה משתתף, שם מלא",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה משתתף", type: "number" },
      { column: "שם מלא", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו לכל סבב דיבייט את הציון הגבוה ביותר ואת הציון הנמוך ביותר ואת מספר המשתתפים שנשפטו. הציגו רק סבבים שיש להם תוצאות. מיינו לפי מזהה סבב.",
    instructions:
      "סכמה: מזהה סבב, קוד נושא, ציון מקסימלי, ציון מינימלי, מספר משתתפים",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה סבב", type: "number" },
      { column: "קוד נושא", type: "string" },
      { column: "ציון מקסימלי", type: "number" },
      { column: "ציון מינימלי", type: "number" },
      { column: "מספר משתתפים", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את ממוצע הציון לכל בית ספר בכל נושא דיבייט, יחד עם מספר המשתתפים שנשפטו. הציגו רק בתי ספר עם לפחות 3 משתתפים. מיינו לפי בית ספר ולאחר מכן לפי קוד נושא.",
    instructions:
      "סכמה: בית ספר, קוד נושא, ממוצע ציון, מספר משתתפים",
    starterSql: "",
    expectedResultSchema: [
      { column: "בית ספר", type: "string" },
      { column: "קוד נושא", type: "string" },
      { column: "ממוצע ציון", type: "number" },
      { column: "מספר משתתפים", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את המשתתפים שהשתתפו ביותר מסבב דיבייט אחד, כולל מספר הסבבים וממוצע הציון שלהם. חשבו לפי סבבים שונים שהמשתתף נרשם אליהם. הציגו רק משתתפים עם יותר מסבב אחד.",
    instructions:
      "סכמה: מזהה משתתף, שם מלא, מספר סבבים, ממוצע ציון",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה משתתף", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מספר סבבים", type: "number" },
      { column: "ממוצע ציון", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו רק את 2 סבבי הדיבייט הארוכים ביותר שהתקיימו באולם 'North Hall' או שמשכם מעל 120 דקות. מיינו לפי משך הסבב מהארוך לקצר.",
    instructions: "סכמה: מזהה סבב, קוד נושא, משך דקות, אולם",
    starterSql:
      "SELECT TOP 2 DebateID, TopicCode, DurationMinutes, Hall FROM Debates WHERE Hall = 'North Hall' OR DurationMinutes > 120 ORDER BY DurationMinutes DESC",
    expectedResultSchema: [
      { column: "מזהה סבב", type: "number" },
      { column: "קוד נושא", type: "string" },
      { column: "משך דקות", type: "number" },
      { column: "אולם", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את רשימת המשתתפים עם סטטוס הרשמה 'waitlist' יחד עם פרטי סבב הדיבייט. מיינו לפי תאריך הסבב ולאחר מכן לפי שם משפחה.",
    instructions:
      "סכמה: מזהה משתתף, שם מלא, מזהה סבב, קוד נושא, תאריך סבב, סטטוס",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה משתתף", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מזהה סבב", type: "number" },
      { column: "קוד נושא", type: "string" },
      { column: "תאריך סבב", type: "date" },
      { column: "סטטוס", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את המשתתפים שנרשמו לסבב דיבייט אך עדיין לא קיבלו ציון. כללו רק הרשמות מאושרות. הציגו את המשתתף, פרטי הסבב וסטטוס הרשמה.",
    instructions:
      "סכמה: מזהה משתתף, שם מלא, מזהה סבב, קוד נושא, סטטוס",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה משתתף", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מזהה סבב", type: "number" },
      { column: "קוד נושא", type: "string" },
      { column: "סטטוס", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את המשתתפים שקיבלו ציון גבוה מהממוצע הכולל של כל הציונים במערכת. השתמשו בתת-שאילתה לחישוב הממוצע הכולל. הציגו מזהה משתתף, שם מלא, ציון וממוצע כללי. מיינו לפי ציון יורד.",
    instructions: "סכמה: מזהה משתתף, שם מלא, ציון, ממוצע כללי",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה משתתף", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "ציון", type: "number" },
      { column: "ממוצע כללי", type: "number" },
    ],
    points: 15,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו רשימת משתתפים עם השם המלא בפורמט 'משפחה, פרטי' (שרשור שם משפחה, פסיק ורווח, שם פרטי) ואורך השם המלא בתווים. מיינו לפי שם משפחה ואז לפי שם פרטי.",
    instructions: "סכמה: שם מלא (משפחה, פרטי), אורך שם",
    starterSql: "",
    expectedResultSchema: [
      { column: "שם מלא (משפחה, פרטי)", type: "string" },
      { column: "אורך שם", type: "number" },
    ],
    points: 15,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו טבלה שמקשרת משתתפים, סבבי דיבייט ותוצאות: שם המשתתף (שרשור פרטי ומשפחה), קוד הנושא, תאריך הסבב, האולם והציון. כללו רק משתתפים שקיבלו ציון. השתמשו ב-JOIN בין הטבלאות הרלוונטיות. מיינו לפי שם משתתף ולפי תאריך סבב.",
    instructions: "סכמה: שם משתתף, קוד נושא, תאריך סבב, אולם, ציון",
    starterSql: "",
    expectedResultSchema: [
      { column: "שם משתתף", type: "string" },
      { column: "קוד נושא", type: "string" },
      { column: "תאריך סבב", type: "date" },
      { column: "אולם", type: "string" },
      { column: "ציון", type: "number" },
    ],
    points: 15,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
] as const;
