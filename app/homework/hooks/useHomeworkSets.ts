"use client";

import { useQuery } from "@tanstack/react-query";
import { listHomeworkSets } from "../services/homeworkService";
import type { HomeworkQueryParams, PaginatedResponse, HomeworkSummary } from "../types";

export function useHomeworkSets(
  params?: HomeworkQueryParams & { page?: number; pageSize?: number; role?: string },
) {
  return useQuery<PaginatedResponse<HomeworkSummary>>({
    queryKey: ["homeworkSets", params ?? {}],
    queryFn: () => listHomeworkSets(params),
  });
}
