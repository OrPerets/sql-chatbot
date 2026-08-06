"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Info,
  ListChecks,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

import { useAdminShell } from "./AdminShell";
import studentStyles from "./StudentProfiles.module.css";

type KnowledgeScore = "empty" | "good" | "needs_attention" | "struggling";
type FreshnessStatus = "current" | "stale" | "needs_recalculation" | "no_evidence";
type OperationalFilter =
  | ""
  | "needs_review"
  | "missing_submissions"
  | "stale_profile"
  | "needs_recalculation"
  | "low_activity"
  | "no_evidence";

type SortMode =
  | "priority"
  | "freshness"
  | "missing_submissions"
  | "grade_asc"
  | "last_activity";

interface StudentProfileAdminSummary {
  academicPeriod: {
    year: number;
    semester: number;
  } | null;
  lastCalculated: string | null;
  lastEvidenceUpdate: string | null;
  freshnessStatus: FreshnessStatus;
  freshnessReason: string;
  homeworkCompletion: {
    completed: number;
    started: number;
    missing: number;
    total: number;
    denominatorSource: "published_homework" | "none";
  };
  scoreSummary: {
    average: number | null;
    scoredSubmissions: number;
    source: "submissions" | "profile_snapshot" | "none";
  };
  riskSummary: {
    level: "low" | "medium" | "high";
    reason: string;
    assessedAt: string | null;
  };
  weakTopics: Array<{
    topic: string;
    label: string;
    mastery: number;
    confidence: number;
    evidenceCount: number;
    lastEvidenceTime: string | null;
  }>;
  recommendedAction: string;
  evidenceCounts: {
    profileEvidenceFields: number;
    sourceTypes: number;
    submissions: number;
    chatSessions: number;
    helpRequests: number;
  };
  flags: {
    missingSubmissions: boolean;
    lowActivity: boolean;
    staleProfile: boolean;
    needsReview: boolean;
    noEvidence: boolean;
  };
}

interface StudentProfileRow {
  _id: string;
  userId: string;
  name?: string;
  email?: string;
  knowledgeScore: KnowledgeScore;
  lastActivity: string;
  totalQuestions: number;
  correctAnswers: number;
  homeworkSubmissions: number;
  averageGrade: number;
  commonChallenges: string[];
  issueCount: number;
  engagementMetrics: {
    chatSessions: number;
    averageSessionDuration: number;
    helpRequests: number;
    selfCorrections: number;
  };
  riskFactors: {
    isAtRisk: boolean;
    riskLevel: "low" | "medium" | "high";
    riskFactors: string[];
  };
  topicMastery?: Array<{
    topic: string;
    label: string;
    estimatedMastery: number;
    confidence: number;
    status: "measured" | "insufficient_evidence";
  }>;
  adminSummary?: StudentProfileAdminSummary;
}

interface StudentAnalytics {
  totalStudents: number;
  scoreDistribution: Record<KnowledgeScore, number>;
  riskDistribution: Record<"low" | "medium" | "high", number>;
  averageEngagement: number;
  averageGrade: number;
  freshnessDistribution?: Record<FreshnessStatus, number>;
  needsReview?: number;
  missingSubmissions?: number;
  lowActivity?: number;
  staleProfiles?: number;
  noEvidence?: number;
  averageHomeworkCompletion?: number;
}

interface AdminStudentEvidenceBundle {
  profile: StudentProfileRow & {
    adminOversight?: {
      interventions?: Array<{
        id: string;
        topic?: string | null;
        intervention: string;
        note?: string | null;
        status: "active" | "expired";
        expiresAt?: string | null;
      }>;
      goalMarkers?: Array<{
        id: string;
        goal: string;
        note?: string | null;
        createdAt: string;
      }>;
    };
  };
  adminSummary: StudentProfileAdminSummary;
  pedagogicalSummary: {
    headline: string;
    rationale: string;
    topWeakSkill: string | null;
    confidence: number;
    freshnessLabel: string;
  };
  evidenceConsole: {
    weakSkills: Array<{
      topic: string;
      label: string;
      mastery: number;
      confidence: number;
      freshness: number;
      freshnessLabel: string;
      lastEvidenceTime: string | null;
      evidenceSummary: string[];
    }>;
    recentFailedAttempts: Array<{
      questionId: string;
      homeworkTitle: string | null;
      attempts: number;
      lastTriedAt: string | null;
      failureTags: string[];
      misconceptions: Array<{
        label: string;
        studentLabel: string;
        studentExplanation: string;
        confidence: number;
      }>;
      hintBurden: string;
    }>;
    hintUsagePatterns: {
      totalShowAnswerClicks: number;
      averageTimeToFirstHintMs: number | null;
      averageAttemptsBeforeHint: number | null;
      mostSupportedQuestions: Array<{
        questionId: string;
        showAnswerClicks: number;
        attempts: number;
      }>;
    };
    chatMisconceptions: Array<{
      label: string;
      studentExplanation: string;
      confidence: number;
      topics: string[];
      sources: string[];
    }>;
    recommendationHistory: Array<{
      recommendationId: string;
      recommendationType: string | null;
      weakSkill: string | null;
      misconception: string | null;
      shownAt: string | null;
      lastEventAt: string | null;
      feedbackHistory: string[];
      outcome: "helpful" | "not_helpful" | "pending";
    }>;
    issueDetections: Array<{
      issueId: string;
      description: string;
      severity: "low" | "medium" | "high";
      confidence: number;
      freshnessLabel: string;
      source: string | null;
      status: "open" | "resolved";
    }>;
    fieldTraceability: Array<{
      field: string;
      computedAt: string | null;
      confidence: number | null;
      freshnessLabel: string;
      sources: string[];
      evidencePreview: string[];
    }>;
  };
}

interface StudentProfilesProps {
  onClose?: () => void;
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeProfileRow = (profile: StudentProfileRow): StudentProfileRow => ({
  ...profile,
  name: profile.name || "ללא שם",
  email: profile.email || "ללא אימייל",
  totalQuestions: toFiniteNumber(profile.totalQuestions),
  correctAnswers: toFiniteNumber(profile.correctAnswers),
  homeworkSubmissions: toFiniteNumber(profile.homeworkSubmissions),
  averageGrade: toFiniteNumber(profile.averageGrade),
  issueCount: toFiniteNumber(profile.issueCount),
  commonChallenges: Array.isArray(profile.commonChallenges) ? profile.commonChallenges : [],
  engagementMetrics: {
    chatSessions: toFiniteNumber(profile.engagementMetrics?.chatSessions),
    averageSessionDuration: toFiniteNumber(profile.engagementMetrics?.averageSessionDuration),
    helpRequests: toFiniteNumber(profile.engagementMetrics?.helpRequests),
    selfCorrections: toFiniteNumber(profile.engagementMetrics?.selfCorrections),
  },
  riskFactors: {
    isAtRisk: Boolean(profile.riskFactors?.isAtRisk),
    riskLevel:
      profile.riskFactors?.riskLevel === "high" || profile.riskFactors?.riskLevel === "medium"
        ? profile.riskFactors.riskLevel
        : "low",
    riskFactors: Array.isArray(profile.riskFactors?.riskFactors)
      ? profile.riskFactors.riskFactors
      : [],
  },
  topicMastery: Array.isArray(profile.topicMastery) ? profile.topicMastery : [],
});

const TOPIC_LABELS_HE: Record<string, string> = {
  selection_projection: "בחירה והקרנה",
  "Selection and projection": "בחירה והקרנה",
  filtering: "סינון",
  Filtering: "סינון",
  sorting: "מיון",
  Sorting: "מיון",
  joins: "צירופי טבלאות",
  "JOIN logic": "צירופי טבלאות",
  grouping_aggregation: "קיבוץ ואגרגציה",
  "Grouping and aggregation": "קיבוץ ואגרגציה",
  subqueries: "תתי-שאילתות",
  Subqueries: "תתי-שאילתות",
  set_operations: "פעולות קבוצה",
  "Set operations": "פעולות קבוצה",
  null_handling: "טיפול ב-NULL",
  "NULL handling": "טיפול ב-NULL",
  schema_comprehension: "הבנת מבנה הנתונים",
  "Schema comprehension": "הבנת מבנה הנתונים",
  debugging: "דיבוג",
  Debugging: "דיבוג",
  relational_algebra: "אלגברה יחסית",
  "Relational algebra": "אלגברה יחסית",
  exam_speed_fluency: "שטף פתרון בקצב מבחן",
  "Exam-speed fluency": "שטף פתרון בקצב מבחן",
};

function localizeTopicLabel(value: string | null | undefined) {
  if (!value) {
    return "טרם נקבע";
  }

  return TOPIC_LABELS_HE[value] ?? value;
}

function localizeText(value: string | null | undefined) {
  if (!value) {
    return "לא זמין";
  }

  let text = value.trim();
  const replacements: Array<[RegExp, string]> = [
    [/Student is weak on joins\.?/gi, "הסטודנט מתקשה בצירופי טבלאות."],
    [/Recent attempts still fail\.?/gi, "גם בניסיונות האחרונים הופיע קושי."],
    [/No hint reliance recorded\.?/gi, "לא זוהתה הסתמכות על רמזים."],
    [/(\d+)\s+hint opens recorded\.?/gi, "תועדו $1 פתיחות רמז."],
    [/(\d+)\s+hint opens, first after about\s+(\d+)\s+minutes\.?/gi, "$1 פתיחות רמז, והרמז הראשון נפתח אחרי כ-$2 דקות."],
    [/Confidence\s+(\d+)%\.?/gi, "רמת ביטחון $1%."],
    [/ai_analysis/gi, "ניתוח בינה מלאכותית"],
    [/runner_attempts/gi, "ניסיונות בפתרון"],
    [/question_analytics_speed/gi, "מהירות פתרון"],
    [/question_analytics/gi, "אנליטיקת שאלות"],
    [/not_relevant/gi, "לא רלוונטי"],
    [/too_easy/gi, "קל מדי"],
    [/too_hard/gi, "קשה מדי"],
    [/helpful/gi, "עזר"],
    [/pending/gi, "ממתין"],
    [/Low comprehension level detected in conversations\.?/gi, "זוהתה רמת הבנה נמוכה בשיחות האחרונות."],
    [/Manual analysis requested by admin evidence console/gi, "ניתוח ידני מתוך מסך הראיות"],
    [/Temporary intervention from admin evidence console/gi, "התערבות זמנית ממסך הראיות"],
    [/Marked from admin evidence console/gi, "מטרה שסומנה ממסך הראיות"],
    [/Forced from admin evidence console/gi, "כיול מחדש שנכפה ממסך הראיות"],
    [/Confirmed from admin evidence console/gi, "אושר ממסך הראיות"],
    [/Dismissed as false positive from admin evidence console/gi, "נדחה כחיובי שגוי ממסך הראיות"],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  Object.entries(TOPIC_LABELS_HE).forEach(([source, target]) => {
    text = text.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), target);
  });

  return text;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "לא זמין";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "לא זמין";
  }

  return parsed.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) {
    return "אין נתון";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "אין נתון";
  }

  return parsed.toLocaleDateString("he-IL", {
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRiskLevel(value: "low" | "medium" | "high") {
  switch (value) {
    case "high":
      return "סיכון גבוה";
    case "medium":
      return "סיכון בינוני";
    default:
      return "סיכון נמוך";
  }
}

function formatFreshnessLabel(value: string) {
  if (value === "current") return "עדכני";
  if (value === "needs_recalculation") return "דורש חישוב";
  if (value === "no_evidence") return "אין ראיות";
  if (value === "fresh") return "עדכני";
  if (value === "aging") return "מתיישן";
  if (value === "stale") return "התיישן";
  return "לא ידוע";
}

function formatAcademicPeriod(value: StudentProfileAdminSummary["academicPeriod"] | null | undefined) {
  if (!value) {
    return "לא משויך למחזור";
  }

  return `${value.year}/${value.semester}`;
}

function formatHomeworkCompletion(summary: StudentProfileAdminSummary | undefined) {
  if (!summary || summary.homeworkCompletion.total <= 0) {
    return "אין מספיק נתונים";
  }

  return `${summary.homeworkCompletion.completed}/${summary.homeworkCompletion.total}`;
}

function formatScoreSummary(summary: StudentProfileAdminSummary | undefined, fallbackAverage: number) {
  if (summary?.scoreSummary.average !== null && summary?.scoreSummary.average !== undefined) {
    return summary.scoreSummary.average.toFixed(1);
  }

  if (fallbackAverage > 0) {
    return fallbackAverage.toFixed(1);
  }

  return "אין מספיק נתונים";
}

function formatScoreSource(summary: StudentProfileAdminSummary | undefined) {
  if (!summary || summary.scoreSummary.source === "none") {
    return "ללא ציונים אמינים";
  }

  if (summary.scoreSummary.source === "submissions") {
    return `${summary.scoreSummary.scoredSubmissions} הגשות עם ציון`;
  }

  return "מתוך תמונת פרופיל אחרונה";
}

function getFreshnessClass(status: FreshnessStatus | string | undefined) {
  if (status === "current") return studentStyles.freshnessFresh;
  if (status === "needs_recalculation") return studentStyles.freshnessRecalculate;
  if (status === "stale") return studentStyles.freshnessStale;
  if (status === "no_evidence") return studentStyles.freshnessUnknown;
  return getFreshnessTone(status || "");
}

function getRiskClass(level: "low" | "medium" | "high") {
  if (level === "high") return studentStyles.riskHigh;
  if (level === "medium") return studentStyles.riskMedium;
  return studentStyles.riskLow;
}

function getOperationalFilterLabel(value: OperationalFilter) {
  const labels: Record<OperationalFilter, string> = {
    "": "כל המצבים",
    needs_review: "דורש סקירת מרצה",
    missing_submissions: "חסרות הגשות",
    stale_profile: "פרופיל לא עדכני",
    needs_recalculation: "דורש חישוב מחדש",
    low_activity: "פעילות נמוכה",
    no_evidence: "אין ראיות",
  };
  return labels[value];
}

function formatIssueStatus(value: "open" | "resolved") {
  return value === "resolved" ? "טופל" : "פתוח";
}

function formatSeverity(value: "low" | "medium" | "high") {
  if (value === "high") return "חומרה גבוהה";
  if (value === "medium") return "חומרה בינונית";
  return "חומרה נמוכה";
}

function formatRecommendationOutcome(value: "helpful" | "not_helpful" | "pending") {
  if (value === "helpful") return "עזר";
  if (value === "not_helpful") return "לא עזר";
  return "ממתין";
}

function formatRecommendationType(value: string | null | undefined) {
  if (!value) return "המלצה";

  const mapping: Record<string, string> = {
    personalized_quiz: "בוחן מותאם",
    review_topic: "חזרה על נושא",
    targeted_hint: "רמז ממוקד",
    calibration_check: "בדיקת כיול",
  };

  return mapping[value] ?? localizeText(value.replace(/_/g, " "));
}

function formatActionStatus(value: "active" | "expired") {
  return value === "expired" ? "פג תוקף" : "פעיל";
}

function formatAccuracy(correct: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((correct / total) * 100)}%`;
}

function formatKnowledgeScore(score: KnowledgeScore) {
  switch (score) {
    case "good":
      return "טוב";
    case "needs_attention":
      return "זקוק לתשומת לב";
    case "struggling":
      return "מתקשה";
    default:
      return "ריק";
  }
}

function getProfilePriority(profile: StudentProfileRow) {
  const summary = profile.adminSummary;

  if (summary?.flags.needsReview || summary?.riskSummary.level === "high" || profile.riskFactors.riskLevel === "high") {
    return {
      label: "לטיפול עכשיו",
      detail: "דורש החלטת מרצה",
      className: studentStyles.priorityHigh,
    };
  }

  if (summary?.flags.missingSubmissions) {
    return {
      label: "חסרות הגשות",
      detail: `${summary.homeworkCompletion.missing} חסרות`,
      className: studentStyles.priorityMedium,
    };
  }

  if (summary?.flags.staleProfile || summary?.freshnessStatus === "needs_recalculation") {
    return {
      label: "לעדכן פרופיל",
      detail: "הראיות לא עדכניות",
      className: studentStyles.priorityWarning,
    };
  }

  if (summary?.flags.noEvidence) {
    return {
      label: "אין מספיק ראיות",
      detail: "צריך לאסוף נתונים",
      className: studentStyles.priorityMuted,
    };
  }

  return {
    label: "במעקב תקין",
    detail: "אין פעולה דחופה",
    className: studentStyles.priorityLow,
  };
}

function getKnowledgeScoreClass(score: KnowledgeScore) {
  switch (score) {
    case "good":
      return studentStyles.scoreGood;
    case "needs_attention":
      return studentStyles.scoreNeedsAttention;
    case "struggling":
      return studentStyles.scoreStruggling;
    default:
      return studentStyles.scoreEmpty;
  }
}

function getPedagogicalSummary(profile: StudentProfileRow) {
  const measuredWeakness = (profile.topicMastery || [])
    .filter((record) => record.status === "measured")
    .sort((left, right) => left.estimatedMastery - right.estimatedMastery)[0];

  const headline = measuredWeakness
    ? `${localizeTopicLabel(measuredWeakness.label)} היא נקודת התורפה המרכזית כרגע.`
    : profile.commonChallenges[0]
      ? `האתגר החוזר הבולט: ${localizeText(profile.commonChallenges[0])}.`
      : "עדיין אין מספיק ראיות פדגוגיות חזקות.";

  const detail = measuredWeakness
    ? `שליטה ${formatPercent(measuredWeakness.estimatedMastery)}, ביטחון ${formatPercent(
        measuredWeakness.confidence
      )}`
    : profile.riskFactors.riskFactors[0]
      ? localizeText(profile.riskFactors.riskFactors[0])
      : "מומלץ לפתוח את קונסולת הראיות.";

  return {
    headline,
    detail,
    confidence: measuredWeakness?.confidence ?? 0,
  };
}

function getFreshnessTone(label: string) {
  if (label === "fresh") return studentStyles.freshnessFresh;
  if (label === "aging") return studentStyles.freshnessAging;
  if (label === "stale") return studentStyles.freshnessStale;
  return studentStyles.freshnessUnknown;
}

function buildLecturerActionItems(bundle: AdminStudentEvidenceBundle) {
  const items: string[] = [];
  const topWeakSkill = bundle.evidenceConsole.weakSkills[0];
  const hintUsage = bundle.evidenceConsole.hintUsagePatterns;
  const topIssue = bundle.evidenceConsole.issueDetections.find((issue) => issue.status === "open");

  if (topWeakSkill) {
    const localizedLabel = localizeTopicLabel(topWeakSkill.label);
    if (topWeakSkill.topic === "exam_speed_fluency") {
      items.push(`לתת לסטודנט תרגול קצר ומדוד בזמן סביב ${localizedLabel}, עם דגש על פתרון מהיר של תבניות מוכרות.`);
    } else {
      items.push(`לקבוע חיזוק ממוקד בנושא ${localizedLabel}, לפני מעבר לתרגול רחב יותר.`);
    }
  }

  if (hintUsage.totalShowAnswerClicks > 0) {
    if ((hintUsage.averageAttemptsBeforeHint ?? 3) <= 1.5) {
      items.push("להנחות את הסטודנט לנסות לפחות ניסיון אחד עצמאי לפני פתיחת רמז או תשובה.");
    } else {
      items.push("להשתמש ברמזים מדורגים בלבד, כדי להבין אם הקושי הוא מושגי או נובע מביצוע לא יציב.");
    }
  }

  if (topIssue) {
    items.push(`לעקוב השבוע אחרי האות הפתוח: ${localizeText(topIssue.description)}.`);
  }

  if (bundle.evidenceConsole.chatMisconceptions[0] && items.length < 3) {
    items.push(`לבדוק בעל פה את המושג "${localizeText(bundle.evidenceConsole.chatMisconceptions[0].label)}" לפני המטלה הבאה.`);
  }

  if (items.length === 0) {
    items.push("כדאי לאסוף עוד ראיות דרך מטלה קצרה או הרצת כיול מחדש לפני התערבות ממוקדת.");
  }

  return items.slice(0, 3);
}

export default function StudentProfiles({ onClose }: StudentProfilesProps) {
  const { academicPeriod, academicPeriodQuery } = useAdminShell();
  const [isMounted, setIsMounted] = useState(false);
  const [profiles, setProfiles] = useState<StudentProfileRow[]>([]);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScore, setSelectedScore] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("");
  const [selectedOperationalFilter, setSelectedOperationalFilter] = useState<OperationalFilter>("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<StudentProfileRow | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<AdminStudentEvidenceBundle | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [interventionDraft, setInterventionDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (searchTerm) params.append("search", searchTerm);
      if (selectedScore) params.append("knowledgeScore", selectedScore);
      if (selectedRisk) params.append("riskLevel", selectedRisk);
      if (selectedOperationalFilter) params.append("status", selectedOperationalFilter);
      if (selectedTopic) params.append("topic", selectedTopic);
      params.append("sort", sortMode);
      const periodParams = new URLSearchParams(academicPeriodQuery);
      periodParams.forEach((value, key) => params.set(key, value));

      const response = await fetch(`/api/admin/students?${params}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "שגיאה בטעינת פרופילי הסטודנטים");
        return;
      }

      setProfiles((data.data.profiles || []).map(normalizeProfileRow));
      setTotalPages(data.data.totalPages || 1);
    } catch (fetchError) {
      console.error("Failed to fetch student profiles:", fetchError);
      setError("שגיאת רשת בטעינת פרופילי הסטודנטים");
    } finally {
      setLoading(false);
    }
  }, [
    academicPeriodQuery,
    currentPage,
    searchTerm,
    selectedOperationalFilter,
    selectedRisk,
    selectedScore,
    selectedTopic,
    sortMode,
  ]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/students/analytics?${academicPeriodQuery}`);
      const data = await response.json();
      if (!data.success) {
        return;
      }

      setAnalytics({
        totalStudents: toFiniteNumber(data.data.totalStudents),
        scoreDistribution: {
          empty: toFiniteNumber(data.data.scoreDistribution?.empty),
          good: toFiniteNumber(data.data.scoreDistribution?.good),
          needs_attention: toFiniteNumber(data.data.scoreDistribution?.needs_attention),
          struggling: toFiniteNumber(data.data.scoreDistribution?.struggling),
        },
        riskDistribution: {
          low: toFiniteNumber(data.data.riskDistribution?.low),
          medium: toFiniteNumber(data.data.riskDistribution?.medium),
          high: toFiniteNumber(data.data.riskDistribution?.high),
        },
        averageEngagement: toFiniteNumber(data.data.averageEngagement),
        averageGrade: toFiniteNumber(data.data.averageGrade),
        freshnessDistribution: {
          current: toFiniteNumber(data.data.freshnessDistribution?.current),
          stale: toFiniteNumber(data.data.freshnessDistribution?.stale),
          needs_recalculation: toFiniteNumber(data.data.freshnessDistribution?.needs_recalculation),
          no_evidence: toFiniteNumber(data.data.freshnessDistribution?.no_evidence),
        },
        needsReview: toFiniteNumber(data.data.needsReview),
        missingSubmissions: toFiniteNumber(data.data.missingSubmissions),
        lowActivity: toFiniteNumber(data.data.lowActivity),
        staleProfiles: toFiniteNumber(data.data.staleProfiles),
        noEvidence: toFiniteNumber(data.data.noEvidence),
        averageHomeworkCompletion: toFiniteNumber(data.data.averageHomeworkCompletion),
      });
    } catch (fetchError) {
      console.error("Failed to fetch analytics:", fetchError);
    }
  }, [academicPeriodQuery]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    setCurrentPage(1);
  }, [academicPeriodQuery, searchTerm, selectedOperationalFilter, selectedRisk, selectedScore, selectedTopic, sortMode]);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedProfile]);

  const openEvidenceConsole = useCallback(async (profile: StudentProfileRow) => {
    try {
      setSelectedProfile(profile);
      setDrawerLoading(true);
      setDrawerError(null);
      const response = await fetch(`/api/admin/students/${profile.userId}?${academicPeriodQuery}`);
      const data = await response.json();

      if (!data.success) {
        setDrawerError(data.error || "לא הצלחנו לטעון את קונסולת הראיות.");
        return;
      }

      setSelectedEvidence(data.data);
      setInterventionDraft("");
      setGoalDraft("");
    } catch (fetchError) {
      console.error("Failed to open admin evidence console:", fetchError);
      setDrawerError("שגיאת רשת בטעינת קונסולת הראיות.");
    } finally {
      setDrawerLoading(false);
    }
  }, [academicPeriodQuery]);

  const refreshSelectedEvidence = useCallback(async () => {
    if (!selectedProfile) {
      return;
    }

    await openEvidenceConsole(selectedProfile);
    await fetchProfiles();
  }, [fetchProfiles, openEvidenceConsole, selectedProfile]);

  const runAdminAction = useCallback(
    async (payload: Record<string, unknown>, loadingKey: string) => {
      if (!selectedProfile) {
        return;
      }

      try {
        setActionLoading(loadingKey);
        const response = await fetch(`/api/admin/students/${selectedProfile.userId}?${academicPeriodQuery}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) {
          alert(data.error || "הפעולה לא הושלמה.");
          return;
        }

        setSelectedEvidence(data.data);
        setActionMessage(data.message || "הפעולה הושלמה והראיות רועננו.");
        await fetchProfiles();
      } catch (actionError) {
        console.error("Failed to apply admin oversight action:", actionError);
        alert("שגיאה בביצוע הפעולה.");
      } finally {
        setActionLoading(null);
      }
    },
    [academicPeriodQuery, fetchProfiles, selectedProfile]
  );

  const handleAnalyzeIssues = useCallback(async (profile: StudentProfileRow) => {
    try {
      setActionLoading(`analyze:${profile.userId}`);
      const response = await fetch(`/api/admin/students/analyze-issues?${academicPeriodQuery}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: profile.userId,
          analysisType: "manual",
          triggerReason: "ניתוח ידני ממסך פרופיל הסטודנט",
        }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || "הניתוח לא הושלם.");
        return;
      }

      setActionMessage("ניתוח הבעיות הושלם. הרשימה וקונסולת הראיות רועננו.");
      await fetchProfiles();
      if (selectedProfile?.userId === profile.userId) {
        await refreshSelectedEvidence();
      }
    } catch (actionError) {
      console.error("Failed to analyze issues:", actionError);
      alert("שגיאה בהרצת ניתוח הבעיות.");
    } finally {
      setActionLoading(null);
    }
  }, [academicPeriodQuery, fetchProfiles, refreshSelectedEvidence, selectedProfile?.userId]);

  const handleCalculateProfiles = useCallback(async () => {
    try {
      setActionLoading("calculate");
      setLoading(true);
      const response = await fetch(`/api/admin/students/calculate-profiles?${academicPeriodQuery}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || "חישוב הפרופילים נכשל.");
        return;
      }

      const result = data.data || {};
      setActionMessage(
        `חישוב מחדש הסתיים למחזור ${academicPeriod.year}/${academicPeriod.semester}: ${toFiniteNumber(result.created)} נוצרו, ${toFiniteNumber(result.updated)} עודכנו, ${toFiniteNumber(result.errors)} שגיאות.`
      );
      await fetchProfiles();
      await fetchAnalytics();
      if (selectedProfile) {
        await refreshSelectedEvidence();
      }
    } catch (actionError) {
      console.error("Failed to recalculate student profiles:", actionError);
      alert("שגיאה בחישוב הפרופילים.");
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  }, [academicPeriod.year, academicPeriod.semester, academicPeriodQuery, fetchAnalytics, fetchProfiles, refreshSelectedEvidence, selectedProfile]);

  const activeWeakSkills = useMemo(
    () => selectedEvidence?.evidenceConsole.weakSkills || [],
    [selectedEvidence]
  );

  const topicFilterOptions = useMemo(() => {
    const topicMap = new Map<string, string>();
    profiles.forEach((profile) => {
      profile.adminSummary?.weakTopics.forEach((topic) => {
        topicMap.set(topic.topic, localizeTopicLabel(topic.label));
      });
    });
    return Array.from(topicMap.entries()).sort((left, right) => left[1].localeCompare(right[1], "he"));
  }, [profiles]);

  const lecturerFocusCards = useMemo(
    () => [
      {
        key: "needs_review" as OperationalFilter,
        icon: ShieldAlert,
        value: analytics?.needsReview ?? 0,
        title: "לטיפול מרצה",
        description: "מקרים שדורשים החלטה או בדיקה ידנית",
      },
      {
        key: "missing_submissions" as OperationalFilter,
        icon: ListChecks,
        value: analytics?.missingSubmissions ?? 0,
        title: "חסרות הגשות",
        description: "סטודנטים שכדאי ליצור איתם קשר",
      },
      {
        key: "stale_profile" as OperationalFilter,
        icon: Clock3,
        value: analytics?.staleProfiles ?? 0,
        title: "לא עדכני",
        description: "פרופילים שמומלץ לחשב או לרענן",
      },
      {
        key: "no_evidence" as OperationalFilter,
        icon: Info,
        value: analytics?.noEvidence ?? 0,
        title: "אין ראיות",
        description: "סטודנטים שצריך לאסוף עליהם אותות",
      },
    ],
    [analytics]
  );

  return (
    <div className={studentStyles.studentProfilesContainer}>
      <div className={studentStyles.analyticsSection}>
        <div className={studentStyles.statCard}>
          <Users className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{analytics?.totalStudents ?? profiles.length}</div>
          <div className={studentStyles.statLabel}>סטודנטים במחזור {academicPeriod.year}/{academicPeriod.semester}</div>
        </div>
        <div className={studentStyles.statCard}>
          <ShieldAlert className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{analytics?.needsReview ?? 0}</div>
          <div className={studentStyles.statLabel}>דורשים סקירת מרצה</div>
        </div>
        <div className={studentStyles.statCard}>
          <ListChecks className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{analytics?.missingSubmissions ?? 0}</div>
          <div className={studentStyles.statLabel}>עם הגשות חסרות</div>
        </div>
        <div className={studentStyles.statCard}>
          <Clock3 className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{analytics?.staleProfiles ?? 0}</div>
          <div className={studentStyles.statLabel}>פרופילים לא עדכניים</div>
        </div>
        <div className={studentStyles.statCard}>
          <TrendingUp className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>
            {formatPercent(toFiniteNumber(analytics?.averageHomeworkCompletion))}
          </div>
          <div className={studentStyles.statLabel}>השלמת מטלות ממוצעת</div>
        </div>
      </div>

      <section className={studentStyles.lecturerFocusSection} aria-label="מעקב מרצה">
        <div className={studentStyles.focusHeader}>
          <div>
            <h2>מעקב מרצה למחזור {academicPeriod.year}/{academicPeriod.semester}</h2>
            <p>התחילו מהקבוצה הדחופה, פתחו פרופיל, וסמנו פעולה או מטרה בלי לחפש בתוך כל הראיות.</p>
          </div>
          <button
            type="button"
            className={studentStyles.secondaryActionButton}
            onClick={() => {
              setSelectedOperationalFilter("");
              setSelectedRisk("");
              setSelectedScore("");
              setSelectedTopic("");
              setSortMode("priority");
              setSearchTerm("");
            }}
          >
            <X size={16} />
            נקה מיקוד
          </button>
        </div>
        <div className={studentStyles.focusGrid}>
          {lecturerFocusCards.map((card) => {
            const Icon = card.icon;
            const isActive = selectedOperationalFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                className={`${studentStyles.focusCard} ${isActive ? studentStyles.focusCardActive : ""}`}
                onClick={() => {
                  setSelectedOperationalFilter(isActive ? "" : card.key);
                  setSortMode("priority");
                }}
              >
                <Icon size={18} />
                <span className={studentStyles.focusValue}>{card.value}</span>
                <span className={studentStyles.focusTitle}>{card.title}</span>
                <span className={studentStyles.focusDescription}>{card.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className={studentStyles.filtersSection}>
        <div className={studentStyles.filterContext}>
          <Filter size={16} />
          <span>מסננים את המחזור הפעיל {academicPeriod.year}/{academicPeriod.semester}</span>
        </div>
        <div className={studentStyles.searchContainer}>
          <Search className={studentStyles.searchIcon} size={16} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="חיפוש לפי שם או אימייל..."
            className={studentStyles.searchInput}
          />
        </div>

        <select
          value={selectedScore}
          onChange={(event) => setSelectedScore(event.target.value)}
          className={studentStyles.filterSelect}
        >
          <option value="">כל ציוני הידע</option>
          <option value="empty">ריק</option>
          <option value="good">טוב</option>
          <option value="needs_attention">זקוק לתשומת לב</option>
          <option value="struggling">מתקשה</option>
        </select>

        <select
          value={selectedRisk}
          onChange={(event) => setSelectedRisk(event.target.value)}
          className={studentStyles.filterSelect}
        >
          <option value="">כל רמות הסיכון</option>
          <option value="low">נמוכה</option>
          <option value="medium">בינונית</option>
          <option value="high">גבוהה</option>
        </select>

        <select
          value={selectedOperationalFilter}
          onChange={(event) => setSelectedOperationalFilter(event.target.value as OperationalFilter)}
          className={studentStyles.filterSelect}
        >
          <option value="">כל המצבים</option>
          <option value="needs_review">דורש סקירת מרצה</option>
          <option value="missing_submissions">חסרות הגשות</option>
          <option value="stale_profile">פרופיל לא עדכני</option>
          <option value="needs_recalculation">דורש חישוב מחדש</option>
          <option value="low_activity">פעילות נמוכה</option>
          <option value="no_evidence">אין ראיות</option>
        </select>

        <select
          value={selectedTopic}
          onChange={(event) => setSelectedTopic(event.target.value)}
          className={studentStyles.filterSelect}
        >
          <option value="">כל הנושאים</option>
          {topicFilterOptions.map(([topic, label]) => (
            <option key={topic} value={topic}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          className={studentStyles.filterSelect}
        >
          <option value="priority">מיון לפי דחיפות</option>
          <option value="freshness">מיון לפי עדכניות</option>
          <option value="missing_submissions">מיון לפי חוסר הגשות</option>
          <option value="grade_asc">מיון לפי ציון נמוך</option>
          <option value="last_activity">מיון לפי פעילות אחרונה</option>
        </select>

        <button onClick={() => void fetchProfiles()} className={studentStyles.quickActionButton} disabled={loading}>
          <RefreshCw size={16} />
          <div className={studentStyles.buttonContent}>
            <div className={studentStyles.buttonTitle}>רענון</div>
            <div className={studentStyles.buttonDescription}>טען רשימה מחדש</div>
          </div>
        </button>

        <button
          onClick={() => void handleCalculateProfiles()}
          className={studentStyles.headerActionButton}
          disabled={actionLoading === "calculate" || loading}
        >
          <BarChart3 size={16} />
          <span>{actionLoading === "calculate" ? "מחשב..." : "חשב פרופילים"}</span>
        </button>

        {onClose ? (
          <button onClick={onClose} className={studentStyles.secondaryActionButton}>
            <X size={16} />
            <span>סגור</span>
          </button>
        ) : null}
      </div>

      {error ? <div className={studentStyles.errorBanner}>{error}</div> : null}
      {actionMessage ? (
        <div className={studentStyles.successBanner}>
          <CheckCircle2 size={16} />
          <span>{actionMessage}</span>
        </div>
      ) : null}

      <div className={studentStyles.tableSection}>
        <div className={studentStyles.tableHeader}>
          <h3 className={studentStyles.tableTitle}>פרופילי סטודנטים למרצה</h3>
          <p className={studentStyles.tableSubtitle}>
            כל שורה מציגה החלטה מעשית: מצב, פעולה מומלצת, הגשות, ציון ועדכניות ראיות.
          </p>
        </div>

        {loading ? (
          <div className={studentStyles.loadingState}>טוען נתונים...</div>
        ) : profiles.length === 0 ? (
          <div className={studentStyles.emptyState}>
            <GraduationCap size={22} />
            <strong>
              {searchTerm || selectedOperationalFilter || selectedRisk || selectedScore || selectedTopic
                ? "לא נמצאו סטודנטים שתואמים למסננים"
                : `אין סטודנטים במחזור ${academicPeriod.year}/${academicPeriod.semester}`}
            </strong>
            <span>
              {selectedOperationalFilter
                ? `מסנן פעיל: ${getOperationalFilterLabel(selectedOperationalFilter)}. אפשר לנקות מסננים או להריץ חישוב מחדש למחזור.`
                : "אם זה לא צפוי, בדקו שיוך שנה/סמסטר במסך המשתמשים."}
            </span>
          </div>
        ) : (
          <div className={studentStyles.tableWrap}>
            <table className={studentStyles.studentTable}>
              <thead>
                <tr className={studentStyles.tableHeaderRow}>
                  <th className={studentStyles.tableHeaderCell}>סטודנט</th>
                  <th className={studentStyles.tableHeaderCell}>מצב</th>
                  <th className={studentStyles.tableHeaderCell}>פעולה מומלצת</th>
                  <th className={studentStyles.tableHeaderCell}>מעקב</th>
                  <th className={studentStyles.tableHeaderCell}>פעולות</th>
                </tr>
              </thead>
              <tbody className={studentStyles.tableBody}>
                {profiles.map((profile) => {
                  const pedagogicalSummary = getPedagogicalSummary(profile);
                  const summary = profile.adminSummary;
                  const weakTopicLabels = summary?.weakTopics.map((topic) => localizeTopicLabel(topic.label)) || [];
                  const riskLevel = summary?.riskSummary.level ?? profile.riskFactors.riskLevel;
                  const priority = getProfilePriority(profile);
                  return (
                    <tr key={profile._id} className={studentStyles.tableRow}>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.studentInfo}>
                          <div className={studentStyles.studentAvatar}>
                            <Users size={16} />
                          </div>
                          <div className={studentStyles.studentDetails}>
                            <div className={studentStyles.studentName}>{profile.name}</div>
                            <div className={studentStyles.studentEmail}>{profile.email}</div>
                            <div className={studentStyles.studentMetaLine}>
                              <span>מחזור {formatAcademicPeriod(summary?.academicPeriod)}</span>
                              <span>פעילות {formatCompactDate(profile.lastActivity)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.statusStack}>
                          <span className={`${studentStyles.priorityBadge} ${priority.className}`}>
                            {priority.label}
                          </span>
                          <span className={studentStyles.priorityDetail}>{priority.detail}</span>
                          <div className={studentStyles.inlineBadges}>
                            <span className={`${studentStyles.scoreBadge} ${getKnowledgeScoreClass(profile.knowledgeScore)}`}>
                              {formatKnowledgeScore(profile.knowledgeScore)}
                            </span>
                            <span className={`${studentStyles.riskBadge} ${getRiskClass(riskLevel)}`}>
                              {formatRiskLevel(riskLevel)}
                            </span>
                            {summary?.flags.needsReview ? (
                              <span className={studentStyles.reviewBadge}>דורש סקירה</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.summaryCell}>
                          <div className={studentStyles.recommendedAction}>
                            <Target size={14} />
                            <span>{summary?.recommendedAction || pedagogicalSummary.detail}</span>
                          </div>
                          <div className={studentStyles.summaryDetail}>
                            {weakTopicLabels.length > 0
                              ? `נושאים חלשים: ${weakTopicLabels.join(", ")}`
                              : summary?.riskSummary.reason || pedagogicalSummary.headline}
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.compactMetricGrid}>
                          <div className={studentStyles.compactMetric}>
                            <span>הגשות</span>
                            <strong>{formatHomeworkCompletion(summary)}</strong>
                          </div>
                          <div className={studentStyles.compactMetric}>
                            <span>ממוצע</span>
                            <strong>{formatScoreSummary(summary, profile.averageGrade)}</strong>
                          </div>
                          <div className={studentStyles.compactMetric}>
                            <span>חסרות</span>
                            <strong>{summary?.homeworkCompletion.missing ?? "אין נתון"}</strong>
                          </div>
                          <div className={studentStyles.compactMetric}>
                            <span>ראיות</span>
                            <strong>{summary ? summary.evidenceCounts.sourceTypes : "אין נתון"}</strong>
                          </div>
                          <div className={studentStyles.compactMetricWide}>
                            <span className={`${studentStyles.metaPill} ${getFreshnessClass(summary?.freshnessStatus)}`}>
                              {formatFreshnessLabel(summary?.freshnessStatus || "unknown")}
                            </span>
                            <small>חושב {formatCompactDate(summary?.lastCalculated)} · {formatScoreSource(summary)}</small>
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.actionsStack}>
                          <button
                            className={studentStyles.rowActionButton}
                            onClick={() => void openEvidenceConsole(profile)}
                            title="פתח פרופיל סטודנט"
                          >
                            <Eye size={16} />
                            פרופיל
                          </button>
                          <button
                            className={studentStyles.rowActionButton}
                            onClick={() => void handleAnalyzeIssues(profile)}
                            title="הרץ ניתוח ראיות"
                            disabled={actionLoading === `analyze:${profile.userId}`}
                          >
                            {actionLoading === `analyze:${profile.userId}` ? <RefreshCw size={16} /> : <AlertTriangle size={16} />}
                            נתח
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className={studentStyles.paginationSection}>
            <button
              className={studentStyles.paginationButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
            >
              הקודם
            </button>
            <span className={studentStyles.paginationInfo}>עמוד {currentPage} מתוך {totalPages}</span>
            <button
              className={studentStyles.paginationButton}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
            >
              הבא
            </button>
          </div>
        ) : null}
      </div>

      {selectedProfile && isMounted
        ? createPortal(
            <div
              className={studentStyles.drawerOverlay}
              onClick={() => {
                setSelectedProfile(null);
                setSelectedEvidence(null);
                setDrawerError(null);
              }}
            >
              <aside
                className={studentStyles.evidenceDrawer}
                onClick={(event) => event.stopPropagation()}
              >
            <div className={studentStyles.drawerHeader}>
              <div>
                <h3 className={studentStyles.drawerTitle}>פרופיל סטודנט: {selectedProfile.name}</h3>
                <p className={studentStyles.drawerSubtitle}>{selectedProfile.email}</p>
              </div>
              <button
                className={studentStyles.drawerCloseButton}
                onClick={() => {
                  setSelectedProfile(null);
                  setSelectedEvidence(null);
                  setDrawerError(null);
                }}
                aria-label="סגור"
              >
                <X size={18} />
              </button>
            </div>

            {drawerLoading ? <div className={studentStyles.loadingState}>טוען את קונסולת הראיות...</div> : null}
            {drawerError ? <div className={studentStyles.errorBanner}>{drawerError}</div> : null}

            {selectedEvidence ? (
              <div className={studentStyles.drawerContent}>
                <section className={`${studentStyles.consoleSection} ${studentStyles.overviewSection}`}>
                  <div className={studentStyles.consoleEyebrow}>תקציר למרצה</div>
                  <div className={studentStyles.overviewGrid}>
                    <div className={studentStyles.overviewLead}>
                      <h4>{localizeText(selectedEvidence.pedagogicalSummary.headline)}</h4>
                      <p>{localizeText(selectedEvidence.pedagogicalSummary.rationale)}</p>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>החולשה העיקרית כרגע</span>
                      <strong>{localizeTopicLabel(selectedEvidence.pedagogicalSummary.topWeakSkill)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>מחזור</span>
                      <strong>{formatAcademicPeriod(selectedEvidence.adminSummary.academicPeriod)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>השלמת מטלות</span>
                      <strong>{formatHomeworkCompletion(selectedEvidence.adminSummary)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>מצב פדגוגי כללי</span>
                      <strong>{formatRiskLevel(selectedEvidence.profile.riskFactors.riskLevel)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>ציון ממוצע אמין</span>
                      <strong>{formatScoreSummary(selectedEvidence.adminSummary, selectedEvidence.profile.averageGrade)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>מה מצב הראיות</span>
                      <strong>{formatFreshnessLabel(selectedEvidence.adminSummary.freshnessStatus)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>רמת ודאות</span>
                      <strong>{formatPercent(selectedEvidence.pedagogicalSummary.confidence)}</strong>
                    </div>
                  </div>
                  <div className={studentStyles.consoleMetaStack}>
                    <span className={studentStyles.metaPill}>
                      {selectedEvidence.evidenceConsole.issueDetections.filter((issue) => issue.status === "open").length} אותות פתוחים
                    </span>
                    <span className={studentStyles.metaPill}>
                      {selectedEvidence.evidenceConsole.recentFailedAttempts.length} ניסיונות אחרונים שנכשלו
                    </span>
                    <span
                      className={`${studentStyles.metaPill} ${getFreshnessTone(
                        selectedEvidence.pedagogicalSummary.freshnessLabel
                      )}`}
                    >
                      {formatFreshnessLabel(selectedEvidence.pedagogicalSummary.freshnessLabel)}
                    </span>
                    <span className={`${studentStyles.metaPill} ${getFreshnessClass(selectedEvidence.adminSummary.freshnessStatus)}`}>
                      חושב: {formatDate(selectedEvidence.adminSummary.lastCalculated)}
                    </span>
                    <span className={studentStyles.metaPill}>
                      ראיה אחרונה: {formatDate(selectedEvidence.adminSummary.lastEvidenceUpdate)}
                    </span>
                  </div>
                </section>

                <section className={`${studentStyles.consoleSection} ${studentStyles.actionSummarySection}`}>
                  <div className={studentStyles.sectionTitleRow}>
                    <h4>מה כדאי לעשות עכשיו</h4>
                    <span className={studentStyles.sectionHint}>2-3 פעולות ממוקדות למרצה</span>
                  </div>
                  <div className={studentStyles.actionSummaryList}>
                    {[selectedEvidence.adminSummary.recommendedAction, ...buildLecturerActionItems(selectedEvidence)]
                      .filter((item, index, allItems) => allItems.indexOf(item) === index)
                      .slice(0, 3)
                      .map((item) => (
                      <div key={item} className={studentStyles.actionSummaryItem}>
                        <Target size={16} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={studentStyles.consoleSection}>
                  <div className={studentStyles.sectionTitleRow}>
                    <h4>ראיות מרכזיות</h4>
                    <span className={studentStyles.sectionHint}>ראיות מרכזיות שאפשר גם לאשר או לדחות מתוכן</span>
                  </div>
                  <div className={studentStyles.cardList}>
                    {selectedEvidence.evidenceConsole.weakSkills.length === 0 ? (
                      <div className={studentStyles.emptyInlineState}>
                        <Info size={16} />
                        <span>אין מספיק נתונים כדי לקבוע חולשה מדודה. אפשר להריץ חישוב מחדש או לאסוף ניסיון נוסף.</span>
                      </div>
                    ) : selectedEvidence.evidenceConsole.weakSkills.map((skill) => (
                      <article key={skill.topic} className={studentStyles.consoleCard}>
                        <div className={studentStyles.cardHeader}>
                          <div>
                            <h5>{localizeTopicLabel(skill.label)}</h5>
                            <p>
                              שליטה {formatPercent(skill.mastery)} • ביטחון {formatPercent(skill.confidence)}
                            </p>
                          </div>
                          <span className={`${studentStyles.metaPill} ${getFreshnessTone(skill.freshnessLabel)}`}>
                            {formatFreshnessLabel(skill.freshnessLabel)}
                          </span>
                        </div>
                        <ul className={studentStyles.evidenceList}>
                          {skill.evidenceSummary.map((item) => (
                            <li key={item}>{localizeText(item)}</li>
                          ))}
                        </ul>
                        <div className={studentStyles.cardFooter}>
                          <span>עדכון אחרון: {formatDate(skill.lastEvidenceTime)}</span>
                          <div className={studentStyles.inlineActions}>
                            <button
                              className={studentStyles.successButton}
                              disabled={actionLoading === `confirm:${skill.topic}`}
                              onClick={() =>
                                void runAdminAction(
                                  {
                                    actionType: "confirm_weakness",
                                    topic: skill.topic,
                                    note: `אישור חולשה ממסך פרופיל הסטודנט: ${localizeTopicLabel(skill.label)}`,
                                  },
                                  `confirm:${skill.topic}`
                                )
                              }
                            >
                              <span aria-hidden="true">+</span>
                              אשר חולשה
                            </button>
                            <button
                              className={studentStyles.dangerButton}
                              disabled={actionLoading === `dismiss:${skill.topic}`}
                              onClick={() =>
                                void runAdminAction(
                                  {
                                    actionType: "dismiss_false_positive",
                                    topic: skill.topic,
                                    note: `דחייה כחיובי שגוי ממסך פרופיל הסטודנט: ${localizeTopicLabel(skill.label)}`,
                                  },
                                  `dismiss:${skill.topic}`
                                )
                              }
                            >
                              <XCircle size={14} />
                              דחה כחיובי שגוי
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <details className={studentStyles.detailsSection}>
                  <summary className={studentStyles.detailsSummary}>
                    <FileText size={16} />
                    ראיות נוספות: ניסיונות, רמזים, המלצות ועקיבות
                  </summary>
                  <section className={studentStyles.consoleSection}>
                  <h4>ניסיונות כושלים אחרונים</h4>
                  <div className={studentStyles.cardList}>
                    {selectedEvidence.evidenceConsole.recentFailedAttempts.length === 0 ? (
                      <div className={studentStyles.emptyInlineState}>
                        <FileText size={16} />
                        <span>לא נמצאו ניסיונות כושלים אחרונים שמגבים טענה פדגוגית.</span>
                      </div>
                    ) : selectedEvidence.evidenceConsole.recentFailedAttempts.map((attempt) => (
                      <article key={`${attempt.questionId}:${attempt.lastTriedAt}`} className={studentStyles.consoleCard}>
                        <div className={studentStyles.cardHeader}>
                          <div>
                            <h5>{attempt.homeworkTitle || "מטלה"} / {attempt.questionId}</h5>
                            <p>{localizeText(attempt.hintBurden)}</p>
                          </div>
                          <span className={studentStyles.metaPill}>{attempt.attempts} ניסיונות</span>
                        </div>
                        <div className={studentStyles.tagRow}>
                          {attempt.failureTags.map((tag) => (
                            <span key={tag} className={studentStyles.tag}>
                              {localizeText(tag)}
                            </span>
                          ))}
                        </div>
                        <div className={studentStyles.subtleBlock}>
                          {attempt.misconceptions.map((misconception) => (
                            <div key={misconception.label} className={studentStyles.misconceptionRow}>
                              <Bot size={14} />
                              <span>
                                {localizeText(misconception.studentLabel)} • ביטחון {formatPercent(misconception.confidence)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className={studentStyles.cardFooter}>
                          <span>מקור: הגשה / ניסיון רץ</span>
                          <span>עודכן: {formatDate(attempt.lastTriedAt)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                  </section>

                <section className={studentStyles.consoleGrid}>
                  <article className={studentStyles.consoleCard}>
                    <div className={studentStyles.cardHeader}>
                      <div>
                        <h5>דפוסי שימוש ברמזים</h5>
                        <p>האם הסטודנט פונה לעזרה מהר מדי או אחרי רצף כישלונות.</p>
                      </div>
                      <Wrench size={16} />
                    </div>
                    <div className={studentStyles.metricsGrid}>
                      <div>
                        <strong>{selectedEvidence.evidenceConsole.hintUsagePatterns.totalShowAnswerClicks}</strong>
                        <span>פתיחות רמז</span>
                      </div>
                      <div>
                        <strong>
                          {selectedEvidence.evidenceConsole.hintUsagePatterns.averageTimeToFirstHintMs
                            ? `${Math.round(
                                selectedEvidence.evidenceConsole.hintUsagePatterns.averageTimeToFirstHintMs / 60000
                              )} דק׳`
                            : "—"}
                        </strong>
                        <span>זמן ממוצע לרמז ראשון</span>
                      </div>
                      <div>
                        <strong>
                          {selectedEvidence.evidenceConsole.hintUsagePatterns.averageAttemptsBeforeHint ?? "—"}
                        </strong>
                        <span>ניסיונות לפני רמז</span>
                      </div>
                    </div>
                  </article>

                  <article className={studentStyles.consoleCard}>
                    <div className={studentStyles.cardHeader}>
                      <div>
                        <h5>מיסקונספציות מהצ׳אט ומהניתוח</h5>
                        <p>טעויות קונספטואליות שחזרו שוב ושוב, גם אם הניסוח השתנה.</p>
                      </div>
                      <Bot size={16} />
                    </div>
                    <div className={studentStyles.evidenceListCompact}>
                      {selectedEvidence.evidenceConsole.chatMisconceptions.length === 0 ? (
                        <div className={studentStyles.emptyInlineState}>
                          <Info size={16} />
                          <span>אין מיסקונספציות חוזרות שמגובות בצ׳אט או בניתוחים שהושלמו.</span>
                        </div>
                      ) : selectedEvidence.evidenceConsole.chatMisconceptions.map((item) => (
                        <div key={`${item.label}:${item.studentExplanation}`} className={studentStyles.miniCard}>
                          <strong>{localizeText(item.label)}</strong>
                          <span>{localizeText(item.studentExplanation)}</span>
                          <small>ביטחון {formatPercent(item.confidence)} • {item.topics.map((topic) => localizeTopicLabel(topic)).join(", ")}</small>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>

                <section className={studentStyles.consoleSection}>
                  <h4>היסטוריית המלצות</h4>
                  <div className={studentStyles.cardList}>
                    {selectedEvidence.evidenceConsole.recommendationHistory.length === 0 ? (
                      <div className={studentStyles.emptyInlineState}>
                        <Info size={16} />
                        <span>לא נמצאו המלצות קודמות לסטודנט הזה.</span>
                      </div>
                    ) : selectedEvidence.evidenceConsole.recommendationHistory.map((item) => (
                      <article key={item.recommendationId} className={studentStyles.consoleCard}>
                        <div className={studentStyles.cardHeader}>
                          <div>
                            <h5>{formatRecommendationType(item.recommendationType)}</h5>
                            <p>{localizeText(item.weakSkill || item.misconception || "ללא תיוג")}</p>
                          </div>
                          <span
                            className={`${studentStyles.metaPill} ${
                              item.outcome === "helpful"
                                ? studentStyles.outcomeHelpful
                                : item.outcome === "not_helpful"
                                  ? studentStyles.outcomeNotHelpful
                                  : studentStyles.outcomePending
                            }`}
                          >
                            {formatRecommendationOutcome(item.outcome)}
                          </span>
                        </div>
                        <div className={studentStyles.cardFooter}>
                          <span>הוצג: {formatDate(item.shownAt)}</span>
                          <span>אירוע אחרון: {formatDate(item.lastEventAt)}</span>
                        </div>
                        <div className={studentStyles.tagRow}>
                          {item.feedbackHistory.map((feedback) => (
                            <span key={`${item.recommendationId}:${feedback}`} className={studentStyles.tag}>
                              {localizeText(feedback)}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={studentStyles.consoleGrid}>
                  <article className={studentStyles.consoleCard}>
                    <div className={studentStyles.cardHeader}>
                      <div>
                        <h5>זיהויי בעיות</h5>
                        <p>אותות פתוחים או מטופלים, יחד עם החומרה, הביטחון ומקור הראיה.</p>
                      </div>
                      <AlertTriangle size={16} />
                    </div>
                    <div className={studentStyles.evidenceListCompact}>
                      {selectedEvidence.evidenceConsole.issueDetections.length === 0 ? (
                        <div className={studentStyles.emptyInlineState}>
                          <Info size={16} />
                          <span>אין אותות בעיה פתוחים או מטופלים בפרופיל.</span>
                        </div>
                      ) : selectedEvidence.evidenceConsole.issueDetections.map((issue) => (
                        <div key={issue.issueId} className={studentStyles.miniCard}>
                          <strong>{localizeText(issue.description)}</strong>
                          <span>
                            {formatSeverity(issue.severity)} • {formatIssueStatus(issue.status)} • ביטחון {formatPercent(issue.confidence)}
                          </span>
                          <small>{localizeText(issue.source || "לא ידוע")} • {formatFreshnessLabel(issue.freshnessLabel)}</small>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={studentStyles.consoleCard}>
                    <div className={studentStyles.cardHeader}>
                      <div>
                        <h5>עקיבות שדות</h5>
                        <p>מתי כל שדה התעדכן ומאילו מקורות.</p>
                      </div>
                      <Clock3 size={16} />
                    </div>
                    <div className={studentStyles.evidenceListCompact}>
                      {selectedEvidence.evidenceConsole.fieldTraceability.length === 0 ? (
                        <div className={studentStyles.emptyInlineState}>
                          <Clock3 size={16} />
                          <span>אין עקיבות שדות בפרופיל. מומלץ לחשב מחדש לפני שימוש בפרופיל.</span>
                        </div>
                      ) : selectedEvidence.evidenceConsole.fieldTraceability.map((trace) => (
                        <div key={trace.field} className={studentStyles.miniCard}>
                          <strong>{localizeText(trace.field)}</strong>
                          <span>
                            {trace.computedAt ? formatDate(trace.computedAt) : "לא זמין"} •{" "}
                            {trace.confidence === null ? "ללא ביטחון" : `ביטחון ${formatPercent(trace.confidence)}`}
                          </span>
                          <small>{trace.sources.map((source) => localizeText(source)).join(", ")}</small>
                          <ul className={studentStyles.evidenceList}>
                            {trace.evidencePreview.map((preview) => (
                              <li key={preview}>{localizeText(preview)}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
                </details>

                <section className={studentStyles.consoleSection}>
                  <div className={studentStyles.sectionTitleRow}>
                    <h4>פעולות מרצה</h4>
                    <span className={studentStyles.sectionHint}>הפעולות נכתבות לפרופיל ומשפיעות על מודל הלומד</span>
                  </div>
                  <div className={studentStyles.actionComposerGrid}>
                    <div className={studentStyles.actionComposer}>
                      <label htmlFor="intervention-draft">התערבות זמנית</label>
                      <textarea
                        id="intervention-draft"
                        value={interventionDraft}
                        onChange={(event) => setInterventionDraft(event.target.value)}
                        placeholder="למשל: השבוע לעבוד רק עם רמזים תמציתיים ולהתמקד בצירופי טבלאות."
                      />
                      <button
                        className={studentStyles.successButton}
                        disabled={!interventionDraft.trim() || actionLoading === "intervention"}
                        onClick={async () => {
                          await runAdminAction(
                            {
                              actionType: "set_temporary_intervention",
                              topic: activeWeakSkills[0]?.topic,
                              intervention: interventionDraft.trim(),
                              note: "התערבות זמנית ממסך פרופיל הסטודנט",
                            },
                            "intervention"
                          );
                          setInterventionDraft("");
                        }}
                      >
                        <Wrench size={14} />
                        שמור התערבות
                      </button>
                    </div>

                    <div className={studentStyles.actionComposer}>
                      <label htmlFor="goal-draft">מטרת סטודנט מסומנת</label>
                      <textarea
                        id="goal-draft"
                        value={goalDraft}
                        onChange={(event) => setGoalDraft(event.target.value)}
                        placeholder="למשל: לעבור למצב הכנה למבחן ולהתמקד בפתרון מהיר."
                      />
                      <button
                        className={studentStyles.successButton}
                        disabled={!goalDraft.trim() || actionLoading === "goal"}
                        onClick={async () => {
                          await runAdminAction(
                            {
                              actionType: "mark_student_goal",
                              goal: goalDraft.trim(),
                              note: "מטרה שסומנה ממסך פרופיל הסטודנט",
                            },
                            "goal"
                          );
                          setGoalDraft("");
                        }}
                      >
                        <Target size={14} />
                        סמן מטרה
                      </button>
                    </div>
                  </div>

                  <div className={studentStyles.inlineActions}>
                    <button
                      className={studentStyles.secondaryActionButton}
                      disabled={actionLoading === "recalibration"}
                      onClick={() =>
                        void runAdminAction(
                          {
                            actionType: "force_recalibration",
                            note: "כיול מחדש ממסך פרופיל הסטודנט",
                          },
                          "recalibration"
                        )
                      }
                    >
                      <RefreshCw size={14} />
                      כפה כיול מחדש
                    </button>
                    <button
                      className={studentStyles.secondaryActionButton}
                      disabled={actionLoading === `analyze:${selectedProfile.userId}`}
                      onClick={() => void handleAnalyzeIssues(selectedProfile)}
                    >
                      <Sparkles size={14} />
                      הרץ ניתוח בעיות נוסף
                    </button>
                  </div>

                  <div className={studentStyles.consoleGrid}>
                    <article className={studentStyles.consoleCard}>
                      <h5>התערבויות פעילות</h5>
                      <div className={studentStyles.evidenceListCompact}>
                        {(selectedEvidence.profile.adminOversight?.interventions || []).map((item) => (
                          <div key={item.id} className={studentStyles.miniCard}>
                            <strong>{localizeText(item.intervention)}</strong>
                            <span>{localizeTopicLabel(item.topic || "ללא נושא")}</span>
                            <small>{formatActionStatus(item.status)} • {item.expiresAt ? formatDate(item.expiresAt) : "ללא תפוגה"}</small>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className={studentStyles.consoleCard}>
                      <h5>מטרות שסומנו</h5>
                      <div className={studentStyles.evidenceListCompact}>
                        {(selectedEvidence.profile.adminOversight?.goalMarkers || []).map((item) => (
                          <div key={item.id} className={studentStyles.miniCard}>
                            <strong>{localizeText(item.goal)}</strong>
                            <span>{localizeText(item.note || "ללא הערה")}</span>
                            <small>{formatDate(item.createdAt)}</small>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </section>
              </div>
            ) : null}
              </aside>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
