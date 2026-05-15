import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { getCoinsConfig } from "@/lib/coins";
import { COLLECTIONS, executeWithRetry } from "@/lib/database";
import { getMonitoringService } from "@/lib/monitoring";
import { NotificationService } from "@/lib/notifications";
import { getRuntimeAgentConfig } from "@/lib/openai/runtime-config";

export const dynamic = "force-dynamic";

type OverviewCounts = {
  totalUsers: number;
  totalTemplates: number;
  totalDatasets: number;
  totalHomeworkSets: number;
  atRiskStudents: number;
  pendingAnalysisReviews: number;
  missingAnswers: number;
  extraTimeUploads: number;
  michaelEnabled: boolean;
};

async function getOverviewCounts(): Promise<OverviewCounts> {
  return executeWithRetry(async (db) => {
    const [
      totalUsers,
      totalTemplates,
      totalDatasets,
      totalHomeworkSets,
      atRiskStudents,
      pendingAnalysisReviews,
      questions,
      extraTimeUploads,
      michaelDoc,
    ] = await Promise.all([
      db.collection(COLLECTIONS.USERS).countDocuments(),
      db.collection(COLLECTIONS.QUESTION_TEMPLATES).countDocuments(),
      db.collection(COLLECTIONS.DATASETS).countDocuments(),
      db.collection(COLLECTIONS.HOMEWORK_SETS).countDocuments(),
      db.collection(COLLECTIONS.STUDENT_PROFILES).countDocuments({
        "riskFactors.riskLevel": "high",
      }),
      db.collection(COLLECTIONS.ANALYSIS_RESULTS).countDocuments({
        "knowledgeScoreUpdate.adminReviewRequired": true,
      }),
      db
        .collection(COLLECTIONS.QUESTIONS)
        .find(
          {},
          {
            projection: {
              expectedResultSchema: 1,
              gradingRubric: 1,
              evaluationMode: 1,
            },
          }
        )
        .toArray(),
      db.collection(COLLECTIONS.EXTRA_TIME_ACCOMMODATIONS).countDocuments(),
      db.collection(COLLECTIONS.STATUS).findOne({ sid: "admin" }),
    ]);

    const missingAnswers = questions.reduce((count, question) => {
      const evaluationMode =
        typeof question.evaluationMode === "string" ? question.evaluationMode : "auto";

      if (evaluationMode === "manual" || evaluationMode === "custom") {
        return count;
      }

      const expectedResultSchema = Array.isArray(question.expectedResultSchema)
        ? question.expectedResultSchema
        : [];
      const gradingRubric = Array.isArray(question.gradingRubric) ? question.gradingRubric : [];

      return expectedResultSchema.length === 0 || gradingRubric.length === 0 ? count + 1 : count;
    }, 0);

    return {
      totalUsers,
      totalTemplates,
      totalDatasets,
      totalHomeworkSets,
      atRiskStudents,
      pendingAnalysisReviews,
      missingAnswers,
      extraTimeUploads,
      michaelEnabled: michaelDoc?.status === "ON",
    };
  });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const [counts, notifications, unreadNotifications, coinsConfig, runtimeConfig, activeAlerts] =
      await Promise.all([
        getOverviewCounts(),
        NotificationService.getNotifications({ limit: 3 }),
        NotificationService.getUnreadCount(),
        getCoinsConfig(),
        getRuntimeAgentConfig(),
        getMonitoringService()
          .then((service) => service.getActiveAlerts())
          .catch((error) => {
            console.error("Failed to load active alerts:", error);
            return [];
          }),
      ]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      attention: {
        unreadNotifications,
        pendingAnalysisReviews: counts.pendingAnalysisReviews,
        missingAnswers: counts.missingAnswers,
        activeAlerts: activeAlerts.length,
      },
      statuses: {
        michaelEnabled: counts.michaelEnabled,
        coinsVisible: coinsConfig.status === "ON",
        runtimeModel: runtimeConfig.model,
        totalUsers: counts.totalUsers,
        totalTemplates: counts.totalTemplates,
        totalDatasets: counts.totalDatasets,
        totalHomeworkSets: counts.totalHomeworkSets,
        atRiskStudents: counts.atRiskStudents,
        extraTimeUploads: counts.extraTimeUploads,
        notificationsUnread: unreadNotifications,
      },
      recent: {
        alerts: activeAlerts.slice(0, 3).map((alert) => ({
          id: String(alert._id || alert.timestamp?.toString?.() || alert.message),
          title: alert.message,
          severity: alert.severity,
        })),
        notifications: notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          createdAt: notification.createdAt,
        })),
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Error building admin overview:", error);
    return NextResponse.json({ error: "Failed to build admin overview" }, { status: 500 });
  }
}
