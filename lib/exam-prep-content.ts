import type { DatasetTablePreview } from "@/app/homework/types";

export const EXAM_PREP_TITLES = ["תרגיל הכנה למבחן", "הכנה למבחן"] as const;
export const EXAM_PREP_TITLE = "הכנה למבחן";
export const EXAM_PREP_DATASET_NAME = "הכנה למבחן - מסד תחרות דיבייט";
export const EXAM_PREP_ANNOUNCEMENT = "שאלות לקראת הבחינה שתערך ב 15.04";
export const EXAM_PREP_MOED_B_TITLE = "הכנה למבחן מועד ב";
export const EXAM_PREP_MOED_B_DATASET_NAME = "הכנה למבחן מועד ב - מסד פסטיבל קולנוע";
export const EXAM_PREP_MOED_B_ANNOUNCEMENT = "שאלות לקראת מבחן מועד ב";

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
  return EXAM_PREP_TITLES.some((candidate) => candidate === title) || title === EXAM_PREP_MOED_B_TITLE;
}

export function getExamPrepAnnouncement(title?: string | null): string {
  return title === EXAM_PREP_MOED_B_TITLE ? EXAM_PREP_MOED_B_ANNOUNCEMENT : EXAM_PREP_ANNOUNCEMENT;
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

export const EXAM_PREP_MOED_B_OVERVIEW =
  "סט תרגול להכנה למבחן מועד ב ב-SQL המתמקד בניתוח פסטיבל קולנוע, הקרנות, הזמנות ודירוגים.";

export const EXAM_PREP_MOED_B_BACKGROUND_STORY = `בתרגיל זה נשתמש במסד נתונים המתאר פסטיבל קולנוע עירוני. הנתונים כוללים סרטים, הקרנות, אורחים, הזמנות ודירוגים לאחר צפייה.

הטבלאות המרכזיות הן:
1) Films (FilmID, MovieCode, Title, Genre, Country, ReleaseYear)
2) Screenings (ScreeningID, MovieCode, ScreeningDate, StartTime, DurationMinutes, Theater)
3) Guests (GuestID, FirstName, LastName, City, MembershipLevel)
4) Bookings (BookingID, GuestID, ScreeningID, BookedAt, Status)
5) Ratings (GuestID, ScreeningID, Rating, RatedAt, FirstScreeningDate)

המטרה היא לכתוב שאילתות שמסייעות לצוות הפסטיבל להבין ביקוש להקרנות, דפוסי הזמנה, דירוגי סרטים והתנהגות אורחים.`;

export const EXAM_PREP_MOED_B_PREVIEW_TABLES: DatasetTablePreview[] = [
  {
    name: "Films",
    columns: ["FilmID", "MovieCode", "Title", "Genre", "Country", "ReleaseYear"],
    rows: [
      { FilmID: 1, MovieCode: "MV101", Title: "Northern Lights", Genre: "Documentary", Country: "Canada", ReleaseYear: 2024 },
      { FilmID: 2, MovieCode: "DR210", Title: "Second Act", Genre: "Drama", Country: "Israel", ReleaseYear: 2025 },
      { FilmID: 3, MovieCode: "CM330", Title: "Cafe Stories", Genre: "Comedy", Country: "France", ReleaseYear: 2023 },
      { FilmID: 4, MovieCode: "SF404", Title: "Orbital Dawn", Genre: "Sci-Fi", Country: "USA", ReleaseYear: 2025 },
      { FilmID: 5, MovieCode: "AN150", Title: "Paper Boats", Genre: "Animation", Country: "Japan", ReleaseYear: 2024 },
      { FilmID: 6, MovieCode: "TH275", Title: "Silent Harbor", Genre: "Thriller", Country: "UK", ReleaseYear: 2025 },
      { FilmID: 7, MovieCode: "DC600", Title: "River Keepers", Genre: "Documentary", Country: "Brazil", ReleaseYear: 2022 },
      { FilmID: 8, MovieCode: "DR501", Title: "Glass City", Genre: "Drama", Country: "Germany", ReleaseYear: 2024 },
      { FilmID: 9, MovieCode: "CM777", Title: "Late Check-in", Genre: "Comedy", Country: "USA", ReleaseYear: 2023 },
      { FilmID: 10, MovieCode: "HS310", Title: "Archive 47", Genre: "History", Country: "Poland", ReleaseYear: 2021 },
    ],
  },
  {
    name: "Screenings",
    columns: ["ScreeningID", "MovieCode", "ScreeningDate", "StartTime", "DurationMinutes", "Theater"],
    rows: [
      { ScreeningID: 201, MovieCode: "MV101", ScreeningDate: "2026-07-02", StartTime: "18:00", DurationMinutes: 95, Theater: "Theater A" },
      { ScreeningID: 202, MovieCode: "DR210", ScreeningDate: "2026-07-02", StartTime: "20:00", DurationMinutes: 110, Theater: "Theater B" },
      { ScreeningID: 203, MovieCode: "CM330", ScreeningDate: "2026-07-03", StartTime: "17:30", DurationMinutes: 90, Theater: "Theater C" },
      { ScreeningID: 204, MovieCode: "SF404", ScreeningDate: "2026-07-04", StartTime: "21:00", DurationMinutes: 135, Theater: "Theater A" },
      { ScreeningID: 205, MovieCode: "AN150", ScreeningDate: "2026-07-05", StartTime: "16:00", DurationMinutes: 80, Theater: "Theater D" },
      { ScreeningID: 206, MovieCode: "TH275", ScreeningDate: "2026-07-06", StartTime: "22:00", DurationMinutes: 125, Theater: "Theater B" },
      { ScreeningID: 207, MovieCode: "DC600", ScreeningDate: "2026-07-07", StartTime: "18:30", DurationMinutes: 105, Theater: "Theater A" },
      { ScreeningID: 208, MovieCode: "DR501", ScreeningDate: "2026-07-08", StartTime: "20:30", DurationMinutes: 115, Theater: "Theater C" },
      { ScreeningID: 209, MovieCode: "CM777", ScreeningDate: "2026-07-09", StartTime: "19:00", DurationMinutes: 100, Theater: "Theater B" },
      { ScreeningID: 210, MovieCode: "HS310", ScreeningDate: "2026-07-10", StartTime: "17:00", DurationMinutes: 130, Theater: "Theater A" },
      { ScreeningID: 211, MovieCode: "MV101", ScreeningDate: "2026-07-11", StartTime: "21:30", DurationMinutes: 95, Theater: "Theater D" },
      { ScreeningID: 212, MovieCode: "SF404", ScreeningDate: "2026-07-12", StartTime: "18:00", DurationMinutes: 140, Theater: "Theater A" },
    ],
  },
  {
    name: "Guests",
    columns: ["GuestID", "FirstName", "LastName", "City", "MembershipLevel"],
    rows: [
      { GuestID: 3001, FirstName: "Yael", LastName: "Barak", City: "Tel Aviv", MembershipLevel: "Gold" },
      { GuestID: 3002, FirstName: "Noam", LastName: "Cohen", City: "Haifa", MembershipLevel: "Silver" },
      { GuestID: 3003, FirstName: "Dana", LastName: "Levi", City: "Tel Aviv", MembershipLevel: "Student" },
      { GuestID: 3004, FirstName: "Amit", LastName: "Mizrahi", City: "Jerusalem", MembershipLevel: "Gold" },
      { GuestID: 3005, FirstName: "Roni", LastName: "Avraham", City: "Haifa", MembershipLevel: "Silver" },
      { GuestID: 3006, FirstName: "Maya", LastName: "Shaked", City: "Beer Sheva", MembershipLevel: "Student" },
      { GuestID: 3007, FirstName: "Eitan", LastName: "Navon", City: "Tel Aviv", MembershipLevel: "Gold" },
      { GuestID: 3008, FirstName: "Lior", LastName: "Katz", City: "Jerusalem", MembershipLevel: "Silver" },
      { GuestID: 3009, FirstName: "Shira", LastName: "Alon", City: "Haifa", MembershipLevel: "Student" },
      { GuestID: 3010, FirstName: "Tamar", LastName: "Dahan", City: "Tel Aviv", MembershipLevel: "Gold" },
      { GuestID: 3011, FirstName: "Gil", LastName: "Peretz", City: "Beer Sheva", MembershipLevel: "Silver" },
      { GuestID: 3012, FirstName: "Hila", LastName: "Sela", City: "Jerusalem", MembershipLevel: "Student" },
      { GuestID: 3013, FirstName: "Omer", LastName: "Gal", City: "Haifa", MembershipLevel: "Gold" },
      { GuestID: 3014, FirstName: "Neta", LastName: "Mor", City: "Tel Aviv", MembershipLevel: "Silver" },
      { GuestID: 3015, FirstName: "Ilan", LastName: "Regev", City: "Ashdod", MembershipLevel: "Student" },
    ],
  },
  {
    name: "Bookings",
    columns: ["BookingID", "GuestID", "ScreeningID", "BookedAt", "Status"],
    rows: [
      { BookingID: 1, GuestID: 3001, ScreeningID: 201, BookedAt: "2026-06-01", Status: "confirmed" },
      { BookingID: 2, GuestID: 3001, ScreeningID: 204, BookedAt: "2026-06-03", Status: "confirmed" },
      { BookingID: 3, GuestID: 3001, ScreeningID: 210, BookedAt: "2026-06-05", Status: "confirmed" },
      { BookingID: 4, GuestID: 3002, ScreeningID: 201, BookedAt: "2026-06-02", Status: "confirmed" },
      { BookingID: 5, GuestID: 3002, ScreeningID: 203, BookedAt: "2026-06-04", Status: "waitlist" },
      { BookingID: 6, GuestID: 3003, ScreeningID: 202, BookedAt: "2026-06-02", Status: "confirmed" },
      { BookingID: 7, GuestID: 3003, ScreeningID: 208, BookedAt: "2026-06-06", Status: "confirmed" },
      { BookingID: 8, GuestID: 3004, ScreeningID: 204, BookedAt: "2026-06-03", Status: "confirmed" },
      { BookingID: 9, GuestID: 3004, ScreeningID: 212, BookedAt: "2026-06-09", Status: "confirmed" },
      { BookingID: 10, GuestID: 3005, ScreeningID: 206, BookedAt: "2026-06-05", Status: "waitlist" },
      { BookingID: 11, GuestID: 3005, ScreeningID: 209, BookedAt: "2026-06-07", Status: "confirmed" },
      { BookingID: 12, GuestID: 3006, ScreeningID: 205, BookedAt: "2026-06-04", Status: "confirmed" },
      { BookingID: 13, GuestID: 3007, ScreeningID: 201, BookedAt: "2026-06-01", Status: "confirmed" },
      { BookingID: 14, GuestID: 3007, ScreeningID: 207, BookedAt: "2026-06-06", Status: "confirmed" },
      { BookingID: 15, GuestID: 3008, ScreeningID: 202, BookedAt: "2026-06-03", Status: "confirmed" },
      { BookingID: 16, GuestID: 3008, ScreeningID: 210, BookedAt: "2026-06-08", Status: "waitlist" },
      { BookingID: 17, GuestID: 3009, ScreeningID: 203, BookedAt: "2026-06-04", Status: "confirmed" },
      { BookingID: 18, GuestID: 3010, ScreeningID: 204, BookedAt: "2026-06-03", Status: "confirmed" },
      { BookingID: 19, GuestID: 3010, ScreeningID: 212, BookedAt: "2026-06-10", Status: "confirmed" },
      { BookingID: 20, GuestID: 3011, ScreeningID: 206, BookedAt: "2026-06-06", Status: "confirmed" },
      { BookingID: 21, GuestID: 3012, ScreeningID: 208, BookedAt: "2026-06-07", Status: "confirmed" },
      { BookingID: 22, GuestID: 3013, ScreeningID: 209, BookedAt: "2026-06-08", Status: "confirmed" },
      { BookingID: 23, GuestID: 3013, ScreeningID: 211, BookedAt: "2026-06-09", Status: "confirmed" },
      { BookingID: 24, GuestID: 3014, ScreeningID: 207, BookedAt: "2026-06-09", Status: "cancelled" },
      { BookingID: 25, GuestID: 3014, ScreeningID: 210, BookedAt: "2026-06-10", Status: "confirmed" },
    ],
  },
  {
    name: "Ratings",
    columns: ["GuestID", "ScreeningID", "Rating", "RatedAt", "FirstScreeningDate"],
    rows: [
      { GuestID: 3001, ScreeningID: 201, Rating: 92, RatedAt: "2026-07-03", FirstScreeningDate: "2026-07-02" },
      { GuestID: 3001, ScreeningID: 204, Rating: 88, RatedAt: "2026-07-05", FirstScreeningDate: "2026-07-04" },
      { GuestID: 3002, ScreeningID: 201, Rating: 84, RatedAt: "2026-07-03", FirstScreeningDate: "2026-07-02" },
      { GuestID: 3003, ScreeningID: 202, Rating: 79, RatedAt: "2026-07-03", FirstScreeningDate: "2026-07-02" },
      { GuestID: 3003, ScreeningID: 208, Rating: 86, RatedAt: "2026-07-09", FirstScreeningDate: "2026-07-08" },
      { GuestID: 3004, ScreeningID: 204, Rating: 95, RatedAt: "2026-07-05", FirstScreeningDate: "2026-07-04" },
      { GuestID: 3004, ScreeningID: 212, Rating: 90, RatedAt: "2026-07-13", FirstScreeningDate: "2026-07-12" },
      { GuestID: 3005, ScreeningID: 209, Rating: 81, RatedAt: "2026-07-10", FirstScreeningDate: "2026-07-09" },
      { GuestID: 3006, ScreeningID: 205, Rating: 89, RatedAt: "2026-07-06", FirstScreeningDate: "2026-07-05" },
      { GuestID: 3007, ScreeningID: 201, Rating: 91, RatedAt: "2026-07-03", FirstScreeningDate: "2026-07-02" },
      { GuestID: 3007, ScreeningID: 207, Rating: 87, RatedAt: "2026-07-08", FirstScreeningDate: "2026-07-07" },
      { GuestID: 3008, ScreeningID: 202, Rating: 82, RatedAt: "2026-07-03", FirstScreeningDate: "2026-07-02" },
      { GuestID: 3009, ScreeningID: 203, Rating: 78, RatedAt: "2026-07-04", FirstScreeningDate: "2026-07-03" },
      { GuestID: 3010, ScreeningID: 204, Rating: 93, RatedAt: "2026-07-05", FirstScreeningDate: "2026-07-04" },
      { GuestID: 3010, ScreeningID: 212, Rating: 94, RatedAt: "2026-07-13", FirstScreeningDate: "2026-07-12" },
      { GuestID: 3011, ScreeningID: 206, Rating: 83, RatedAt: "2026-07-07", FirstScreeningDate: "2026-07-06" },
      { GuestID: 3012, ScreeningID: 208, Rating: 77, RatedAt: "2026-07-09", FirstScreeningDate: "2026-07-08" },
      { GuestID: 3013, ScreeningID: 209, Rating: 85, RatedAt: "2026-07-10", FirstScreeningDate: "2026-07-09" },
      { GuestID: 3013, ScreeningID: 211, Rating: 88, RatedAt: "2026-07-12", FirstScreeningDate: "2026-07-11" },
    ],
  },
];

export const EXAM_PREP_MOED_B_QUESTIONS = [
  {
    prompt:
      "הציגו את כל ההקרנות שמתקיימות באולם 'Theater A' יחד עם מספר ההזמנות המאושרות לכל הקרנה. כללו רק הזמנות בסטטוס 'confirmed'. מיינו לפי תאריך ההקרנה ולאחר מכן לפי שעת התחלה.",
    instructions: "סכמה: מזהה הקרנה, קוד סרט, תאריך הקרנה, שעת התחלה, כמות הזמנות מאושרות",
    starterSql:
      "SELECT s.ScreeningID, s.MovieCode, s.ScreeningDate, s.StartTime, COUNT(b.BookingID) AS confirmed_count FROM Screenings s JOIN Bookings b ON b.ScreeningID = s.ScreeningID WHERE s.Theater = 'Theater A' AND b.Status = 'confirmed' GROUP BY s.ScreeningID, s.MovieCode, s.ScreeningDate, s.StartTime ORDER BY s.ScreeningDate, s.StartTime",
    expectedResultSchema: [
      { column: "מזהה הקרנה", type: "number" },
      { column: "קוד סרט", type: "string" },
      { column: "תאריך הקרנה", type: "date" },
      { column: "שעת התחלה", type: "string" },
      { column: "כמות הזמנות מאושרות", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את האורחים אשר לא ביצעו אף הזמנה. הציגו את השם המלא בשרשור של שם פרטי ושם משפחה בעמודה אחת. מיינו בסדר יורד לפי השם המלא.",
    instructions: "סכמה: מזהה אורח, שם מלא",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה אורח", type: "number" },
      { column: "שם מלא", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו לכל ז'אנר סרטים את הדירוג הגבוה ביותר, הדירוג הנמוך ביותר ומספר הדירוגים שהתקבלו. הציגו רק ז'אנרים שיש להם דירוגים. מיינו לפי שם הז'אנר.",
    instructions: "סכמה: ז'אנר, דירוג מקסימלי, דירוג מינימלי, מספר דירוגים",
    starterSql: "",
    expectedResultSchema: [
      { column: "ז'אנר", type: "string" },
      { column: "דירוג מקסימלי", type: "number" },
      { column: "דירוג מינימלי", type: "number" },
      { column: "מספר דירוגים", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את ממוצע הדירוג לכל עיר אורחים בכל ז'אנר סרטים, יחד עם מספר הדירוגים. הציגו רק צירופים של עיר וז'אנר שבהם יש לפחות 2 דירוגים. מיינו לפי עיר ולאחר מכן לפי ז'אנר.",
    instructions: "סכמה: עיר, ז'אנר, ממוצע דירוג, מספר דירוגים",
    starterSql: "",
    expectedResultSchema: [
      { column: "עיר", type: "string" },
      { column: "ז'אנר", type: "string" },
      { column: "ממוצע דירוג", type: "number" },
      { column: "מספר דירוגים", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את האורחים שביצעו הזמנות מאושרות ליותר מהקרנה אחת, כולל מספר ההקרנות השונות וממוצע הדירוג שלהם. חשבו את מספר ההקרנות לפי הזמנות בסטטוס 'confirmed'.",
    instructions: "סכמה: מזהה אורח, שם מלא, מספר הקרנות, ממוצע דירוג",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה אורח", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מספר הקרנות", type: "number" },
      { column: "ממוצע דירוג", type: "number" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו רק את 2 ההקרנות הארוכות ביותר שהתקיימו באולם 'Theater A' או שמשכן מעל 120 דקות. מיינו לפי משך ההקרנה מהארוך לקצר.",
    instructions: "סכמה: מזהה הקרנה, קוד סרט, משך דקות, אולם",
    starterSql:
      "SELECT TOP 2 ScreeningID, MovieCode, DurationMinutes, Theater FROM Screenings WHERE Theater = 'Theater A' OR DurationMinutes > 120 ORDER BY DurationMinutes DESC",
    expectedResultSchema: [
      { column: "מזהה הקרנה", type: "number" },
      { column: "קוד סרט", type: "string" },
      { column: "משך דקות", type: "number" },
      { column: "אולם", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את רשימת האורחים עם הזמנה בסטטוס 'waitlist' יחד עם פרטי ההקרנה והסרט. מיינו לפי תאריך ההקרנה ולאחר מכן לפי שם משפחה.",
    instructions: "סכמה: מזהה אורח, שם מלא, מזהה הקרנה, שם סרט, תאריך הקרנה, סטטוס",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה אורח", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מזהה הקרנה", type: "number" },
      { column: "שם סרט", type: "string" },
      { column: "תאריך הקרנה", type: "date" },
      { column: "סטטוס", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את האורחים שביצעו הזמנה מאושרת להקרנה אך עדיין לא נתנו דירוג. כללו את האורח, פרטי הסרט וההקרנה וסטטוס ההזמנה.",
    instructions: "סכמה: מזהה אורח, שם מלא, מזהה הקרנה, שם סרט, סטטוס",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה אורח", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מזהה הקרנה", type: "number" },
      { column: "שם סרט", type: "string" },
      { column: "סטטוס", type: "string" },
    ],
    points: 10,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו את הדירוגים הגבוהים מהממוצע של הז'אנר שלהם. השתמשו בתת-שאילתה או JOIN מתאים לחישוב ממוצע הז'אנר. הציגו מזהה אורח, שם מלא, ז'אנר, דירוג וממוצע ז'אנר. מיינו לפי ז'אנר ולאחר מכן לפי דירוג יורד.",
    instructions: "סכמה: מזהה אורח, שם מלא, ז'אנר, דירוג, ממוצע ז'אנר",
    starterSql: "",
    expectedResultSchema: [
      { column: "מזהה אורח", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "ז'אנר", type: "string" },
      { column: "דירוג", type: "number" },
      { column: "ממוצע ז'אנר", type: "number" },
    ],
    points: 15,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו רשימת אורחים עם השם המלא בפורמט 'משפחה, פרטי' ואורך השם המלא בתווים. הוסיפו את רמת החברות של האורח. מיינו לפי שם משפחה ואז לפי שם פרטי.",
    instructions: "סכמה: שם מלא (משפחה, פרטי), אורך שם, רמת חברות",
    starterSql: "",
    expectedResultSchema: [
      { column: "שם מלא (משפחה, פרטי)", type: "string" },
      { column: "אורך שם", type: "number" },
      { column: "רמת חברות", type: "string" },
    ],
    points: 15,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
  {
    prompt:
      "הציגו טבלה שמקשרת אורחים, סרטים, הקרנות ודירוגים: שם האורח, שם הסרט, הז'אנר, תאריך ההקרנה, האולם והדירוג. כללו רק אורחים שנתנו דירוג. השתמשו ב-JOIN בין הטבלאות הרלוונטיות. מיינו לפי שם אורח ולפי תאריך הקרנה.",
    instructions: "סכמה: שם אורח, שם סרט, ז'אנר, תאריך הקרנה, אולם, דירוג",
    starterSql: "",
    expectedResultSchema: [
      { column: "שם אורח", type: "string" },
      { column: "שם סרט", type: "string" },
      { column: "ז'אנר", type: "string" },
      { column: "תאריך הקרנה", type: "date" },
      { column: "אולם", type: "string" },
      { column: "דירוג", type: "number" },
    ],
    points: 15,
    maxAttempts: 3,
    evaluationMode: "auto" as const,
  },
] as const;
