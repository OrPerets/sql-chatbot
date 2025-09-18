"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHomeworkQuestions, getHomeworkSet } from "@/app/homework/services/homeworkService";
import type { HomeworkDraftState } from "@/app/homework/builder/components/wizard/types";
import type { Question } from "@/app/homework/types";

function toDraft(set: Awaited<ReturnType<typeof getHomeworkSet>>, questions: Question[]): HomeworkDraftState {
  return {
    metadata: {
      title: set.title,
      courseId: set.courseId,
      dueAt: set.dueAt,
      visibility: set.visibility,
      datasetPolicy: set.datasetPolicy,
    },
    dataset: {
      selectedDatasetId: questions.find((question) => Boolean(question.datasetId))?.datasetId,
      mode: "reuse",
      newDatasetName: "",
      newDatasetDescription: "",
      tags: [],
    },
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      instructions: question.instructions,
      starterSql: question.starterSql ?? "",
      expectedResultSchema: JSON.stringify(question.expectedResultSchema ?? [], null, 2),
      points: question.points,
      maxAttempts: question.maxAttempts,
      datasetId: question.datasetId,
      rubric: question.gradingRubric,
      evaluationMode: question.evaluationMode ?? "auto",
    })),
    publishNotes: "",
  };
}

export function useHomeworkDraft(setId: string) {
  const setQuery = useQuery({ queryKey: ["homework", setId], queryFn: () => getHomeworkSet(setId) });
  const questionsQuery = useQuery({
    queryKey: ["homework", setId, "questions"],
    queryFn: () => getHomeworkQuestions(setId),
    enabled: Boolean(setId),
  });

  const draft = useMemo(() => {
    if (!setQuery.data || !questionsQuery.data) return undefined;
    return toDraft(setQuery.data, questionsQuery.data);
  }, [setQuery.data, questionsQuery.data]);

  return {
    draft,
    isLoading: setQuery.isLoading || questionsQuery.isLoading,
    error: setQuery.error ?? questionsQuery.error,
  };
}
