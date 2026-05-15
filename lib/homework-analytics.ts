import { randomUUID } from "crypto";

import { COLLECTIONS, connectToDatabase } from "@/lib/database";
import type { AnalyticsEvent } from "@/app/homework/types";
import type { AnalyticsEventModel } from "@/lib/models";

export async function saveHomeworkAnalyticsEvent(
  event: Omit<AnalyticsEvent, "id" | "createdAt"> & { createdAt?: string }
): Promise<AnalyticsEvent> {
  const { db } = await connectToDatabase();
  const createdAt = event.createdAt ?? new Date().toISOString();
  const payload: AnalyticsEventModel = {
    ...event,
    id: randomUUID(),
    createdAt,
  };

  await db.collection<AnalyticsEventModel>(COLLECTIONS.ANALYTICS).insertOne(payload);

  return payload;
}
