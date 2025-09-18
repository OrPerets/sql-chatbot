import { http } from "./http";
import type { AnalyticsEvent } from "../types";

export async function listAnalyticsEvents(setId: string) {
  return http<AnalyticsEvent[]>(`/api/analytics/homework/${setId}`, { method: "GET" });
}
