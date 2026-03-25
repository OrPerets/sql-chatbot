"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHomeworkQuestions, getHomeworkSet } from "@/app/homework/services/homeworkService";
import type { HomeworkDraftState } from "@/app/homework/builder/components/wizard/types";
import type { Question } from "@/app/homework/types";
import { buildExpectedOutputDescription } from "@/app/homework/utils/question-output";

function toDateTimeLocalValue(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toDraft(set: Awaited<ReturnType<typeof getHomeworkSet>>, questions: Question[]): HomeworkDraftState {
  console.log('toDraft called with:', {
    setTitle: set.title,
    questionOrder: set.questionOrder,
    questionsCount: questions.length,
    questionIds: questions.map(q => q.id)
  });
  
  // Create a map of questions by ID for efficient lookup
  const questionsMap = new Map(questions.map(q => [q.id, q]));
  
  // Only include questions that are in the questionOrder array
  const orderedQuestions = (set.questionOrder || [])
    .map(questionId => {
      const question = questionsMap.get(questionId);
      if (!question) {
        console.log('Question not found for ID:', questionId);
      }
      return question;
    })
    .filter((question): question is Question => question !== undefined);
    
  console.log('Final ordered questions:', orderedQuestions.length);

  return {
    metadata: {
      title: set.title,
      courseId: set.courseId,
      availableFrom: toDateTimeLocalValue(set.availableFrom || set.createdAt),
      availableUntil: toDateTimeLocalValue(set.availableUntil || set.dueAt),
      visibility: set.visibility,
      datasetPolicy: set.datasetPolicy,
      overview: set.overview,
      dataStructureNotes: set.dataStructureNotes,
    },
    dataset: {
      selectedDatasetId: set.selectedDatasetId || orderedQuestions.find((question) => Boolean(question.datasetId))?.datasetId,
      backgroundStory: set.backgroundStory || "",
      newDatasetName: "",
      tags: [],
    },
    questions: orderedQuestions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      expectedOutputDescription: buildExpectedOutputDescription(
        question.expectedOutputDescription,
        question.expectedResultSchema,
      ),
      instructions: question.instructions,
      starterSql: question.starterSql ?? "",
      expectedResultSchema: JSON.stringify(question.expectedResultSchema ?? [], null, 2),
      points: question.points,
      maxAttempts: question.maxAttempts,
      datasetId: question.datasetId,
      rubric: question.gradingRubric,
      evaluationMode: question.evaluationMode ?? "auto",
      parameterMode: question.parameterMode ?? ((question.parameters?.length ?? 0) > 0 ? "parameterized" : "static"),
      parameters: question.parameters ?? [],
      templateId: question.templateId,
    })),
    publishNotes: "",
  };
}

export function useHomeworkDraft(setId: string) {
  const setQuery = useQuery({
    queryKey: ["homework", setId, "builder"],
    queryFn: () => getHomeworkSet(setId, "builder"),
  });
  const questionsQuery = useQuery({
    queryKey: ["homework", setId, "questions", "builder"],
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
