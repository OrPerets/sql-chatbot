import { http } from "./http";
import type {
  DeadlineAndScheduleContext,
  RankedLearningStepRecommendation,
  RecentSubmissionAttemptSummary,
  StudentProgressSnapshot,
} from "@/lib/personalization";
import type { LearningQuiz } from "@/lib/learning-quizzes";

export type HomeworkPersonalizationBundle = {
  snapshot: StudentProgressSnapshot;
  recentAttempts: RecentSubmissionAttemptSummary;
  deadlines: DeadlineAndScheduleContext;
  recommendation: RankedLearningStepRecommendation;
};

export async function getHomeworkPersonalization(
  setId: string,
  params: {
    studentId: string;
    questionId?: string | null;
  }
) {
  return http<HomeworkPersonalizationBundle>(`/api/homework/${setId}/personalization`, {
    method: "GET",
    params: {
      studentId: params.studentId,
      questionId: params.questionId || undefined,
    },
    headers: {
      "x-user-id": params.studentId,
    },
  });
}

export async function generateHomeworkPersonalizedQuiz(
  setId: string,
  payload: {
    studentId: string;
    questionId?: string | null;
    recommendationId?: string | null;
    maxQuestions?: number;
  }
) {
  return http<{ quiz: LearningQuiz }>(`/api/homework/${setId}/personalization`, {
    method: "POST",
    headers: {
      "x-user-id": payload.studentId,
    },
    body: JSON.stringify(payload),
  });
}

export async function trackHomeworkPersonalizationEvent(
  setId: string,
  payload: {
    studentId: string;
    eventType: "runner.personalization_shown" | "runner.personalization_accepted";
    questionId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  return http<{ event: unknown }>(`/api/homework/${setId}/personalization/analytics`, {
    method: "POST",
    headers: {
      "x-user-id": payload.studentId,
    },
    body: JSON.stringify(payload),
  });
}
