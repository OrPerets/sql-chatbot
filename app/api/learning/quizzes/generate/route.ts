import { readFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentModel } from '@/app/assistant-config';
import { LEARNING_PDFS } from '@/lib/learning-content';
import {
  createLearningQuiz,
  getLatestLearningQuiz,
  LearningQuiz,
  LearningQuizQuestion,
  LearningQuizTargetType,
} from '@/lib/learning-quizzes';
import { getAllowedConceptsForWeek, SQL_CURRICULUM_MAP } from '@/lib/sql-curriculum';
import { requireAuthenticatedUser } from '@/lib/request-auth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const dynamic = 'force-dynamic';

const MAX_TEXT_CHARS = 9000;

let cachedPdfParser:
  | ((buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>)
  | null = null;

const loadPdfParser = async () => {
  if (cachedPdfParser) {
    return cachedPdfParser;
  }

  const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
  cachedPdfParser = pdfModule.default;
  return cachedPdfParser;
};

const extractPdfText = async (buffer: Buffer) => {
  const pdf = await loadPdfParser();
  const parsed = await pdf(buffer);
  return parsed.text.trim();
};

const resolvePdfPath = (filename: string) =>
  path.join(process.cwd(), 'docs', 'pdfs', filename);

const isValidTargetType = (
  value: string | null
): value is LearningQuizTargetType => value === 'lecture' || value === 'practice';

const coerceQuestions = (questions: any[]): LearningQuizQuestion[] => {
  const validQuestions: LearningQuizQuestion[] = [];

  questions.forEach((question) => {
    if (!question || typeof question !== 'object' || typeof question.type !== 'string') {
      return;
    }

    if (question.type === 'mcq') {
      if (
        typeof question.prompt !== 'string' ||
        !Array.isArray(question.choices) ||
        question.choices.length < 2 ||
        typeof question.correctIndex !== 'number'
      ) {
        return;
      }

      const correctIndex = Math.max(0, Math.min(question.correctIndex, question.choices.length - 1));

      validQuestions.push({
        id: randomUUID(),
        type: 'mcq',
        prompt: question.prompt.trim(),
        choices: question.choices.map((choice: string) => String(choice)),
        correctIndex,
        hint: typeof question.hint === 'string' ? question.hint.trim() : undefined,
        explanation:
          typeof question.explanation === 'string' ? question.explanation.trim() : undefined,
      });
      return;
    }

    if (question.type === 'sql') {
      if (typeof question.prompt !== 'string') {
        return;
      }

      validQuestions.push({
        id: randomUUID(),
        type: 'sql',
        prompt: question.prompt.trim(),
        starterSql: typeof question.starterSql === 'string' ? question.starterSql.trim() : undefined,
        expectedSql:
          typeof question.expectedSql === 'string' ? question.expectedSql.trim() : undefined,
        expectedResult:
          question.expectedResult && typeof question.expectedResult === 'object'
            ? {
                columns: Array.isArray(question.expectedResult.columns)
                  ? question.expectedResult.columns.map((column: string) => String(column))
                  : [],
                rows: Array.isArray(question.expectedResult.rows)
                  ? question.expectedResult.rows.map((row: any[]) => row.map((cell) => String(cell)))
                  : [],
              }
            : undefined,
        hint: typeof question.hint === 'string' ? question.hint.trim() : undefined,
        explanation:
          typeof question.explanation === 'string' ? question.explanation.trim() : undefined,
      });
    }
  });

  return validQuestions;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const targetType = body.targetType as LearningQuizTargetType;
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
    const force = Boolean(body.force);

    if (!userId || !targetId || !isValidTargetType(targetType)) {
      return NextResponse.json(
        { error: 'userId, targetType, and targetId are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    if (!force) {
      const existingQuiz = await getLatestLearningQuiz(targetType, targetId);
      if (existingQuiz) {
        return NextResponse.json({ quiz: existingQuiz, cached: true });
      }
    }

    const asset = LEARNING_PDFS.find((item) => item.id === targetId);
    if (!asset) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(resolvePdfPath(asset.filename));
    const pdfText = await extractPdfText(fileBuffer);
    const trimmedText = pdfText.slice(0, MAX_TEXT_CHARS);

    const concepts =
      SQL_CURRICULUM_MAP[asset.week]?.concepts ?? getAllowedConceptsForWeek(asset.week);

    const response = await openai.chat.completions.create({
      model: getCurrentModel(),
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'אתם מייקל, עוזר הוראה מומחה ל-SQL. החזירו JSON בלבד, ללא טקסט נוסף.',
        },
        {
          role: 'user',
          content: `צרו חידון קצר (3-5 שאלות) עבור המסמך הבא.\n\nחוקים:\n- החזירו JSON בלבד בפורמט: {"title": string, "questions": array}.\n- כל שאלה היא אובייקט עם type: "mcq" או "sql".\n- עבור mcq: כללו prompt, choices (array), correctIndex (מספר), hint, explanation.\n- עבור sql: כללו prompt, starterSql (אופציונלי), expectedSql (שאילתה נכונה להשוואה), hint, explanation.\n- שמרו על עברית מקצועית וברורה, מותר להשאיר מונחי SQL באנגלית.\n- נסו לשלב לפחות שאלה אחת מסוג SQL ושתי שאלות MCQ.\n\nמידע על המסמך:\nשם: ${asset.label}\nשבוע: ${asset.week}\nנושאים מרכזיים: ${concepts.join(', ') || 'לא צוינו'}\n\nתוכן PDF (מקוצר):\n${trimmedText}`,
        },
      ],
    });

    const rawPayload = response.choices[0]?.message?.content ?? '';
    const parsedPayload = JSON.parse(rawPayload);

    if (!parsedPayload || typeof parsedPayload.title !== 'string') {
      return NextResponse.json({ error: 'Invalid quiz payload' }, { status: 502 });
    }

    const questions = coerceQuestions(
      Array.isArray(parsedPayload.questions) ? parsedPayload.questions : []
    );

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No quiz questions returned' }, { status: 502 });
    }

    const now = new Date();
    const quiz: LearningQuiz = {
      quizId: randomUUID(),
      targetType,
      targetId,
      title: parsedPayload.title.trim() || `חידון ${asset.label}`,
      createdBy: 'michael',
      questions,
      createdAt: now,
      updatedAt: now,
    };

    const savedQuiz = await createLearningQuiz(quiz);
    return NextResponse.json({ quiz: savedQuiz, cached: false });
  } catch (error: any) {
    console.error('Failed to generate learning quiz:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
