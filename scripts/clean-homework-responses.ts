#!/usr/bin/env ts-node

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { config } from "dotenv";
import { MongoClient, ObjectId, type Db } from "mongodb";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

type CleanupCollection =
  | "submissions"
  | "question_analytics"
  | "analysis_results"
  | "analytics_events"
  | "submitted";

interface Options {
  title: string;
  outputDir: string;
  executeDelete: boolean;
}

interface CollectionSpec {
  name: CleanupCollection;
  queryKey: "homeworkSetId" | "setId";
}

const COLLECTIONS: CollectionSpec[] = [
  { name: "submissions", queryKey: "homeworkSetId" },
  { name: "question_analytics", queryKey: "homeworkSetId" },
  { name: "analysis_results", queryKey: "homeworkSetId" },
  { name: "analytics_events", queryKey: "setId" },
  { name: "submitted", queryKey: "homeworkSetId" },
];

function parseArgs(argv: string[]): Options {
  const options: Options = {
    title: "תרגיל בית 3",
    outputDir: path.resolve(process.cwd(), "exports", "homework-response-cleanup"),
    executeDelete: false,
  };

  for (const arg of argv) {
    if (arg === "--execute-delete") {
      options.executeDelete = true;
    } else if (arg.startsWith("--title=")) {
      options.title = arg.slice("--title=".length);
    } else if (arg.startsWith("--outDir=")) {
      options.outputDir = path.resolve(process.cwd(), arg.slice("--outDir=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.title.trim()) {
    throw new Error("--title must not be empty");
  }

  return options;
}

function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function serializeForArchive(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof ObjectId) return { $oid: value.toHexString() };
  if (Array.isArray(value)) return value.map(serializeForArchive);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = serializeForArchive(nested);
    }
    return output;
  }
  return value;
}

function assertObjectIds(collectionName: string, docs: Array<Record<string, unknown>>): ObjectId[] {
  return docs.map((doc) => {
    if (!(doc._id instanceof ObjectId)) {
      throw new Error(`Refusing to archive/delete ${collectionName} document without ObjectId _id`);
    }
    return doc._id;
  });
}

async function findHomeworkSet(db: Db, title: string) {
  const matches = await db
    .collection("homework_sets")
    .find({ title: { $in: [title, "תרגיל 3", "תרגיל בית 3"] } })
    .sort({ updatedAt: -1 })
    .toArray();

  const exact = matches.find((item) => item.title === title);
  const selected = exact ?? matches[0];

  if (!selected) {
    throw new Error(`Homework set not found for title: ${title}`);
  }

  return {
    selected,
    matches,
    aliases: Array.from(new Set([selected._id?.toString(), selected.id].filter(Boolean))),
  };
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
    const { selected, matches, aliases } = await findHomeworkSet(db, options.title);
    const archiveCollections: Record<string, unknown[]> = {};
    const idsByCollection: Record<string, ObjectId[]> = {};
    const countsBefore: Record<string, number> = {};

    for (const spec of COLLECTIONS) {
      const query = { [spec.queryKey]: { $in: aliases } };
      const docs = await db.collection(spec.name).find(query).sort({ _id: 1 }).toArray();
      countsBefore[spec.name] = docs.length;
      idsByCollection[spec.name] = assertObjectIds(spec.name, docs);
      archiveCollections[spec.name] = docs.map(serializeForArchive);
    }

    const createdAt = new Date();
    const archive = {
      metadata: {
        createdAt: createdAt.toISOString(),
        mode: options.executeDelete ? "archive-and-delete" : "archive-only",
        dbName,
        homeworkSet: serializeForArchive(selected),
        homeworkSetAliases: aliases,
        matchingHomeworkSets: matches.map((item) => ({
          _id: item._id?.toString(),
          id: item.id,
          title: item.title,
          visibility: item.visibility,
          published: item.published,
          updatedAt: item.updatedAt,
        })),
        collections: COLLECTIONS.map((spec) => ({
          name: spec.name,
          query: { [spec.queryKey]: { $in: aliases } },
          count: countsBefore[spec.name],
        })),
      },
      collections: archiveCollections,
    };

    const archiveJson = `${JSON.stringify(archive, null, 2)}\n`;
    const archiveHash = crypto.createHash("sha256").update(archiveJson).digest("hex");
    const archiveFile = path.join(
      options.outputDir,
      `homework-responses-${selected._id?.toString() ?? selected.id}-${timestampForFilename(createdAt)}.json`,
    );
    const manifestFile = `${archiveFile}.manifest.json`;

    await fs.mkdir(options.outputDir, { recursive: true });
    await fs.writeFile(archiveFile, archiveJson, { encoding: "utf8", flag: "wx" });

    const manifest: Record<string, unknown> = {
      collectionGroup: "homework-responses",
      createdAt: createdAt.toISOString(),
      mode: options.executeDelete ? "archive-and-delete" : "archive-only",
      archiveFile,
      archiveSha256: archiveHash,
      dbName,
      homeworkSetId: selected._id?.toString(),
      homeworkSetAppId: selected.id,
      homeworkSetTitle: selected.title,
      aliases,
      countsBefore,
      deletion: {
        requested: options.executeDelete,
        deleted: Object.fromEntries(COLLECTIONS.map((spec) => [spec.name, 0])),
        remainingAfterDelete: countsBefore,
      },
    };

    console.log(`Homework set: ${selected.title} (${selected._id?.toString()})`);
    console.log(`Aliases: ${aliases.join(", ")}`);
    console.log("Counts before:");
    for (const spec of COLLECTIONS) {
      console.log(`  ${spec.name}: ${countsBefore[spec.name]}`);
    }
    console.log(`Archive written: ${archiveFile}`);
    console.log(`Archive SHA-256: ${archiveHash}`);

    if (options.executeDelete) {
      const deleted: Record<string, number> = {};
      const remainingAfterDelete: Record<string, number> = {};

      for (const spec of COLLECTIONS) {
        const ids = idsByCollection[spec.name];
        const result = ids.length
          ? await db.collection(spec.name).deleteMany({ _id: { $in: ids } })
          : { deletedCount: 0 };
        deleted[spec.name] = result.deletedCount ?? 0;

        const query = { [spec.queryKey]: { $in: aliases } };
        remainingAfterDelete[spec.name] = await db.collection(spec.name).countDocuments(query);
      }

      manifest.deletion = {
        requested: true,
        deleted,
        remainingAfterDelete,
      };

      console.log("Deleted:");
      for (const spec of COLLECTIONS) {
        console.log(`  ${spec.name}: ${deleted[spec.name]}`);
      }
      console.log("Remaining after delete:");
      for (const spec of COLLECTIONS) {
        console.log(`  ${spec.name}: ${remainingAfterDelete[spec.name]}`);
      }
    } else {
      console.log("No remote documents deleted. Re-run with --execute-delete to clean the DB.");
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
  console.error("Cleanup failed:", error);
  process.exit(1);
});
