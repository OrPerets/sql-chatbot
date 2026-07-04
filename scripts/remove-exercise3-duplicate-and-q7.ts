#!/usr/bin/env ts-node

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { config } from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

type QuestionDoc = {
  _id?: ObjectId;
  id?: string;
  homeworkSetId?: string;
  prompt?: string;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
};

type HomeworkSetDoc = {
  _id?: ObjectId;
  id?: string;
  title?: string;
  questionOrder?: string[];
  updatedAt?: string;
};

type Options = {
  title: string;
  outputDir: string;
  execute: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    title: "תרגיל בית 3",
    outputDir: path.resolve(process.cwd(), "exports", "homework-question-cleanup"),
    execute: false,
  };

  for (const arg of argv) {
    if (arg === "--execute") {
      options.execute = true;
    } else if (arg.startsWith("--title=")) {
      options.title = arg.slice("--title=".length);
    } else if (arg.startsWith("--outDir=")) {
      options.outputDir = path.resolve(process.cwd(), arg.slice("--outDir=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function serializeForArchive(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof ObjectId) return { $oid: value.toHexString() };
  if (Array.isArray(value)) return value.map(serializeForArchive);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, serializeForArchive(nested)]),
    );
  }
  return value;
}

function questionKey(question: QuestionDoc): string {
  const key = question.id || question._id?.toString();
  if (!key) {
    throw new Error("Refusing to process question without id or _id");
  }
  return key;
}

function compactText(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function promptFingerprint(value: string | undefined): string {
  return compactText(value).replace(/[."'״׳`]/g, "");
}

function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function findHomeworkSet(db: ReturnType<MongoClient["db"]>, title: string) {
  const titleCandidates = Array.from(new Set([title, "תרגיל בית 3", "תרגיל 3"]));
  const matches = await db
    .collection<HomeworkSetDoc>("homework_sets")
    .find({ title: { $in: titleCandidates } })
    .sort({ updatedAt: -1 })
    .toArray();

  const selected = matches.find((item) => item.title === title) ?? matches[0];
  if (!selected) {
    throw new Error(`Homework set not found for title: ${title}`);
  }

  return selected;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "experiment";

  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  await client.connect();

  try {
    const db = client.db(dbName);
    const homeworkSet = await findHomeworkSet(db, options.title);
    const aliases = Array.from(new Set([homeworkSet._id?.toString(), homeworkSet.id].filter(Boolean)));

    if (!homeworkSet._id) {
      throw new Error("Homework set is missing _id");
    }
    if (aliases.length === 0) {
      throw new Error("Homework set has no usable aliases");
    }

    const rawQuestions = await db
      .collection<QuestionDoc>("questions")
      .find({ homeworkSetId: { $in: aliases } })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    const order = homeworkSet.questionOrder || [];
    const orderedQuestions = [...rawQuestions].sort((a, b) => {
      const aIndex = order.indexOf(questionKey(a));
      const bIndex = order.indexOf(questionKey(b));
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id));
    });

    console.log(`Homework set: ${homeworkSet.title} (${homeworkSet._id.toString()})`);
    console.log(`Aliases: ${aliases.join(", ")}`);
    console.log(`Question count before: ${orderedQuestions.length}`);
    orderedQuestions.forEach((question, index) => {
      console.log(`${index + 1}. ${questionKey(question)} | ${compactText(question.prompt).slice(0, 120)}`);
    });

    if (orderedQuestions.length !== 14) {
      throw new Error(`Expected 14 questions before cleanup, found ${orderedQuestions.length}`);
    }

    const question5 = orderedQuestions[4];
    const question7 = orderedQuestions[6];
    const question8 = orderedQuestions[7];

    if (!question5 || !question7 || !question8) {
      throw new Error("Could not resolve questions 5, 7, and 8 from the ordered list");
    }

    if (promptFingerprint(question5.prompt) !== promptFingerprint(question8.prompt)) {
      throw new Error(
        `Refusing to delete question 8: question 5 and question 8 prompts are not identical.\n` +
          `Q5: ${compactText(question5.prompt)}\nQ8: ${compactText(question8.prompt)}`,
      );
    }

    const questionsToRemove = [
      { displayedNumber: 7, reason: "unclear question requested for deletion", question: question7 },
      { displayedNumber: 8, reason: "duplicate of question 5", question: question8 },
    ];
    const removeIds = questionsToRemove.map(({ question }) => questionKey(question));
    const removeObjectIds = questionsToRemove
      .map(({ question }) => question._id)
      .filter((id): id is ObjectId => id instanceof ObjectId);
    const remainingQuestionIds = orderedQuestions
      .map(questionKey)
      .filter((id) => !removeIds.includes(id));

    const createdAt = new Date();
    const archive = {
      metadata: {
        createdAt: createdAt.toISOString(),
        mode: options.execute ? "archive-and-delete" : "archive-only",
        dbName,
        homeworkSet: serializeForArchive(homeworkSet),
        aliases,
        removedQuestions: questionsToRemove.map(({ displayedNumber, reason, question }) => ({
          displayedNumber,
          reason,
          id: question.id,
          _id: question._id?.toString(),
          prompt: question.prompt,
          instructions: question.instructions,
        })),
        questionOrderBefore: orderedQuestions.map(questionKey),
        questionOrderAfter: remainingQuestionIds,
      },
      questions: questionsToRemove.map(({ question }) => serializeForArchive(question)),
    };

    const archiveJson = `${JSON.stringify(archive, null, 2)}\n`;
    const archiveHash = crypto.createHash("sha256").update(archiveJson).digest("hex");
    const archiveFile = path.join(
      options.outputDir,
      `exercise3-removed-questions-${homeworkSet._id.toString()}-${timestampForFilename(createdAt)}.json`,
    );
    const manifestFile = `${archiveFile}.manifest.json`;

    await fs.mkdir(options.outputDir, { recursive: true });
    await fs.writeFile(archiveFile, archiveJson, { encoding: "utf8", flag: "wx" });

    const manifest = {
      collectionGroup: "homework-questions",
      createdAt: createdAt.toISOString(),
      mode: options.execute ? "archive-and-delete" : "archive-only",
      archiveFile,
      archiveSha256: archiveHash,
      dbName,
      homeworkSetId: homeworkSet._id.toString(),
      homeworkSetAppId: homeworkSet.id,
      homeworkSetTitle: homeworkSet.title,
      questionCountBefore: orderedQuestions.length,
      questionCountAfter: options.execute ? remainingQuestionIds.length : orderedQuestions.length,
      removedQuestionIds: removeIds,
      removedQuestionObjectIds: removeObjectIds.map((id) => id.toString()),
      questionOrderAfter: remainingQuestionIds,
    };

    console.log("Questions selected for removal:");
    for (const item of questionsToRemove) {
      console.log(
        `  Q${item.displayedNumber}: ${questionKey(item.question)} | ${item.reason} | ${compactText(item.question.prompt).slice(0, 120)}`,
      );
    }
    console.log(`Archive written: ${archiveFile}`);
    console.log(`Archive SHA-256: ${archiveHash}`);

    if (options.execute) {
      const deleteResult = await db.collection<QuestionDoc>("questions").deleteMany({
        _id: { $in: removeObjectIds },
      });

      if (deleteResult.deletedCount !== questionsToRemove.length) {
        throw new Error(`Expected to delete ${questionsToRemove.length} questions, deleted ${deleteResult.deletedCount}`);
      }

      await db.collection<HomeworkSetDoc>("homework_sets").updateOne(
        { _id: homeworkSet._id },
        {
          $set: {
            questionOrder: remainingQuestionIds,
            updatedAt: createdAt.toISOString(),
          },
        },
      );

      const remainingCount = await db.collection<QuestionDoc>("questions").countDocuments({ homeworkSetId: { $in: aliases } });
      const updatedSet = await db.collection<HomeworkSetDoc>("homework_sets").findOne({ _id: homeworkSet._id });

      console.log(`Deleted questions: ${deleteResult.deletedCount}`);
      console.log(`Question count after: ${remainingCount}`);
      console.log(`questionOrder length after: ${updatedSet?.questionOrder?.length ?? 0}`);

      if (remainingCount !== 12 || updatedSet?.questionOrder?.length !== 12) {
        throw new Error("Post-delete verification failed: expected 12 questions and 12 questionOrder entries");
      }
    } else {
      console.log("No remote documents changed. Re-run with --execute to apply the cleanup.");
    }

    await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(`Manifest written: ${manifestFile}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Exercise 3 question cleanup failed:", error);
  process.exit(1);
});
