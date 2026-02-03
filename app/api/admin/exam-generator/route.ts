import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/app/openai";
import { extractOutputText } from "@/lib/openai/responses-client";
import { getCurrentWeekContextNormalized } from "@/lib/content";
import {
  getAllowedConceptsForWeek,
  getForbiddenConceptsForWeek,
} from "@/lib/sql-curriculum";

export const runtime = "nodejs";
export const maxDuration = 300;

const VECTOR_POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_500;

const BASE_SYSTEM_INSTRUCTIONS = `
You are Michael, an expert SQL instructor creating exams for this specific course.

CRITICAL CURRICULUM SAFETY RULES:
- NEVER provide SQL examples containing concepts from forbiddenConcepts.
- NEVER use ALTER / ALTER TABLE / DROP / DROP TABLE / VIEW / CREATE VIEW / TRIGGER / CREATE TRIGGER / INDEX / CREATE INDEX when they are forbidden by current week.
- NEVER use PRIMARY KEY / FOREIGN KEY when they are forbidden by current week.
- NEVER use CASE-WHEN.
- NEVER use RETURNING clause.
- NEVER use WITH (CTE) clauses.
- NEVER use window functions (OVER, PARTITION BY, RANK, ROW_NUMBER).

PEDAGOGICAL STYLE:
- Write in clear Hebrew.
- Keep academic tone and learning-oriented clarity.
- Produce fully original content. Source exams are for style/difficulty calibration only.

ANTI-COPY RULES (MANDATORY):
- Create a completely NEW end-to-end exam.
- Create a completely NEW scenario domain (new story, new entities, new business context).
- Do NOT reuse exact wording from uploaded exams.
- Do NOT reuse table names, column names, constants, sample values, or question phrasings from uploaded exams.
- Do NOT paraphrase one source exam. Synthesize a new exam pattern from multiple sources.
- If any section is too similar to source materials, rewrite it before returning output.

OUTPUT CONTRACT:
- Return only the final exam in markdown.
- Include exactly: Scenario section, Table Definitions section, and 10 questions.
- Questions 1-9 must be SQL questions.
- Question 10 must be relational algebra.
`;

function buildExamGenerationPrompt(
  weekNumber: number | null,
  dateRange: string | null
): string {
  const effectiveWeek = weekNumber ?? 9;
  const allowedConcepts = getAllowedConceptsForWeek(effectiveWeek);
  const forbiddenConcepts = getForbiddenConceptsForWeek(effectiveWeek);
  const weekContextLine = weekNumber
    ? `Current course week is ${weekNumber}${dateRange ? ` (${dateRange})` : ""}.`
    : "Current week is unavailable. Use conservative mode: restrict SQL to weeks 1-9 only.";

  return `
Analyze all uploaded past exam PDFs and generate one new, innovative exam in Hebrew.

${weekContextLine}

Use this cumulative curriculum policy:
- allowedConcepts: ${allowedConcepts.join(", ")}
- forbiddenConcepts: ${forbiddenConcepts.join(", ")}

Rules:
1) Keep only the structure style and difficulty profile from uploaded exams.
2) Build a brand-new exam end-to-end: new scenario, new tables, new question set.
3) Never copy or closely mirror source wording, schema names, constants, or question logic.
4) Use uploaded exams as inspiration, not as reusable content.
5) Before outputting any SQL, scan and remove forbidden keywords/concepts.
6) Run a final novelty self-check: scenario, schema and all 10 questions must be new.
7) Output only the final exam in clean markdown.
`;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVectorStoreFiles(
  vectorStoreId: string,
  vectorFileIds: string[]
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < VECTOR_POLL_TIMEOUT_MS) {
    const statuses = await Promise.all(
      vectorFileIds.map((vectorFileId) =>
        openai.vectorStores.files.retrieve(vectorStoreId, vectorFileId)
      )
    );

    const hasFailed = statuses.some((file) => file.status === "failed");
    if (hasFailed) {
      throw new Error("One or more uploaded PDFs failed processing.");
    }

    const allCompleted = statuses.every((file) => file.status === "completed");
    if (allCompleted) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out while processing uploaded PDFs.");
}

export async function POST(request: NextRequest) {
  let vectorStoreId: string | null = null;
  const uploadedFileIds: string[] = [];

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    const weekContext = await getCurrentWeekContextNormalized(null);
    const generationPrompt = buildExamGenerationPrompt(
      weekContext.weekNumber,
      weekContext.dateRange
    );

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No PDF files were uploaded." },
        { status: 400 }
      );
    }

    const hasNonPdf = files.some(
      (file) => !file.name.toLowerCase().endsWith(".pdf")
    );
    if (hasNonPdf) {
      return NextResponse.json(
        { success: false, error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 80 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Total upload size exceeds 80MB." },
        { status: 400 }
      );
    }

    const vectorStore = await openai.vectorStores.create({
      name: `exam-generator-${Date.now()}`,
    });
    vectorStoreId = vectorStore.id;

    const vectorFileIds: string[] = [];
    for (const file of files) {
      const uploadedFile = await openai.files.create({
        file,
        purpose: "assistants",
      });
      uploadedFileIds.push(uploadedFile.id);

      const vectorFile = await openai.vectorStores.files.create(vectorStoreId, {
        file_id: uploadedFile.id,
      });
      vectorFileIds.push(vectorFile.id);
    }

    await waitForVectorStoreFiles(vectorStoreId, vectorFileIds);

    const response = await (openai as any).responses.create({
      model: "gpt-4.1-mini",
      instructions: BASE_SYSTEM_INSTRUCTIONS,
      tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: generationPrompt }],
        },
      ],
    });

    const exam = extractOutputText(response);
    if (!exam) {
      throw new Error("No exam content was returned by Michael.");
    }

    return NextResponse.json({
      success: true,
      exam,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate exam.";
    console.error("Exam generation error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  } finally {
    if (vectorStoreId) {
      try {
        await openai.vectorStores.del(vectorStoreId);
      } catch (cleanupError) {
        console.warn("Failed deleting vector store:", cleanupError);
      }
    }

    if (uploadedFileIds.length > 0) {
      await Promise.all(
        uploadedFileIds.map(async (fileId) => {
          try {
            await openai.files.del(fileId);
          } catch (cleanupError) {
            console.warn(`Failed deleting file ${fileId}:`, cleanupError);
          }
        })
      );
    }
  }
}
