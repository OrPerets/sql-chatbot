import {
  getSqlCoinChallengeDifficultyLabel,
  getSqlCoinChallengeTopicLabel,
  type SqlCoinChallengeDifficulty,
  type SqlCoinChallengeTopic,
} from "@/lib/sql-coin-challenge-options";

export interface BuiltInSqlCoinChallengeQuestion {
  queryId: string;
  practiceId: string;
  table?: string;
  topic: SqlCoinChallengeTopic;
  topicLabel: string;
  difficulty: SqlCoinChallengeDifficulty;
  difficultyLabel: string;
  question: string;
  answerSql: string;
}

type BankQuestionSpec = Omit<
  BuiltInSqlCoinChallengeQuestion,
  "queryId" | "practiceId" | "topicLabel" | "difficultyLabel"
>;

const BANK_SPECS: BankQuestionSpec[] = [
  {
    topic: "subqueries",
    difficulty: "easy",
    table: "students, enrollments",
    question: "בטבלת students יש id,name ובטבלת enrollments יש student_id. הציגו שמות סטודנטים שיש להם לפחות הרשמה אחת.",
    answerSql: "SELECT name FROM students WHERE id IN (SELECT student_id FROM enrollments)",
  },
  {
    topic: "subqueries",
    difficulty: "easy",
    table: "courses, enrollments",
    question: "בטבלת courses יש id,course_name ובטבלת enrollments יש course_id,semester. הציגו שמות קורסים שיש להם הרשמה בסמסטר 2.",
    answerSql: "SELECT course_name FROM courses WHERE id IN (SELECT course_id FROM enrollments WHERE semester = 2)",
  },
  {
    topic: "subqueries",
    difficulty: "easy",
    table: "students, submissions",
    question: "בטבלת students יש id,name ובטבלת submissions יש student_id. הציגו שמות סטודנטים שאין להם הגשה.",
    answerSql: "SELECT name FROM students WHERE id NOT IN (SELECT student_id FROM submissions)",
  },
  {
    topic: "subqueries",
    difficulty: "medium",
    table: "students, grades",
    question: "בטבלת students יש id,name ובטבלת grades יש student_id,grade. הציגו שמות סטודנטים שקיבלו לפחות ציון 90.",
    answerSql: "SELECT name FROM students WHERE id IN (SELECT student_id FROM grades WHERE grade >= 90)",
  },
  {
    topic: "subqueries",
    difficulty: "medium",
    table: "courses, grades",
    question: "בטבלת courses יש id,course_name ובטבלת grades יש course_id,grade. הציגו שמות קורסים שממוצע הציונים בהם לפחות 85.",
    answerSql: "SELECT course_name FROM courses WHERE id IN (SELECT course_id FROM grades GROUP BY course_id HAVING AVG(grade) >= 85)",
  },
  {
    topic: "subqueries",
    difficulty: "medium",
    table: "students",
    question: "בטבלת students יש name,year. הציגו שמות סטודנטים שנמצאים בשנה הגבוהה ביותר שמופיעה בטבלה.",
    answerSql: "SELECT name FROM students WHERE year = (SELECT MAX(year) FROM students)",
  },
  {
    topic: "subqueries",
    difficulty: "hard",
    table: "students, enrollments",
    question: "בטבלת students יש id,name ובטבלת enrollments יש student_id,status. הציגו שמות סטודנטים שיש להם הרשמה פעילה.",
    answerSql: "SELECT name FROM students WHERE EXISTS (SELECT 1 FROM enrollments WHERE enrollments.student_id = students.id AND enrollments.status = 'active')",
  },
  {
    topic: "subqueries",
    difficulty: "hard",
    table: "courses",
    question: "בטבלת courses יש course_name,credits. הציגו שמות קורסים שמספר הנקודות שלהם גבוה מהממוצע בטבלה.",
    answerSql: "SELECT course_name FROM courses WHERE credits > (SELECT AVG(credits) FROM courses)",
  },
  {
    topic: "subqueries",
    difficulty: "hard",
    table: "students, grades",
    question: "בטבלת students יש id,name ובטבלת grades יש student_id,grade. הציגו שמות סטודנטים שקיבלו ציון גבוה מהממוצע הכללי.",
    answerSql: "SELECT name FROM students WHERE id IN (SELECT student_id FROM grades WHERE grade > (SELECT AVG(grade) FROM grades))",
  },
  {
    topic: "joins",
    difficulty: "easy",
    table: "students, enrollments",
    question: "בטבלת students יש id,name ובטבלת enrollments יש student_id,course_id. הציגו שם סטודנט ולצידו מזהה קורס מהרשמות.",
    answerSql: "SELECT students.name, enrollments.course_id FROM students JOIN enrollments ON students.id = enrollments.student_id",
  },
  {
    topic: "joins",
    difficulty: "easy",
    table: "students, grades",
    question: "בטבלת students יש id,name ובטבלת grades יש student_id,grade. הציגו שם סטודנט וציון.",
    answerSql: "SELECT students.name, grades.grade FROM students JOIN grades ON students.id = grades.student_id",
  },
  {
    topic: "joins",
    difficulty: "easy",
    table: "courses, teachers",
    question: "בטבלת courses יש course_name,teacher_id ובטבלת teachers יש id,name. הציגו שם קורס ושם מרצה.",
    answerSql: "SELECT courses.course_name, teachers.name FROM courses JOIN teachers ON courses.teacher_id = teachers.id",
  },
  {
    topic: "joins",
    difficulty: "medium",
    table: "students, enrollments, courses",
    question: "הציגו שם סטודנט ושם קורס באמצעות students(id,name), enrollments(student_id,course_id), courses(id,course_name).",
    answerSql: "SELECT students.name, courses.course_name FROM students JOIN enrollments ON students.id = enrollments.student_id JOIN courses ON enrollments.course_id = courses.id",
  },
  {
    topic: "joins",
    difficulty: "medium",
    table: "students, grades",
    question: "בטבלת students יש id,name ובטבלת grades יש student_id,grade. הציגו את כל הסטודנטים ואת הציון אם קיים.",
    answerSql: "SELECT students.name, grades.grade FROM students LEFT JOIN grades ON students.id = grades.student_id",
  },
  {
    topic: "joins",
    difficulty: "medium",
    table: "teachers, courses",
    question: "בטבלת teachers יש id,name ובטבלת courses יש teacher_id,course_name,credits. הציגו שם מרצה ושם קורס רק לקורסים עם לפחות 3 נקודות.",
    answerSql: "SELECT teachers.name, courses.course_name FROM teachers JOIN courses ON teachers.id = courses.teacher_id WHERE courses.credits >= 3",
  },
  {
    topic: "joins",
    difficulty: "hard",
    table: "students, enrollments, courses, grades",
    question: "הציגו שם סטודנט, שם קורס וציון באמצעות students, enrollments, courses, grades. קשרו גם לפי student_id וגם לפי course_id.",
    answerSql: "SELECT students.name, courses.course_name, grades.grade FROM students JOIN enrollments ON students.id = enrollments.student_id JOIN courses ON enrollments.course_id = courses.id JOIN grades ON students.id = grades.student_id AND courses.id = grades.course_id",
  },
  {
    topic: "joins",
    difficulty: "hard",
    table: "students, enrollments",
    question: "בטבלת students יש id,name ובטבלת enrollments יש student_id,course_id. הציגו לכל סטודנט את מספר הקורסים שלו, כולל סטודנטים ללא הרשמות.",
    answerSql: "SELECT students.name, COUNT(enrollments.course_id) FROM students LEFT JOIN enrollments ON students.id = enrollments.student_id GROUP BY students.name",
  },
  {
    topic: "joins",
    difficulty: "hard",
    table: "courses, grades",
    question: "בטבלת courses יש id,course_name ובטבלת grades יש course_id,grade. הציגו קורסים שממוצע הציונים בהם לפחות 80.",
    answerSql: "SELECT courses.course_name, AVG(grades.grade) FROM courses JOIN grades ON courses.id = grades.course_id GROUP BY courses.course_name HAVING AVG(grades.grade) >= 80",
  },
  {
    topic: "relational_algebra",
    difficulty: "easy",
    table: "students",
    question: "תרגמו ל-SQL את פעולת ההיטל: π name (students).",
    answerSql: "SELECT name FROM students",
  },
  {
    topic: "relational_algebra",
    difficulty: "easy",
    table: "students",
    question: "תרגמו ל-SQL את פעולת הבחירה: σ year=2 (students).",
    answerSql: "SELECT * FROM students WHERE year = 2",
  },
  {
    topic: "relational_algebra",
    difficulty: "easy",
    table: "students",
    question: "תרגמו ל-SQL: π name,city (σ status='active' (students)).",
    answerSql: "SELECT name, city FROM students WHERE status = 'active'",
  },
  {
    topic: "relational_algebra",
    difficulty: "medium",
    table: "students, enrollments",
    question: "תרגמו ל-SQL: π students.name,enrollments.course_id (students ⋈ students.id=enrollments.student_id enrollments).",
    answerSql: "SELECT students.name, enrollments.course_id FROM students JOIN enrollments ON students.id = enrollments.student_id",
  },
  {
    topic: "relational_algebra",
    difficulty: "medium",
    table: "students, submissions",
    question: "תרגמו ל-SQL הפרש קבוצות: מזהי סטודנטים שקיימים ב-students אך לא קיימים כ-student_id ב-submissions.",
    answerSql: "SELECT id FROM students EXCEPT SELECT student_id FROM submissions",
  },
  {
    topic: "relational_algebra",
    difficulty: "medium",
    table: "enrollments, submissions",
    question: "תרגמו ל-SQL איחוד קבוצות: מזהי סטודנטים שהופיעו בהרשמות או בהגשות.",
    answerSql: "SELECT student_id FROM enrollments UNION SELECT student_id FROM submissions",
  },
  {
    topic: "relational_algebra",
    difficulty: "hard",
    table: "students, enrollments",
    question: "תרגמו ל-SQL: π students.name (students ⋈ σ course_id='DB101' (enrollments)).",
    answerSql: "SELECT students.name FROM students JOIN enrollments ON students.id = enrollments.student_id WHERE enrollments.course_id = 'DB101'",
  },
  {
    topic: "relational_algebra",
    difficulty: "hard",
    table: "enrollments, submissions",
    question: "תרגמו ל-SQL חיתוך קבוצות: מזהי סטודנטים שמופיעים גם בהרשמות וגם בהגשות.",
    answerSql: "SELECT student_id FROM enrollments INTERSECT SELECT student_id FROM submissions",
  },
  {
    topic: "relational_algebra",
    difficulty: "hard",
    table: "students, enrollments, courses",
    question: "תרגמו ל-SQL: π students.name,courses.course_name (σ courses.credits>=3 (students ⋈ enrollments ⋈ courses)).",
    answerSql: "SELECT students.name, courses.course_name FROM students JOIN enrollments ON students.id = enrollments.student_id JOIN courses ON enrollments.course_id = courses.id WHERE courses.credits >= 3",
  },
  {
    topic: "aggregation",
    difficulty: "easy",
    table: "students",
    question: "בטבלת students ספרו כמה שורות יש בטבלה.",
    answerSql: "SELECT COUNT(*) FROM students",
  },
  {
    topic: "aggregation",
    difficulty: "easy",
    table: "grades",
    question: "בטבלת grades יש grade. חשבו ממוצע ציונים.",
    answerSql: "SELECT AVG(grade) FROM grades",
  },
  {
    topic: "aggregation",
    difficulty: "easy",
    table: "grades",
    question: "בטבלת grades יש grade. מצאו את הציון הגבוה ביותר.",
    answerSql: "SELECT MAX(grade) FROM grades",
  },
  {
    topic: "aggregation",
    difficulty: "medium",
    table: "enrollments",
    question: "בטבלת enrollments יש course_id. ספרו כמה הרשמות יש לכל קורס.",
    answerSql: "SELECT course_id, COUNT(*) FROM enrollments GROUP BY course_id",
  },
  {
    topic: "aggregation",
    difficulty: "medium",
    table: "grades",
    question: "בטבלת grades יש course_id,grade. חשבו ממוצע ציונים לכל קורס.",
    answerSql: "SELECT course_id, AVG(grade) FROM grades GROUP BY course_id",
  },
  {
    topic: "aggregation",
    difficulty: "medium",
    table: "students",
    question: "בטבלת students יש year. ספרו כמה סטודנטים יש בכל שנה.",
    answerSql: "SELECT year, COUNT(*) FROM students GROUP BY year",
  },
  {
    topic: "aggregation",
    difficulty: "hard",
    table: "grades",
    question: "בטבלת grades יש course_id,grade. הציגו קורסים שממוצע הציונים בהם לפחות 85.",
    answerSql: "SELECT course_id, AVG(grade) FROM grades GROUP BY course_id HAVING AVG(grade) >= 85",
  },
  {
    topic: "aggregation",
    difficulty: "hard",
    table: "students, enrollments",
    question: "בטבלת students יש id,year ובטבלת enrollments יש student_id,course_id. ספרו כמה הרשמות יש לכל שנת לימוד.",
    answerSql: "SELECT students.year, COUNT(enrollments.course_id) FROM students JOIN enrollments ON students.id = enrollments.student_id GROUP BY students.year",
  },
  {
    topic: "aggregation",
    difficulty: "hard",
    table: "enrollments",
    question: "בטבלת enrollments יש course_id. הציגו קורסים עם יותר מ-10 הרשמות ומיינו מהגבוה לנמוך לפי מספר הרשמות.",
    answerSql: "SELECT course_id, COUNT(*) FROM enrollments GROUP BY course_id HAVING COUNT(*) > 10 ORDER BY COUNT(*) DESC",
  },
  {
    topic: "filtering_sorting",
    difficulty: "easy",
    table: "students",
    question: "בטבלת students יש name,year. הציגו שמות סטודנטים משנה 1.",
    answerSql: "SELECT name FROM students WHERE year = 1",
  },
  {
    topic: "filtering_sorting",
    difficulty: "easy",
    table: "courses",
    question: "בטבלת courses יש course_name. הציגו שמות קורסים ממוינים לפי שם קורס.",
    answerSql: "SELECT course_name FROM courses ORDER BY course_name",
  },
  {
    topic: "filtering_sorting",
    difficulty: "easy",
    table: "grades",
    question: "בטבלת grades יש name,grade. הציגו שם וציון רק לציונים של 90 ומעלה.",
    answerSql: "SELECT name, grade FROM grades WHERE grade >= 90",
  },
  {
    topic: "filtering_sorting",
    difficulty: "medium",
    table: "students",
    question: "בטבלת students יש name,city. הציגו שמות סטודנטים מתל אביב, ממוינים לפי שם.",
    answerSql: "SELECT name FROM students WHERE city = 'Tel Aviv' ORDER BY name",
  },
  {
    topic: "filtering_sorting",
    difficulty: "medium",
    table: "courses",
    question: "בטבלת courses יש course_name,credits. הציגו שם קורס ונקודות רק לקורסים עם לפחות 3 נקודות, מהגדול לקטן.",
    answerSql: "SELECT course_name, credits FROM courses WHERE credits >= 3 ORDER BY credits DESC",
  },
  {
    topic: "filtering_sorting",
    difficulty: "medium",
    table: "students",
    question: "בטבלת students יש name,year,status. הציגו שמות סטודנטים פעילים משנה 2 או 3.",
    answerSql: "SELECT name FROM students WHERE year IN (2, 3) AND status = 'active'",
  },
  {
    topic: "filtering_sorting",
    difficulty: "hard",
    table: "grades",
    question: "בטבלת grades יש name,grade. הציגו שם וציון לציונים בין 80 ל-95, ממוינים לפי ציון יורד ואז שם.",
    answerSql: "SELECT name, grade FROM grades WHERE grade BETWEEN 80 AND 95 ORDER BY grade DESC, name",
  },
  {
    topic: "filtering_sorting",
    difficulty: "hard",
    table: "courses",
    question: "בטבלת courses יש course_name,credits,department. הציגו קורסים עם לפחות 3 נקודות שאינם במחלקה General, ממוינים לפי מחלקה ושם קורס.",
    answerSql: "SELECT course_name FROM courses WHERE credits >= 3 AND department != 'General' ORDER BY department, course_name",
  },
  {
    topic: "filtering_sorting",
    difficulty: "hard",
    table: "students",
    question: "בטבלת students יש name,email,city. הציגו שמות סטודנטים שיש להם אימייל והעיר שלהם מתחילה ב-Tel, ממוינים לפי שם.",
    answerSql: "SELECT name FROM students WHERE email IS NOT NULL AND city LIKE 'Tel%' ORDER BY name",
  },
];

const counters = new Map<string, number>();

export const SQL_COIN_CHALLENGE_BANK: BuiltInSqlCoinChallengeQuestion[] = BANK_SPECS.map((question) => {
  const key = `${question.topic}_${question.difficulty}`;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);

  return {
    ...question,
    queryId: `bank_${key}_${next}`,
    practiceId: "sql_coin_challenge_bank",
    topicLabel: getSqlCoinChallengeTopicLabel(question.topic),
    difficultyLabel: getSqlCoinChallengeDifficultyLabel(question.difficulty),
  };
});

export function selectBuiltInSqlCoinChallengeQuestions(input: {
  topic: SqlCoinChallengeTopic;
  difficulty: SqlCoinChallengeDifficulty;
  count: number;
}): BuiltInSqlCoinChallengeQuestion[] {
  return SQL_COIN_CHALLENGE_BANK.filter(
    (question) => question.topic === input.topic && question.difficulty === input.difficulty,
  ).slice(0, input.count);
}
