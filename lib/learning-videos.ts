export type LearningVideo = {
  id: string;
  filename: string;
  title: string;
  shortTitle: string;
  description: string;
  concepts: string[];
};

export const LEARNING_VIDEOS: LearningVideo[] = [
  {
    id: "join-fundamentals",
    filename: "SQL_JOIN_Fundamentals.mp4",
    title: "יסודות פעולת JOIN",
    shortTitle: "JOIN Fundamentals",
    description: "איך מחברים מידע מטבלאות שונות בעזרת עמודות משותפות.",
    concepts: ["JOIN", "מפתחות", "התאמת רשומות"],
  },
  {
    id: "inner-join",
    filename: "SQL_INNER_JOIN.mp4",
    title: "INNER JOIN",
    shortTitle: "INNER JOIN",
    description: "החזרת הרשומות שקיימת ביניהן התאמה בשתי הטבלאות.",
    concepts: ["INNER JOIN", "ON", "תנאי התאמה"],
  },
  {
    id: "left-join",
    filename: "SQL_LEFT_JOIN_.mp4",
    title: "LEFT JOIN",
    shortTitle: "LEFT JOIN",
    description: "שמירת כל הרשומות מהטבלה השמאלית, גם כשאין התאמה.",
    concepts: ["LEFT JOIN", "NULL", "רשומות ללא התאמה"],
  },
  {
    id: "right-join",
    filename: "SQL_RIGHT_JOIN.mp4",
    title: "RIGHT JOIN",
    shortTitle: "RIGHT JOIN",
    description: "שמירת כל הרשומות מהטבלה הימנית, גם כשאין התאמה.",
    concepts: ["RIGHT JOIN", "NULL", "כיוון החיבור"],
  },
  {
    id: "full-outer-join",
    filename: "SQL_FULL_OUTER_JOIN.mp4",
    title: "FULL OUTER JOIN",
    shortTitle: "FULL OUTER JOIN",
    description: "שילוב כל הרשומות משתי הטבלאות, עם התאמה ובלעדיה.",
    concepts: ["FULL OUTER JOIN", "NULL", "איחוד התאמות"],
  },
  {
    id: "union",
    filename: "SQL_UNION.mp4",
    title: "UNION",
    shortTitle: "UNION",
    description: "חיבור תוצאות של שאילתות תואמות למערך תוצאות אחד.",
    concepts: ["UNION", "מבנה עמודות", "הסרת כפילויות"],
  },
];

