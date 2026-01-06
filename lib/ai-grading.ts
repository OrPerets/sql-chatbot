import OpenAI from 'openai'

/**
 * AI-powered grading service for SQL homework submissions
 * Uses OpenAI to evaluate student SQL queries against reference solutions
 */

export interface AIGradingInput {
  questionId: string
  questionPrompt: string
  questionInstructions: string
  referenceSql: string | undefined  // starterSql field contains the reference solution
  expectedSchema: Array<{ column: string; type: string }>
  maxPoints: number
  rubricCriteria: Array<{ id: string; label: string; description: string; weight: number }>
  studentSql: string
  studentResults: {
    columns: string[]
    rows: Array<Record<string, unknown>>
  } | undefined
}

export interface AIGradingResult {
  questionId: string
  score: number           // Suggested score (0 to maxPoints)
  comment: string         // Short, precise Hebrew comment
  confidence: number      // 0-100 confidence level
  breakdown: {
    queryCorrectness: number   // Percentage for SQL structure (0-100)
    outputCorrectness: number  // Percentage for correct results (0-100)
  }
}

export interface BulkGradingResult {
  submissionId: string
  studentId: string
  results: AIGradingResult[]
  totalScore: number
  gradedAt: string
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Evaluate a single student SQL answer using AI
 */
export async function evaluateAnswer(input: AIGradingInput): Promise<AIGradingResult> {
  const prompt = buildEvaluationPrompt(input)
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `אתה מעריך מומחה לשאילתות SQL בקורס בסיסי נתונים. 
התפקיד שלך הוא להעריך תשובות של סטודנטים ולתת ציון והערה קצרה וברורה.

כללים חשובים:
1. הערות בעברית בלבד
2. הערה קצרה ותמציתית (2-3 משפטים מקסימום)
3. ציין במדויק מה נכון ומה חסר/שגוי
4. השתמש בטון חינוכי ומעודד
5. התייחס גם לנכונות השאילתה וגם לתוצאות

פורמט התשובה חייב להיות JSON תקין בלבד, ללא טקסט נוסף.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(content)
    
    return {
      questionId: input.questionId,
      score: Math.min(input.maxPoints, Math.max(0, parsed.score ?? 0)),
      comment: parsed.comment ?? 'לא ניתן לבצע הערכה',
      confidence: parsed.confidence ?? 50,
      breakdown: {
        queryCorrectness: parsed.queryCorrectness ?? 0,
        outputCorrectness: parsed.outputCorrectness ?? 0
      }
    }
  } catch (error) {
    console.error('AI grading error:', error)
    return {
      questionId: input.questionId,
      score: 0,
      comment: 'שגיאה בהערכה אוטומטית - נדרשת בדיקה ידנית',
      confidence: 0,
      breakdown: {
        queryCorrectness: 0,
        outputCorrectness: 0
      }
    }
  }
}

/**
 * Build the evaluation prompt for OpenAI
 */
function buildEvaluationPrompt(input: AIGradingInput): string {
  const {
    questionPrompt,
    questionInstructions,
    referenceSql,
    expectedSchema,
    maxPoints,
    rubricCriteria,
    studentSql,
    studentResults
  } = input

  let prompt = `בדוק את התשובה של הסטודנט לשאלת SQL הבאה:

## השאלה
${questionPrompt}

## הנחיות
${questionInstructions}

## סכמת תוצאה צפויה
${expectedSchema.map(col => `- ${col.column} (${col.type})`).join('\n')}

## ניקוד מקסימלי
${maxPoints} נקודות
`

  if (rubricCriteria.length > 0) {
    prompt += `
## קריטריונים להערכה
${rubricCriteria.map(c => `- ${c.label}: ${c.description} (משקל: ${c.weight})`).join('\n')}
`
  }

  if (referenceSql) {
    prompt += `
## פתרון ייחוס (SQL נכון)
\`\`\`sql
${referenceSql}
\`\`\`
`
  }

  prompt += `
## תשובת הסטודנט
\`\`\`sql
${studentSql || '(לא הוגשה תשובה)'}
\`\`\`
`

  if (studentResults && studentResults.rows && studentResults.rows.length > 0) {
    const previewRows = studentResults.rows.slice(0, 5)
    prompt += `
## תוצאות השאילתה של הסטודנט
עמודות: ${studentResults.columns.join(', ')}
${previewRows.length} שורות ראשונות:
${JSON.stringify(previewRows, null, 2)}
${studentResults.rows.length > 5 ? `... (סה"כ ${studentResults.rows.length} שורות)` : ''}
`
  } else {
    prompt += `
## תוצאות השאילתה של הסטודנט
(אין תוצאות זמינות או השאילתה לא הורצה)
`
  }

  prompt += `
## הנחיות להערכה
1. השווה את השאילתה של הסטודנט לפתרון הייחוס (אם קיים)
2. בדוק אם התוצאות תואמות לסכמה הצפויה
3. שים לב ל: JOIN נכון, תנאי WHERE, GROUP BY, ORDER BY, פונקציות אגרגציה
4. תן ציון הוגן בהתאם למה שנכון ומה חסר

החזר תשובה בפורמט JSON הבא בלבד:
{
  "score": <ציון מ-0 עד ${maxPoints}>,
  "comment": "<הערה קצרה בעברית - מקסימום 2-3 משפטים>",
  "confidence": <רמת ביטחון 0-100>,
  "queryCorrectness": <אחוז נכונות השאילתה 0-100>,
  "outputCorrectness": <אחוז נכונות התוצאות 0-100>
}`

  return prompt
}

/**
 * Evaluate multiple answers for a single submission
 */
export async function evaluateSubmission(
  submissionId: string,
  studentId: string,
  answers: AIGradingInput[]
): Promise<BulkGradingResult> {
  const results: AIGradingResult[] = []
  
  // Process answers sequentially to avoid rate limiting
  for (const answer of answers) {
    const result = await evaluateAnswer(answer)
    results.push(result)
  }

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)

  return {
    submissionId,
    studentId,
    results,
    totalScore,
    gradedAt: new Date().toISOString()
  }
}

/**
 * Evaluate all submissions for a homework set (bulk grading)
 */
export async function evaluateBulk(
  submissions: Array<{
    submissionId: string
    studentId: string
    answers: AIGradingInput[]
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<BulkGradingResult[]> {
  const results: BulkGradingResult[] = []
  const total = submissions.length

  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i]
    const result = await evaluateSubmission(
      submission.submissionId,
      submission.studentId,
      submission.answers
    )
    results.push(result)
    
    if (onProgress) {
      onProgress(i + 1, total)
    }
  }

  return results
}

/**
 * AI Solution Generation Interfaces
 */
export interface AISolutionInput {
  questionId: string
  questionPrompt: string
  questionInstructions: string
  expectedSchema: Array<{ column: string; type: string }>
  databaseSchema?: string  // The database schema/tables available for this homework
}

export interface AISolutionResult {
  questionId: string
  sql: string
  explanation?: string
}

/**
 * Generate SQL solution for a single question using AI
 */
export async function generateSolution(input: AISolutionInput): Promise<AISolutionResult> {
  const prompt = buildSolutionPrompt(input)
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `אתה מומחה SQL בקורס מבוא לבסיסי נתונים. 
התפקיד שלך הוא ליצור פתרונות SQL נכונים ומדויקים לשאלות, תוך שימוש אך ורק בפקודות SQL בסיסיות שנלמדו בקורס.

## פקודות SQL מותרות בלבד:
- SELECT, FROM, WHERE, JOIN (INNER, LEFT, RIGHT), ON
- GROUP BY, HAVING, ORDER BY (ASC, DESC)
- Aggregate functions: COUNT, SUM, AVG, MIN, MAX
- DISTINCT, AS (aliases)
- AND, OR, NOT, IN, BETWEEN, LIKE
- IS NULL, IS NOT NULL
- Sub-queries (nested SELECT statements)
- Comparison: =, <>, <, >, <=, >=
- Basic string functions: CONCAT, UPPER, LOWER, SUBSTRING, LENGTH
- Basic date functions: YEAR, MONTH, DAY, DATEADD, DATEDIFF (NO WEEK function - calculate weeks as days*7)
- UNION, UNION ALL
- UPDATE, SET (for update questions)
- TOP / LIMIT (only if NOT explicitly forbidden in the question)

## פקודות SQL אסורות - לא להשתמש בהן בשום מקרה:
- ❌ WITH clauses (CTE - Common Table Expressions)
- ❌ CASE-WHEN statements
- ❌ RETURNING clause
- ❌ OVER, PARTITION BY (Window Functions)
- ❌ RANK, ROW_NUMBER, DENSE_RANK
- ❌ PIVOT, UNPIVOT
- ❌ MERGE statements
- ❌ COALESCE, NULLIF, IIF (use sub-queries instead)
- ❌ STRING_AGG, GROUP_CONCAT
- ❌ ANY, ALL operators
- ❌ WEEK() function - use DATEDIFF with days and multiply by 7 instead (e.g., DATEDIFF(DAY, date, GETDATE()) <= 77 for 11 weeks)

## כללים חשובים:
1. הפתרון חייב להיות SQL תקין ופועל
2. הפתרון צריך לענות בדיוק על הדרישות בשאלה
3. השתמש אך ורק בטבלאות שצוינו בסכמת מסד הנתונים
4. ודא שהתוצאות תואמות לסכמה הצפויה
5. קרא בעיון את ההנחיות - אם כתוב "אין להשתמש ב-LIMIT/TOP" אל תשתמש בהם!
6. העדף פתרונות עם JOINs ו-sub-queries על פני פתרונות מורכבים
7. השתמש בשמות טבלאות ועמודות בדיוק כפי שמופיעים בסכמה

פורמט התשובה חייב להיות JSON תקין בלבד, ללא טקסט נוסף.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(content)
    
    return {
      questionId: input.questionId,
      sql: parsed.sql || '',
      explanation: parsed.explanation
    }
  } catch (error) {
    console.error('AI solution generation error:', error)
    return {
      questionId: input.questionId,
      sql: '',
      explanation: 'שגיאה ביצירת פתרון - נדרש פתרון ידני'
    }
  }
}

/**
 * Build the solution generation prompt for OpenAI
 */
function buildSolutionPrompt(input: AISolutionInput): string {
  const {
    questionPrompt,
    questionInstructions,
    expectedSchema,
    databaseSchema
  } = input

  let prompt = `צור פתרון SQL לשאלה הבאה:`

  // Add database schema if provided
  if (databaseSchema) {
    prompt += `

## סכמת מסד הנתונים (הטבלאות הזמינות)
${databaseSchema}

⚠️ חשוב: השתמש אך ורק בטבלאות ועמודות המופיעות למעלה!`
  }

  prompt += `

## השאלה
${questionPrompt}

## הנחיות
${questionInstructions || '(אין הנחיות נוספות)'}
`

  if (expectedSchema && expectedSchema.length > 0) {
    prompt += `
## סכמת תוצאה צפויה (העמודות שצריכות להופיע בפלט)
${expectedSchema.map(col => `- ${col.column} (${col.type})`).join('\n')}
`
  }

  prompt += `
## הנחיות ליצירת הפתרון
1. צור שאילתת SQL תקינה ופועלת
2. ודא שהשאילתה עונה בדיוק על הדרישות בשאלה
3. השתמש אך ורק בטבלאות ועמודות מהסכמה שסופקה למעלה
4. ודא שהעמודות והתוצאות תואמות לסכמה הצפויה
5. קרא בעיון את ההנחיות - אם כתוב "אין להשתמש ב-LIMIT/TOP" אל תשתמש בהם!
6. השתמש ב-JOINs ו-sub-queries בלבד
7. ❌ אסור: WITH (CTE), CASE-WHEN, RETURNING, Window Functions, WEEK()
8. ✅ מותר: SELECT, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, Aggregates, Sub-queries
9. לחישוב שבועות: השתמש ב-DATEDIFF עם ימים (לדוגמה: 11 שבועות = 77 ימים)

החזר תשובה בפורמט JSON הבא בלבד:
{
  "sql": "<השאילתה SQL המלאה>",
  "explanation": "<הסבר קצר בעברית על הפתרון (אופציונלי)>"
}`

  return prompt
}

/**
 * Generate solutions for multiple questions
 */
export async function generateSolutionsBulk(
  questions: AISolutionInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<AISolutionResult[]> {
  const results: AISolutionResult[] = []
  const total = questions.length

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    const result = await generateSolution(question)
    results.push(result)
    
    if (onProgress) {
      onProgress(i + 1, total)
    }
  }

  return results
}
