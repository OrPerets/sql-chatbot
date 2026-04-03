"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Clock3,
  Eye,
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

import studentStyles from "./StudentProfiles.module.css";

type KnowledgeScore = "empty" | "good" | "needs_attention" | "struggling";

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
}

interface StudentAnalytics {
  totalStudents: number;
  scoreDistribution: Record<KnowledgeScore, number>;
  riskDistribution: Record<"low" | "medium" | "high", number>;
  averageEngagement: number;
  averageGrade: number;
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
  joins: "לוגיקת JOIN",
  "JOIN logic": "לוגיקת JOIN",
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
    [/No hint reliance recorded\.?/gi, "לא זוהתה הסתמכות על רמזים."],
    [/(\d+)\s+hint opens recorded\.?/gi, "תועדו $1 פתיחות רמז."],
    [/(\d+)\s+hint opens, first after about\s+(\d+)\s+minutes\.?/gi, "$1 פתיחות רמז, והרמז הראשון נפתח אחרי כ-$2 דקות."],
    [/Confidence\s+(\d+)%\.?/gi, "רמת ביטחון $1%."],
    [/ai_analysis/gi, "ניתוח AI"],
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
  if (value === "fresh") return "עדכני";
  if (value === "aging") return "מתיישן";
  if (value === "stale") return "התיישן";
  return "לא ידוע";
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
  const [isMounted, setIsMounted] = useState(false);
  const [profiles, setProfiles] = useState<StudentProfileRow[]>([]);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScore, setSelectedScore] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("");
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
  }, [currentPage, searchTerm, selectedRisk, selectedScore]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/students/analytics");
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
      });
    } catch (fetchError) {
      console.error("Failed to fetch analytics:", fetchError);
    }
  }, []);

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
      const response = await fetch(`/api/admin/students/${profile.userId}`);
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
  }, []);

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
        const response = await fetch(`/api/admin/students/${selectedProfile.userId}`, {
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
        await fetchProfiles();
      } catch (actionError) {
        console.error("Failed to apply admin oversight action:", actionError);
        alert("שגיאה בביצוע הפעולה.");
      } finally {
        setActionLoading(null);
      }
    },
    [fetchProfiles, selectedProfile]
  );

  const handleAnalyzeIssues = useCallback(async (profile: StudentProfileRow) => {
    try {
      setActionLoading(`analyze:${profile.userId}`);
      const response = await fetch("/api/admin/students/analyze-issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: profile.userId,
          analysisType: "manual",
          triggerReason: "Manual analysis requested by admin evidence console",
        }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || "הניתוח לא הושלם.");
        return;
      }

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
  }, [fetchProfiles, refreshSelectedEvidence, selectedProfile?.userId]);

  const handleCalculateProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/students/calculate-profiles", {
        method: "POST",
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || "חישוב הפרופילים נכשל.");
        return;
      }

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
    }
  }, [fetchAnalytics, fetchProfiles, refreshSelectedEvidence, selectedProfile]);

  const activeWeakSkills = useMemo(
    () => selectedEvidence?.evidenceConsole.weakSkills || [],
    [selectedEvidence]
  );

  return (
    <div className={studentStyles.studentProfilesContainer}>
      <div className={studentStyles.analyticsSection}>
        <div className={studentStyles.statCard}>
          <Users className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{analytics?.totalStudents ?? profiles.length}</div>
          <div className={studentStyles.statLabel}>סה&quot;כ סטודנטים</div>
        </div>
        <div className={studentStyles.statCard}>
          <TrendingUp className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{toFiniteNumber(analytics?.averageGrade).toFixed(1)}</div>
          <div className={studentStyles.statLabel}>ציון ממוצע</div>
        </div>
        <div className={studentStyles.statCard}>
          <ShieldAlert className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{analytics?.riskDistribution.high ?? 0}</div>
          <div className={studentStyles.statLabel}>בסיכון גבוה</div>
        </div>
        <div className={studentStyles.statCard}>
          <Sparkles className={studentStyles.statIcon} />
          <div className={studentStyles.statNumber}>{toFiniteNumber(analytics?.averageEngagement).toFixed(1)}</div>
          <div className={studentStyles.statLabel}>מעורבות ממוצעת</div>
        </div>
      </div>

      <div className={studentStyles.filtersSection}>
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

        <button onClick={() => void fetchProfiles()} className={studentStyles.quickActionButton}>
          <RefreshCw size={16} />
          <div className={studentStyles.buttonContent}>
            <div className={studentStyles.buttonTitle}>רענון</div>
            <div className={studentStyles.buttonDescription}>טען מחדש את רשימת הסטודנטים</div>
          </div>
        </button>

        <button onClick={() => void handleCalculateProfiles()} className={studentStyles.headerActionButton}>
          <BarChart3 size={16} />
          <span>חישוב מחדש</span>
        </button>

        {onClose ? (
          <button onClick={onClose} className={studentStyles.secondaryActionButton}>
            <X size={16} />
            <span>סגור</span>
          </button>
        ) : null}
      </div>

      {error ? <div className={studentStyles.errorBanner}>{error}</div> : null}

      <div className={studentStyles.tableSection}>
        <div className={studentStyles.tableHeader}>
          <h3 className={studentStyles.tableTitle}>פרופילי סטודנטים למרצה</h3>
          <p className={studentStyles.tableSubtitle}>
            הטבלה מציגה סיכום פדגוגי, לא רק ספירת בעיות. פתחו את קונסולת הראיות כדי לראות בדיוק למה הסטודנט סומן ומה כדאי לעשות.
          </p>
        </div>

        {loading ? (
          <div className={studentStyles.loadingState}>טוען נתונים...</div>
        ) : (
          <div className={studentStyles.tableWrap}>
            <table className={studentStyles.studentTable}>
              <thead>
                <tr className={studentStyles.tableHeaderRow}>
                  <th className={studentStyles.tableHeaderCell}>סטודנט</th>
                  <th className={studentStyles.tableHeaderCell}>סיכום פדגוגי</th>
                  <th className={studentStyles.tableHeaderCell}>דיוק ופעילות</th>
                  <th className={studentStyles.tableHeaderCell}>פעולות</th>
                </tr>
              </thead>
              <tbody className={studentStyles.tableBody}>
                {profiles.map((profile) => {
                  const pedagogicalSummary = getPedagogicalSummary(profile);
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
                            <div className={studentStyles.inlineBadges}>
                              <span className={`${studentStyles.scoreBadge} ${getKnowledgeScoreClass(profile.knowledgeScore)}`}>
                                {formatKnowledgeScore(profile.knowledgeScore)}
                              </span>
                              <span className={studentStyles.riskBadge}>{formatRiskLevel(profile.riskFactors.riskLevel)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.summaryCell}>
                          <div className={studentStyles.summaryHeadline}>{pedagogicalSummary.headline}</div>
                          <div className={studentStyles.summaryDetail}>{pedagogicalSummary.detail}</div>
                          <div className={studentStyles.summaryFooter}>
                            <span>אתגרים: {profile.commonChallenges.slice(0, 2).map((item) => localizeText(item)).join(", ") || "אין"}</span>
                            <span>התראות פתוחות: {profile.issueCount}</span>
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.metricsContainer}>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>דיוק</span>
                            <span className={studentStyles.metricValue}>
                              {formatAccuracy(profile.correctAnswers, profile.totalQuestions)}
                            </span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>ממוצע</span>
                            <span className={studentStyles.metricValue}>{profile.averageGrade.toFixed(1)}</span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>שיחות</span>
                            <span className={studentStyles.metricValue}>{profile.engagementMetrics.chatSessions}</span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>עזרה</span>
                            <span className={studentStyles.metricValue}>{profile.engagementMetrics.helpRequests}</span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>פעילות אחרונה</span>
                            <span className={studentStyles.metricValue}>{formatDate(profile.lastActivity)}</span>
                          </div>
                        </div>
                      </td>
                      <td className={studentStyles.tableCell}>
                        <div className={studentStyles.actions}>
                          <button
                            className={studentStyles.actionButton}
                            onClick={() => void openEvidenceConsole(profile)}
                            title="פתח קונסולת ראיות"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className={studentStyles.actionButton}
                            onClick={() => void handleAnalyzeIssues(profile)}
                            title="הרץ ניתוח בעיות"
                            disabled={actionLoading === `analyze:${profile.userId}`}
                          >
                            <AlertTriangle size={16} />
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
                <h3 className={studentStyles.drawerTitle}>קונסולת ראיות: {selectedProfile.name}</h3>
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
                  <div className={studentStyles.consoleEyebrow}>תקציר על</div>
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
                      <span className={studentStyles.overviewMetricLabel}>מה מצב הראיות</span>
                      <strong>{formatFreshnessLabel(selectedEvidence.pedagogicalSummary.freshnessLabel)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>רמת ודאות</span>
                      <strong>{formatPercent(selectedEvidence.pedagogicalSummary.confidence)}</strong>
                    </div>
                    <div className={studentStyles.overviewMetric}>
                      <span className={studentStyles.overviewMetricLabel}>מצב פדגוגי כללי</span>
                      <strong>{formatRiskLevel(selectedEvidence.profile.riskFactors.riskLevel)}</strong>
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
                  </div>
                </section>

                <section className={`${studentStyles.consoleSection} ${studentStyles.actionSummarySection}`}>
                  <div className={studentStyles.sectionTitleRow}>
                    <h4>מה כדאי לעשות עכשיו</h4>
                    <span className={studentStyles.sectionHint}>2-3 פעולות ממוקדות למרצה</span>
                  </div>
                  <div className={studentStyles.actionSummaryList}>
                    {buildLecturerActionItems(selectedEvidence).map((item) => (
                      <div key={item} className={studentStyles.actionSummaryItem}>
                        <Target size={16} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={studentStyles.consoleSection}>
                  <div className={studentStyles.sectionTitleRow}>
                    <h4>למה אנחנו חושבים כך</h4>
                    <span className={studentStyles.sectionHint}>ראיות מרכזיות שאפשר גם לאשר או לדחות מתוכן</span>
                  </div>
                  <div className={studentStyles.cardList}>
                    {selectedEvidence.evidenceConsole.weakSkills.map((skill) => (
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
                                    note: `Confirmed from admin evidence console for ${skill.label}`,
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
                                    note: `Dismissed as false positive from admin evidence console for ${skill.label}`,
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

                <section className={studentStyles.consoleSection}>
                  <h4>ניסיונות אחרונים שנכשלו</h4>
                  <div className={studentStyles.cardList}>
                    {selectedEvidence.evidenceConsole.recentFailedAttempts.map((attempt) => (
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
                        <p>כאן רואים אם הסטודנט ניגש מהר מדי לעזרה או רק אחרי רצף כשלונות.</p>
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
                      {selectedEvidence.evidenceConsole.chatMisconceptions.map((item) => (
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
                    {selectedEvidence.evidenceConsole.recommendationHistory.map((item) => (
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
                      {selectedEvidence.evidenceConsole.issueDetections.map((issue) => (
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
                        <p>מתי כל שדה התעדכן, מאילו מקורות, ומה היו הראיות הקצרות שהשפיעו עליו.</p>
                      </div>
                      <Clock3 size={16} />
                    </div>
                    <div className={studentStyles.evidenceListCompact}>
                      {selectedEvidence.evidenceConsole.fieldTraceability.map((trace) => (
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

                <section className={studentStyles.consoleSection}>
                  <div className={studentStyles.sectionTitleRow}>
                    <h4>פעולות אדמין</h4>
                    <span className={studentStyles.sectionHint}>הפעולות נכתבות לפרופיל ומשפיעות על מודל הלומד</span>
                  </div>
                  <div className={studentStyles.actionComposerGrid}>
                    <div className={studentStyles.actionComposer}>
                      <label htmlFor="intervention-draft">התערבות זמנית</label>
                      <textarea
                        id="intervention-draft"
                        value={interventionDraft}
                        onChange={(event) => setInterventionDraft(event.target.value)}
                        placeholder="למשל: לעבוד השבוע רק עם רמזים תמציתיים ולהתמקד ב-JOINs."
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
                              note: "Temporary intervention from admin evidence console",
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
                              note: "Marked from admin evidence console",
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
                            note: "Forced from admin evidence console",
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
