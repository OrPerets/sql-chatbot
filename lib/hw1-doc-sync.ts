import type { Question, QuestionParameterDefinition } from "@/app/homework/types";

export interface Hw1QuestionSyncConfig {
  prompt: string;
  instructions: string;
  expectedOutputDescription: string;
  starterSql: string;
  expectedResultSchema: Question["expectedResultSchema"];
  parameterMode: "static" | "parameterized";
  parameters?: QuestionParameterDefinition[];
}

const numberParam = (
  name: string,
  description: string,
  sourceFields: Array<"prompt" | "instructions" | "starterSql">,
  constraints: QuestionParameterDefinition["constraints"],
): QuestionParameterDefinition => ({
  id: `param-${name}`,
  name,
  type: "number",
  description,
  constraints,
  required: true,
  sourceFields,
});

const listParam = (
  name: string,
  description: string,
  sourceFields: Array<"prompt" | "instructions" | "starterSql">,
  options: string[],
): QuestionParameterDefinition => ({
  id: `param-${name}`,
  name,
  type: "list",
  description,
  constraints: { options },
  required: true,
  sourceFields,
});

export const HW1_DOC_SYNC_QUESTIONS: Hw1QuestionSyncConfig[] = [
  {
    prompt: "שאלה 1",
    instructions:
      "הציגו את השם הפרטי, שם המשפחה ושנת הלידה, עבור העובדים שנולדו בין השנים {{start_year}} ל-{{end_year}} (ללא הקצוות) והמשכורת שלהם נעה בין {{min_salary}} ל-{{max_salary}} ₪ (לא כולל קצוות).",
    expectedOutputDescription: "הפלט צריך לכלול שם פרטי, שם משפחה ושנת לידה.",
    starterSql: `SELECT first_name, last_name, birth_date
FROM employees
WHERE birth_date > {{start_year}}
  AND birth_date < {{end_year}}
  AND salary > {{min_salary}}
  AND salary < {{max_salary}};`,
    expectedResultSchema: [
      { column: "first_name", type: "string" },
      { column: "last_name", type: "string" },
      { column: "birth_date", type: "number" },
    ],
    parameterMode: "parameterized",
    parameters: [
      numberParam("start_year", "שנת התחלה לטווח הלידה", ["instructions", "starterSql"], {
        min: 1990,
        max: 2002,
        step: 1,
      }),
      numberParam("end_year", "שנת סיום לטווח הלידה", ["instructions", "starterSql"], {
        min: 2021,
        max: 2027,
        step: 1,
      }),
      numberParam("min_salary", "משכורת מינימלית", ["instructions", "starterSql"], {
        min: 5800,
        max: 7200,
        step: 10,
      }),
      numberParam("max_salary", "משכורת מקסימלית", ["instructions", "starterSql"], {
        min: 7800,
        max: 9200,
        step: 10,
      }),
    ],
  },
  {
    prompt: "שאלה 2",
    instructions:
      "הציגו את שם המשפחה והשם הפרטי של העובדים אשר גילם פחות מ-{{max_age}} ומשכורתם גדולה מ-{{eur_amount}} אירו, לפי השער היציג כיום של {{exchange_rate}} ₪ ל-1 אירו.",
    expectedOutputDescription: "הפלט צריך לכלול שם משפחה ושם פרטי של העובדים המתאימים.",
    starterSql: `SELECT last_name, first_name
FROM employees
WHERE (2025 - birth_date) < {{max_age}}
  AND (salary / {{exchange_rate}}) > {{eur_amount}};`,
    expectedResultSchema: [
      { column: "last_name", type: "string" },
      { column: "first_name", type: "string" },
    ],
    parameterMode: "parameterized",
    parameters: [
      numberParam("max_age", "גיל מקסימלי", ["instructions", "starterSql"], {
        min: 20,
        max: 30,
        step: 1,
      }),
      numberParam("eur_amount", "סכום מינימלי באירו", ["instructions", "starterSql"], {
        min: 1800,
        max: 2600,
        step: 10,
      }),
      numberParam("exchange_rate", "שער אירו לשקל", ["instructions", "starterSql"], {
        min: 3.5,
        max: 4.2,
        step: 0.01,
      }),
    ],
  },
  {
    prompt: "שאלה 3",
    instructions:
      "לאור המצב בארץ, הוחלט שכל מי שעובד בתפקיד פקידותי (clerk) בישראל, יקבל העלאה, לאור כך נרצה לבדוק מה תהיה המשכורת לאחר תוספת של {{increase_percent}}%. עליכם להציג בתוצאה שם משפחה, שם פרטי, השכר לפני התוספת והשכר החדש לאחר התוספת.",
    expectedOutputDescription: "הפלט צריך לכלול שם משפחה, שם פרטי, שכר קודם ושכר חדש לאחר התוספת.",
    starterSql: `SELECT e.last_name,
       e.first_name,
       e.salary AS old_salary,
       e.salary * (1 + ({{increase_percent}} / 100.0)) AS new_salary
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
    parameterMode: "parameterized",
    parameters: [
      numberParam("increase_percent", "אחוז התוספת לשכר", ["instructions", "starterSql"], {
        min: 5,
        max: 20,
        step: 0.5,
      }),
    ],
  },
  {
    prompt: "שאלה 4",
    instructions:
      'הציגו את מס\' ת.ז של העובדים שעובדים בעיר ששמה מכיל בדיוק {{city_length}} תווים ושהמדינה בה הם עובדים מכילה אות "{{include_letter}}" אך לא מכילה את אות "{{exclude_letter}}". יש למיין את רשימת העובדים לפי תעודת הזהות של העובד בסדר יורד.',
    expectedOutputDescription: "הפלט צריך לכלול את מזהה העובד בלבד, במיון יורד.",
    starterSql: `SELECT e.employee_id
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE l.city LIKE REPEAT('_', {{city_length}})
  AND LOWER(l.country) LIKE CONCAT('%', LOWER('{{include_letter}}'), '%')
  AND LOWER(l.country) NOT LIKE CONCAT('%', LOWER('{{exclude_letter}}'), '%')
ORDER BY e.employee_id DESC;`,
    expectedResultSchema: [{ column: "employee_id", type: "string" }],
    parameterMode: "parameterized",
    parameters: [
      numberParam("city_length", "אורך מדויק של שם העיר", ["instructions", "starterSql"], {
        min: 4,
        max: 8,
        step: 1,
      }),
      listParam("include_letter", "אות שחייבת להופיע בשם המדינה", ["instructions", "starterSql"], [
        "a",
        "i",
        "o",
        "r",
      ]),
      listParam("exclude_letter", "אות שאסור שתופיע בשם המדינה", ["instructions", "starterSql"], [
        "e",
        "u",
        "y",
      ]),
    ],
  },
  {
    prompt: "שאלה 5",
    instructions:
      'הציגו את ת.ז. של העובד, קוד העבודה, שם המחלקה והמשכורת רק עבור העובדים שמשכורתם היא לפחות {{min_salary}} ₪ וששם המשפחה שלהם מכיל את האות "{{last_name_letter}}" וששם המחלקה בה הם עובדים, לא מכיל את האות "{{excluded_department_letter}}". עליכם לדאוג למיין את התוצאה לפי משכורת בסדר עולה.',
    expectedOutputDescription: "הפלט צריך לכלול מזהה עובד, קוד עבודה, שם מחלקה ומשכורת.",
    starterSql: `SELECT e.employee_id,
       e.job_id,
       d.department_name,
       e.salary
FROM employees e
JOIN departments d ON e.department_id = d.department_id
WHERE e.salary >= {{min_salary}}
  AND UPPER(e.last_name) LIKE CONCAT('%', UPPER('{{last_name_letter}}'), '%')
  AND UPPER(d.department_name) NOT LIKE CONCAT('%', UPPER('{{excluded_department_letter}}'), '%')
ORDER BY e.salary ASC;`,
    expectedResultSchema: [
      { column: "employee_id", type: "string" },
      { column: "job_id", type: "string" },
      { column: "department_name", type: "string" },
      { column: "salary", type: "number" },
    ],
    parameterMode: "parameterized",
    parameters: [
      numberParam("min_salary", "משכורת סף מינימלית", ["instructions", "starterSql"], {
        min: 9000,
        max: 11000,
        step: 1,
      }),
      listParam("last_name_letter", "אות שחייבת להופיע בשם המשפחה", ["instructions", "starterSql"], [
        "M",
        "A",
        "R",
        "S",
      ]),
      listParam(
        "excluded_department_letter",
        "אות שאסור שתופיע בשם המחלקה",
        ["instructions", "starterSql"],
        ["D", "E", "R"],
      ),
    ],
  },
  {
    prompt: "שאלה 6",
    instructions:
      'לגבי העובדים הבאים הציגו את ת.ז. של העובד ואת הגיל שלו רק עבור העובדים שעובדים ברחוב שמכיל את האות "{{street_letter}}". יש לסדר את העובדים לפי גיל בסדר יורד (מיון ראשי) ובמידה וקיימים כמה עובדים עם גיל זהה, יש לסדר אותם לפי תאריך תחילת העסקה בסדר עולה (מיון משני).',
    expectedOutputDescription: "הפלט צריך לכלול את מזהה העובד ואת הגיל שלו עם מיון דו-שלבי.",
    starterSql: `SELECT e.employee_id,
       2025 - e.birth_date AS age
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE LOWER(l.street) LIKE CONCAT('%', LOWER('{{street_letter}}'), '%')
ORDER BY age DESC, e.hire_date ASC;`,
    expectedResultSchema: [
      { column: "employee_id", type: "string" },
      { column: "age", type: "number" },
    ],
    parameterMode: "parameterized",
    parameters: [
      listParam("street_letter", "אות שחייבת להופיע בשם הרחוב", ["instructions", "starterSql"], [
        "a",
        "e",
        "r",
        "n",
      ]),
    ],
  },
  {
    prompt: "שאלה 7",
    instructions:
      "עבור כל תחום עיסוק בטבלת JOBS, הציגו את קטגורית התפקיד ואת השכר הממוצע לאותו תפקיד בדולרים לפי שער של {{exchange_rate}} ₪ (סכמת היחס תהיה: job_title, average_of_salary_in_dollars).",
    expectedOutputDescription: "הפלט צריך לכלול את שם התפקיד ואת השכר הממוצע בדולרים.",
    starterSql: `SELECT job_title,
       ((min_salary + max_salary) / 2) / {{exchange_rate}} AS average_of_salary_in_dollars
FROM jobs;`,
    expectedResultSchema: [
      { column: "job_title", type: "string" },
      { column: "average_of_salary_in_dollars", type: "number" },
    ],
    parameterMode: "parameterized",
    parameters: [
      numberParam("exchange_rate", "שער דולר לשקל", ["instructions", "starterSql"], {
        min: 3.0,
        max: 3.8,
        step: 0.01,
      }),
    ],
  },
  {
    prompt: "שאלה 8",
    instructions:
      "הציגו את שם משפחה, שם פרטי ותיאור התפקיד של העובדים שעובדים בטוקיו. יש למיין את התוצאה לפי משכורת בסדר עולה ואם קיימים מספר עובדים עם משכורת זהה, אז יש לסדר אותם לפי תאריך תחילת העסקה בסדר יורד.",
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
    parameterMode: "static",
    parameters: [],
  },
  {
    prompt: "שאלה 9",
    instructions:
      "עבור המחלקה שמכילה 3 פעמים לפחות את האות e בשם המחלקה (לא בהכרח ברצף), יש להציג את כל פרטי העובדים (כל העמודות מטבלת עובדים) שעובדים במחלקה זו מלבד אלו שהם מהנדסים.",
    expectedOutputDescription: "הפלט צריך לכלול את כל עמודות העובד עבור עובדים מתאימים.",
    starterSql: `SELECT e.*
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN jobs j ON e.job_id = j.job_id
WHERE LOWER(d.department_name) LIKE '%e%e%e%'
  AND LOWER(j.job_title) <> 'engineer';`,
    expectedResultSchema: [],
    parameterMode: "static",
    parameters: [],
  },
  {
    prompt: "שאלה 10",
    instructions:
      'הציגו את שמות המשפחה של העובדים ששם המשפחה שלהם מתחיל באות "A" או ששמם הפרטי מסתיים באות "A" ובנוסף ששם העיר בה הם עובדים מכילה "-" (מקף אמצעי) או ששם הרחוב בו הם עובדים מכיל "-" (מקף אמצעי).',
    expectedOutputDescription: "הפלט צריך לכלול שמות משפחה בלבד.",
    starterSql: `SELECT e.last_name
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
WHERE (UPPER(e.last_name) LIKE 'A%' OR UPPER(e.first_name) LIKE '%A')
  AND (l.city LIKE '%-%' OR l.street LIKE '%-%');`,
    expectedResultSchema: [{ column: "last_name", type: "string" }],
    parameterMode: "static",
    parameters: [],
  },
];
