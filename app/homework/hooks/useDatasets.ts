"use client";

import { useQuery } from "@tanstack/react-query";
import { listDatasets } from "../services/datasetService";

export function useDatasets(params?: { search?: string; tags?: string[] }) {
  return useQuery({
    queryKey: ["datasets", params ?? {}],
    queryFn: () => listDatasets(params),
  });
}
