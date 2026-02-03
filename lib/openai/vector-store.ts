import { randomUUID } from "crypto";

import { openai } from "@/app/openai";
import { COLLECTIONS, executeWithRetry } from "@/lib/database";

const VECTOR_STORE_CONFIG_KEY = "responses_default_vector_store_id";

declare global {
  // eslint-disable-next-line no-var
  var _responsesVectorStoreId: string | undefined;
}

function getConfiguredVectorStoreId(): string | null {
  const configured = process.env.OPENAI_VECTOR_STORE_ID?.trim();
  return configured ? configured : null;
}

async function readVectorStoreIdFromDb(): Promise<string | null> {
  try {
    return await executeWithRetry(async (db) => {
      const doc = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({
        key: VECTOR_STORE_CONFIG_KEY,
      });
      const value = typeof doc?.value === "string" ? doc.value.trim() : "";
      return value || null;
    });
  } catch (error: any) {
    console.warn("[vector-store] failed to read vector store id from DB:", error?.message || error);
    return null;
  }
}

async function writeVectorStoreIdToDb(vectorStoreId: string): Promise<void> {
  try {
    await executeWithRetry(async (db) => {
      await db.collection(COLLECTIONS.SEMESTER_CONFIG).updateOne(
        { key: VECTOR_STORE_CONFIG_KEY },
        {
          $set: {
            key: VECTOR_STORE_CONFIG_KEY,
            value: vectorStoreId,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            createdBy: "responses-api",
          },
        },
        { upsert: true }
      );
      return true;
    });
  } catch (error: any) {
    console.warn("[vector-store] failed to persist vector store id to DB:", error?.message || error);
  }
}

export async function getOrCreateAppVectorStoreId(): Promise<string> {
  const envVectorStoreId = getConfiguredVectorStoreId();
  if (envVectorStoreId) {
    globalThis._responsesVectorStoreId = envVectorStoreId;
    return envVectorStoreId;
  }

  if (globalThis._responsesVectorStoreId) {
    return globalThis._responsesVectorStoreId;
  }

  const dbVectorStoreId = await readVectorStoreIdFromDb();
  if (dbVectorStoreId) {
    globalThis._responsesVectorStoreId = dbVectorStoreId;
    return dbVectorStoreId;
  }

  const vectorStore = await openai.vectorStores.create({
    name: `responses-vector-store-${randomUUID().slice(0, 8)}`,
  });

  globalThis._responsesVectorStoreId = vectorStore.id;
  await writeVectorStoreIdToDb(vectorStore.id);
  return vectorStore.id;
}

export function buildFileSearchTool(vectorStoreId: string) {
  return {
    type: "file_search" as const,
    vector_store_ids: [vectorStoreId],
  };
}
