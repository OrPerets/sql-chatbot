import { readFile } from 'fs/promises';
import path from 'path';

import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentModel } from '@/app/assistant-config';
import { LEARNING_PDFS } from '@/lib/learning-content';
import {
  LearningSummaryMode,
  upsertLearningSummary,
} from '@/lib/learning-summaries';
import { requireAuthenticatedUser } from '@/lib/request-auth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TEXT_CHARS = 12000;

let cachedPdfParser:
  | ((buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>)
  | null = null;

const isValidSummaryMode = (value: string | null): value is LearningSummaryMode =>
  value === 'full' || value === 'highlights';

type PageRangeInput = {
  start?: number;
  end?: number;
};

const resolvePdfPath = (filename: string) =>
  path.join(process.cwd(), 'docs', 'pdfs', filename);

const normalizePageRange = (range?: PageRangeInput, pageCount?: number) => {
  if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') {
    return null;
  }

  let start = Math.floor(range.start);
  let end = Math.floor(range.end);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  if (start < 1 || end < 1) {
    return null;
  }

  if (pageCount && pageCount > 0) {
    start = Math.min(start, pageCount);
    end = Math.min(end, pageCount);
  }

  if (end < start) {
    return null;
  }

  return { start, end };
};

const loadPdfParser = async () => {
  if (cachedPdfParser) {
    return cachedPdfParser;
  }

  const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
  cachedPdfParser = pdfModule.default;
  return cachedPdfParser;
};

const extractPdfText = async (buffer: Buffer, pageRange?: PageRangeInput) => {
  const pageTexts: string[] = [];
  const pdf = await loadPdfParser();

  const parsed = await pdf(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items
        .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .trim();

      pageTexts.push(pageText);
      return pageText;
    },
  });

  const pageCount = pageTexts.length || parsed.numpages || 0;
  const normalizedRange = normalizePageRange(pageRange, pageCount || undefined);

  if (normalizedRange && pageTexts.length > 0) {
    const text = pageTexts
      .slice(normalizedRange.start - 1, normalizedRange.end)
      .join('\n\n')
      .trim();
    return { text, pageRange: normalizedRange, pageCount };
  }

  return { text: parsed.text.trim(), pageRange: null, pageCount };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const pdfId = typeof body.pdfId === 'string' ? body.pdfId.trim() : '';
    const summaryMode = isValidSummaryMode(body.summaryMode)
      ? body.summaryMode
      : null;
    const pageRange = typeof body.pageRange === 'object' ? body.pageRange : undefined;

    if (!userId || !pdfId || !summaryMode) {
      return NextResponse.json(
        { error: 'userId, pdfId, and summaryMode are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const asset = LEARNING_PDFS.find((item) => item.id === pdfId);
    if (!asset) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(resolvePdfPath(asset.filename));
    const { text, pageRange: resolvedRange, pageCount } = await extractPdfText(
      fileBuffer,
      pageRange
    );

    if (!text) {
      return NextResponse.json({ error: 'Failed to extract PDF text' }, { status: 422 });
    }

    const truncated = text.length > MAX_TEXT_CHARS;
    const textForPrompt = truncated ? text.slice(0, MAX_TEXT_CHARS) : text;

    const summaryInstruction =
      summaryMode === 'full'
        ? 'כתבו סיכום מלא של המסמך ב-2 עד 4 פסקאות, עם דגש על מושגי SQL מרכזיים והסברים קצרים.'
        : 'החזירו Highlights כ-5 עד 8 נקודות תמציתיות בבולטים, עם מונחים מרכזיים באנגלית אם צריך.';

    const response = await openai.chat.completions.create({
      model: getCurrentModel(),
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'אתם מייקל, עוזר הוראה מומחה ל-SQL. ענו בעברית מקצועית וברורה, ללא אזכורים טכניים על המודל.',
        },
        {
          role: 'user',
          content: `אנא סכמו את ה-PDF הבא בהתאם להנחיות.\n\nמסמך: ${asset.label} (שבוע ${asset.week})\nמצב סיכום: ${summaryMode}\nעמודים: ${resolvedRange ? `${resolvedRange.start}-${resolvedRange.end}` : 'כל המסמך'}\n\n${summaryInstruction}\n\nתוכן ה-PDF (ייתכן קיצור באורך):\n${textForPrompt}`,
        },
      ],
    });

    const summaryText = response.choices[0]?.message?.content?.trim();

    if (!summaryText) {
      return NextResponse.json({ error: 'No summary returned' }, { status: 502 });
    }

    const summary = await upsertLearningSummary(
      userId,
      pdfId,
      summaryMode,
      summaryText,
      resolvedRange ?? undefined
    );

    return NextResponse.json({
      summary,
      meta: {
        truncated,
        pageCount,
        maxChars: MAX_TEXT_CHARS,
      },
    });
  } catch (error: any) {
    console.error('Failed to summarize PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to summarize PDF' },
      { status: 500 }
    );
  }
}
