import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDataset, deleteDataset } from "../services/datasetService";
import type { Dataset } from "../types";

export function useCreateDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<Dataset>) => createDataset(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
  });
}
