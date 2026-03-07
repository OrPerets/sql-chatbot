import "dotenv/config";

import { ObjectId } from "mongodb";
import { connectToDatabase, COLLECTIONS } from "../lib/database";
import {
  buildHomeworkAvailabilityBackfill,
  needsHomeworkAvailabilityBackfill,
} from "../lib/homework-migration";

interface HomeworkDocument {
  _id?: ObjectId;
  id?: string;
  title?: string;
  dueAt?: string;
  availableFrom?: string;
  availableUntil?: string;
  createdAt?: string;
  entryMode?: "direct" | "listed" | "hidden";
}

async function main() {
  const write = process.argv.includes("--write");
  const nowIso = new Date().toISOString();
  const { db, client } = await connectToDatabase();

  try {
    const collection = db.collection<HomeworkDocument>(COLLECTIONS.HOMEWORK_SETS);
    const records = await collection.find({}).toArray();
    const candidates = records.filter((record) => needsHomeworkAvailabilityBackfill(record));

    if (candidates.length === 0) {
      console.log("No homework sets need availability backfill.");
      return;
    }

    console.log(`Found ${candidates.length} homework set(s) requiring backfill.`);

    for (const record of candidates) {
      const patch = buildHomeworkAvailabilityBackfill(record, nowIso);
      const label = record.id || record._id?.toString() || "unknown-id";
      console.log(
        `${write ? "Updating" : "Would update"} ${label}:`,
        JSON.stringify({
          title: record.title ?? "",
          ...patch,
        }),
      );

      if (!write || !record._id) {
        continue;
      }

      await collection.updateOne(
        { _id: record._id },
        {
          $set: patch,
        },
      );
    }

    if (!write) {
      console.log("Dry run only. Re-run with --write to persist changes.");
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to backfill homework availability:", error);
  process.exitCode = 1;
});
