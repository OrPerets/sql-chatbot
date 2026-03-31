"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Eye,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import styles from '../admin_page.module.css';
import studentStyles from './StudentProfiles.module.css';

interface StudentProfile {
  _id: string;
  userId: string;
  name?: string;
  email?: string;
  knowledgeScore: 'empty' | 'good' | 'needs_attention' | 'struggling';
  knowledgeScoreHistory: Array<{
    score: string;
    updatedAt: string;
    reason: string;
    updatedBy: string;
  }>;
  lastActivity: string;
  totalQuestions: number;
  correctAnswers: number;
  homeworkSubmissions: number;
  averageGrade: number;
  commonChallenges: string[];
  learningProgress: {
    sqlBasics: number;
    joins: number;
    aggregations: number;
    subqueries: number;
    advancedQueries: number;
  };
  engagementMetrics: {
    chatSessions: number;
    averageSessionDuration: number;
    helpRequests: number;
    selfCorrections: number;
  };
  riskFactors: {
    isAtRisk: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    riskFactors: string[];
    lastAssessment: string;
  };
  // New issue tracking fields
  issueCount: number;
  issueHistory: Array<{
    issueId: string;
    description: string;
    detectedAt: string;
    resolvedAt?: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  lastIssueUpdate: string;
}

interface StudentAnalytics {
  totalStudents: number;
  scoreDistribution: {
    empty: number;
    good: number;
    needs_attention: number;
    struggling: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  averageEngagement: number;
  averageGrade: number;
  topChallenges: string[];
}

interface StudentProfilesProps {
  onClose?: () => void;
}

interface StudentIssue {
  issueId: string;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  severity: 'low' | 'medium' | 'high';
}

interface StudentIssueHistoryResponse {
  totalIssues: number;
  unresolvedIssues: number;
  issueHistory: StudentIssue[];
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeIssue = (issue: Partial<StudentIssue>): StudentIssue => ({
  issueId: issue.issueId || `issue-${Math.random().toString(36).slice(2, 10)}`,
  description: issue.description || 'לא סופק תיאור לבעיה זו.',
  detectedAt: issue.detectedAt || new Date(0).toISOString(),
  resolvedAt: issue.resolvedAt,
  severity: issue.severity === 'high' || issue.severity === 'medium' ? issue.severity : 'low'
});

const normalizeProfile = (profile: StudentProfile): StudentProfile => ({
  ...profile,
  name: profile.name || 'ללא שם',
  email: profile.email || 'ללא אימייל',
  totalQuestions: toFiniteNumber(profile.totalQuestions),
  correctAnswers: toFiniteNumber(profile.correctAnswers),
  homeworkSubmissions: toFiniteNumber(profile.homeworkSubmissions),
  averageGrade: toFiniteNumber(profile.averageGrade),
  issueCount: toFiniteNumber(profile.issueCount),
  commonChallenges: Array.isArray(profile.commonChallenges) ? profile.commonChallenges : [],
  issueHistory: Array.isArray(profile.issueHistory) ? profile.issueHistory.map(normalizeIssue) : [],
  engagementMetrics: {
    chatSessions: toFiniteNumber(profile.engagementMetrics?.chatSessions),
    averageSessionDuration: toFiniteNumber(profile.engagementMetrics?.averageSessionDuration),
    helpRequests: toFiniteNumber(profile.engagementMetrics?.helpRequests),
    selfCorrections: toFiniteNumber(profile.engagementMetrics?.selfCorrections)
  },
  learningProgress: {
    sqlBasics: toFiniteNumber(profile.learningProgress?.sqlBasics),
    joins: toFiniteNumber(profile.learningProgress?.joins),
    aggregations: toFiniteNumber(profile.learningProgress?.aggregations),
    subqueries: toFiniteNumber(profile.learningProgress?.subqueries),
    advancedQueries: toFiniteNumber(profile.learningProgress?.advancedQueries)
  },
  riskFactors: {
    isAtRisk: Boolean(profile.riskFactors?.isAtRisk),
    riskLevel:
      profile.riskFactors?.riskLevel === 'high' || profile.riskFactors?.riskLevel === 'medium'
        ? profile.riskFactors.riskLevel
        : 'low',
    riskFactors: Array.isArray(profile.riskFactors?.riskFactors) ? profile.riskFactors.riskFactors : [],
    lastAssessment: profile.riskFactors?.lastAssessment || ''
  }
});

const normalizeAnalytics = (value: Partial<StudentAnalytics>): StudentAnalytics => ({
  totalStudents: toFiniteNumber(value.totalStudents),
  scoreDistribution: {
    empty: toFiniteNumber(value.scoreDistribution?.empty),
    good: toFiniteNumber(value.scoreDistribution?.good),
    needs_attention: toFiniteNumber(value.scoreDistribution?.needs_attention),
    struggling: toFiniteNumber(value.scoreDistribution?.struggling)
  },
  riskDistribution: {
    low: toFiniteNumber(value.riskDistribution?.low),
    medium: toFiniteNumber(value.riskDistribution?.medium),
    high: toFiniteNumber(value.riskDistribution?.high)
  },
  averageEngagement: toFiniteNumber(value.averageEngagement),
  averageGrade: toFiniteNumber(value.averageGrade),
  topChallenges: Array.isArray(value.topChallenges) ? value.topChallenges : []
});

const normalizeIssueHistoryResponse = (
  value: Partial<StudentIssueHistoryResponse>
): StudentIssueHistoryResponse => ({
  totalIssues: toFiniteNumber(value.totalIssues),
  unresolvedIssues: toFiniteNumber(value.unresolvedIssues),
  issueHistory: Array.isArray(value.issueHistory) ? value.issueHistory.map(normalizeIssue) : []
});

const StudentProfiles: React.FC<StudentProfilesProps> = ({ onClose }) => {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScore, setSelectedScore] = useState<string>('');
  const [selectedRisk, setSelectedRisk] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [conversationSummaries, setConversationSummaries] = useState<any[]>([]);
  const [showConversationInsights, setShowConversationInsights] = useState(false);
  const [showIssueHistory, setShowIssueHistory] = useState(false);
  const [selectedStudentIssues, setSelectedStudentIssues] = useState<StudentIssueHistoryResponse | null>(null);
  const [showChallengesPopup, setShowChallengesPopup] = useState(false);
  const [selectedStudentChallenges, setSelectedStudentChallenges] = useState<string[]>([]);

  // Show all students (including those with "ריק" scores)
  const filteredProfiles = profiles;

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedScore) params.append('knowledgeScore', selectedScore);
      if (selectedRisk) params.append('riskLevel', selectedRisk);

      const response = await fetch(`/api/admin/students?${params}`);
      const data = await response.json();

      if (data.success) {
        setProfiles((data.data.profiles || []).map(normalizeProfile));
        setTotalPages(data.data.totalPages || 1);
        setTotalStudents(data.data.total || 0);
      } else {
        setError(data.error || 'שגיאה בטעינת פרופילי התלמידים');
      }
    } catch (err) {
      setError('שגיאת רשת בטעינת הנתונים');
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedRisk, selectedScore]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/students/analytics');
      const data = await response.json();

      if (data.success) {
        setAnalytics(normalizeAnalytics(data.data));
      } else {
        console.error('Failed to fetch analytics:', data.error);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'needs_attention': return 'text-yellow-600 bg-yellow-100';
      case 'struggling': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'good': return <CheckCircle size={16} />;
      case 'needs_attention': return <Clock size={16} />;
      case 'struggling': return <AlertTriangle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const parsedDate = new Date(dateString);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'לא זמין';
    }

    return parsedDate.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateAccuracy = (correct: number, total: number) => {
    const safeCorrect = toFiniteNumber(correct);
    const safeTotal = toFiniteNumber(total);

    if (safeTotal <= 0) return 0;
    return Math.round((safeCorrect / safeTotal) * 100);
  };

  const formatDecimal = (value: unknown, digits = 1) => toFiniteNumber(value).toFixed(digits);

  const formatInteger = (value: unknown) => Math.round(toFiniteNumber(value)).toString();

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/students/export?format=excel&includeActivities=true');
      const data = await response.json();

      if (data.success) {
        // Create and download the file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'student-profiles-export.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Export failed: ' + data.error);
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed');
    }
  };

  const handleMigrate = async () => {
    try {
      const response = await fetch('/api/admin/students/migrate', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        alert(`Migration completed: ${data.data.migrated} users migrated`);
        fetchProfiles();
        fetchAnalytics();
      } else {
        alert('Migration failed: ' + data.error);
      }
    } catch (err) {
      console.error('Migration error:', err);
      alert('Migration failed');
    }
  };

  const fetchConversationSummaries = async (userId: string) => {
    try {
      const response = await fetch(`/api/conversation-summary/student/${userId}?insights=true`, {
        headers: {
          'x-user-id': userId,
        },
      });
      const data = await response.json();

      if (data.success) {
        setConversationSummaries(data.data.summaries || []);
        return data.data.insights;
      } else {
        console.error('Failed to fetch conversation summaries:', data.error);
        return null;
      }
    } catch (err) {
      console.error('Error fetching conversation summaries:', err);
      return null;
    }
  };

  const handleViewConversationInsights = async (profile: StudentProfile) => {
    setSelectedStudent(normalizeProfile(profile));
    setShowConversationInsights(true);
    await fetchConversationSummaries(profile.userId);
  };

  const handleCalculateProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/students/calculate-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`פרופילים חושבו בהצלחה! נוצרו ${data.data.created} פרופילים חדשים ועודכנו ${data.data.updated} פרופילים קיימים.`);
        fetchProfiles();
        fetchAnalytics();
      } else {
        alert('שגיאה בחישוב הפרופילים: ' + data.error);
      }
    } catch (err) {
      console.error('Error calculating profiles:', err);
      alert('שגיאה בחישוב הפרופילים');
    } finally {
      setLoading(false);
    }
  };

  const handleViewIssueHistory = async (profile: StudentProfile) => {
    try {
      console.log('Opening issue history for profile:', profile);
      
      // Convert userId to string if it's an ObjectId
      const userId = profile.userId?.toString ? profile.userId.toString() : profile.userId;
      console.log('Fetching issues for userId:', userId);
      
      const response = await fetch(`/api/admin/students/${userId}/issues`);
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        setSelectedStudentIssues(normalizeIssueHistoryResponse(data.data));
        setSelectedStudent(normalizeProfile(profile));
        setShowIssueHistory(true);
      } else {
        console.error('Error response:', data);
        alert('שגיאה בטעינת היסטוריית הבעיות: ' + data.error);
      }
    } catch (err) {
      console.error('Error fetching issue history:', err);
      alert('שגיאה בטעינת היסטוריית הבעיות');
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    if (!selectedStudent) return;
    
    try {
      const response = await fetch(`/api/admin/students/${selectedStudent.userId}/resolve-issue`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('בעיה נפתרה בהצלחה');
        // Refresh issue history
        await handleViewIssueHistory(selectedStudent);
        // Refresh profiles to update issue count
        fetchProfiles();
      } else {
        alert('שגיאה בפתרון הבעיה: ' + data.error);
      }
    } catch (err) {
      console.error('Error resolving issue:', err);
      alert('שגיאה בפתרון הבעיה');
    }
  };

  const handleAnalyzeIssues = async (profile: StudentProfile) => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/students/analyze-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: profile.userId,
          analysisType: 'manual',
          triggerReason: 'Manual analysis requested by admin'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('ניתוח הבעיות הושלם בהצלחה');
        fetchProfiles();
        fetchAnalytics();
      } else {
        alert('שגיאה בניתוח הבעיות: ' + data.error);
      }
    } catch (err) {
      console.error('Error analyzing issues:', err);
      alert('שגיאה בניתוח הבעיות');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChallenges = (profile: StudentProfile) => {
    if (profile.commonChallenges && profile.commonChallenges.length > 0) {
      setSelectedStudentChallenges(profile.commonChallenges);
      setSelectedStudent(normalizeProfile(profile));
      setShowChallengesPopup(true);
    }
  };

  if (loading && profiles.length === 0) {
    return (
      <div className={studentStyles.studentProfilesContainer}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="mr-2 text-gray-600">טוען פרופילי תלמידים...</span>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={studentStyles.studentProfilesContainer}>
      

      {/* Analytics Section */}
      {showAnalytics && analytics && (
        <div className={studentStyles.analyticsSection}>
            <div className={studentStyles.statCard}>
              <Users className={studentStyles.statIcon} />
              <div className={studentStyles.statNumber}>{formatInteger(analytics.totalStudents)}</div>
              <div className={studentStyles.statLabel}>סה&quot;כ תלמידים</div>
            </div>

            <div className={studentStyles.statCard}>
              <TrendingUp className={studentStyles.statIcon} />
              <div className={studentStyles.statNumber}>{formatDecimal(analytics.averageGrade)}</div>
              <div className={studentStyles.statLabel}>ציון ממוצע</div>
            </div>

            <div className={studentStyles.statCard}>
              <BarChart3 className={studentStyles.statIcon} />
              <div className={studentStyles.statNumber}>{formatDecimal(analytics.averageEngagement)}</div>
              <div className={studentStyles.statLabel}>ממוצע מעורבות</div>
            </div>

            <div className={studentStyles.statCard}>
              <AlertTriangle className={studentStyles.statIcon} />
              <div className={studentStyles.statNumber}>{formatInteger(analytics.riskDistribution.high)}</div>
              <div className={studentStyles.statLabel}>בסיכון גבוה</div>
            </div>
        </div>
      )}

      {/* Filters Section */}
      <div className={studentStyles.filtersSection}>
        {/* Force horizontal layout - search bar should be side by side */}
        <div className={studentStyles.searchContainer}>
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם או אימייל..."
            className={studentStyles.searchInput}
          />
        </div>

        <select
          value={selectedScore}
          onChange={(e) => setSelectedScore(e.target.value)}
          className={studentStyles.filterSelect}
        >
          <option value="">כל הציונים</option>
          <option value="empty">ריק</option>
          <option value="good">טוב</option>
          <option value="needs_attention">זקוק לתשומת לב</option>
          <option value="struggling">מתקשה</option>
        </select>

        <select
          value={selectedRisk}
          onChange={(e) => setSelectedRisk(e.target.value)}
          className={studentStyles.filterSelect}
        >
          <option value="">כל הרמות</option>
          <option value="low">נמוכה</option>
          <option value="medium">בינונית</option>
          <option value="high">גבוהה</option>
        </select>

        <button
          onClick={fetchProfiles}
          className={studentStyles.quickActionButton}
        >
          <RefreshCw size={16} />
          <div className={studentStyles.buttonContent}>
            <div className={studentStyles.buttonTitle}>רענן</div>
            <div className={studentStyles.buttonDescription}>רענן רשימת תלמידים</div>
          </div>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={studentStyles.errorContainer}>
          <AlertTriangle className={studentStyles.errorIcon} />
          <div>
            <h3 className="text-sm font-medium text-red-800">שגיאה</h3>
            <div className={studentStyles.errorMessage}>{error}</div>
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className={studentStyles.tableSection}>
        <div className={studentStyles.tableHeader}>
          <h3 className={studentStyles.tableTitle}>
            סטודנטים ({filteredProfiles.length})
          </h3>
          <button
            onClick={handleCalculateProfiles}
            className={studentStyles.headerActionButton}
          >
            <BarChart3 size={16} />
            <span>חשב פרופילים</span>
          </button>
        </div>

        {loading ? (
          <div className={studentStyles.loadingContainer}>
            <div className={studentStyles.loadingSpinner}></div>
            <span>טוען...</span>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className={studentStyles.emptyContainer}>
            <Users className={studentStyles.emptyIcon} />
            <div className={studentStyles.emptyMessage}>אין תלמידים</div>
            <div className={studentStyles.emptyMessage}>לא נמצאו תלמידים התואמים לקריטריונים שלך.</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={studentStyles.studentTable}>
                <thead>
                  <tr className={studentStyles.tableHeaderRow}>
                    <th className={`${studentStyles.tableHeaderCell} ${studentStyles.colStudent}`}>תלמיד</th>
                    <th className={`${studentStyles.tableHeaderCell} ${studentStyles.colKnowledgeScore}`}>ציון ידע</th>
                    <th className={`${studentStyles.tableHeaderCell} ${studentStyles.colIssues}`}>בעיות</th>
                    <th className={`${studentStyles.tableHeaderCell} ${studentStyles.colChallenges}`}>אתגרים נפוצים</th>
                    <th className={`${studentStyles.tableHeaderCell} ${studentStyles.colMetrics}`}>מדדים</th>
                    <th className={`${studentStyles.tableHeaderCell} ${studentStyles.colActions}`}>פעולות</th>
                  </tr>
                </thead>
                <tbody className={studentStyles.tableBody}>
                  {filteredProfiles.map((profile) => (
                    <tr key={profile._id} className={studentStyles.tableRow}>
                      <td className={`${studentStyles.tableCell} ${studentStyles.colStudent}`}>
                        <div className={studentStyles.studentInfo}>
                          <div className={studentStyles.studentAvatar}>
                            <Users className="h-4 w-4" />
                          </div>
                          <div className={studentStyles.studentDetails}>
                            <div className={studentStyles.studentName}>
                              {profile.name || 'ללא שם'}
                            </div>
                            <div className={studentStyles.studentEmail}>
                              {profile.email || 'ללא אימייל'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`${studentStyles.tableCell} ${studentStyles.colKnowledgeScore}`}>
                        <div className={`${studentStyles.knowledgeScore} ${studentStyles[`score${profile.knowledgeScore.charAt(0).toUpperCase() + profile.knowledgeScore.slice(1).replace('_', '')}`]}`}>
                          {getScoreIcon(profile.knowledgeScore)}
                          <span>
                            {profile.knowledgeScore === 'empty' ? 'ריק' :
                             profile.knowledgeScore === 'good' ? 'טוב' :
                             profile.knowledgeScore === 'needs_attention' ? 'זקוק לתשומת לב' : 'מתקשה'}
                          </span>
                        </div>
                      </td>
                      <td className={`${studentStyles.tableCell} ${studentStyles.colIssues}`}>
                        <div className={studentStyles.issuesContainer}>
                          <div className={studentStyles.issueCounter}>
                            <span className={studentStyles.issueCount}>
                              {profile.issueCount || 0}
                            </span>
                            <span className={studentStyles.issueLabel}>בעיות</span>
                          </div>
                          {profile.issueCount > 0 && (
                            <button
                              onClick={() => handleViewIssueHistory(profile)}
                              className={studentStyles.viewIssuesButton}
                              title="צפה בהיסטוריית בעיות"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={`${studentStyles.tableCell} ${studentStyles.colChallenges}`}>
                        <div className={studentStyles.challengesContainer}>
                          {profile.commonChallenges && profile.commonChallenges.length > 0 ? (
                            <button
                              onClick={() => handleViewChallenges(profile)}
                              className={studentStyles.challengesButton}
                              title="לחץ לצפייה בכל האתגרים"
                            >
                              <div className={studentStyles.challengesButtonContent}>
                                <span className={studentStyles.challengesCount}>
                                  {profile.commonChallenges.length}
                                </span>
                                <span className={studentStyles.challengesLabel}>אתגרים</span>
                              </div>
                            </button>
                          ) : (
                            <span className="text-gray-400">אין אתגרים זמינים</span>
                          )}
                        </div>
                      </td>
                      <td className={`${studentStyles.tableCell} ${studentStyles.colMetrics}`}>
                        <div className={studentStyles.metricsContainer}>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>דיוק:</span>
                            <span className={studentStyles.metricValue}>{calculateAccuracy(profile.correctAnswers, profile.totalQuestions)}%</span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>ממוצע:</span>
                            <span className={studentStyles.metricValue}>{formatDecimal(profile.averageGrade)}</span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>שיחות:</span>
                            <span className={studentStyles.metricValue}>{formatInteger(profile.engagementMetrics.chatSessions)}</span>
                          </div>
                          <div className={studentStyles.metricRow}>
                            <span className={studentStyles.metricLabel}>ממוצע זמן:</span>
                            <span className={studentStyles.metricValue}>{formatDecimal(profile.engagementMetrics.averageSessionDuration)} דק&apos;</span>
                          </div>
                        </div>
                      </td>
                      <td className={`${studentStyles.tableCell} ${studentStyles.colActions}`}>
                        <div className={studentStyles.actions}>
                          <button 
                            onClick={() => handleAnalyzeIssues(profile)}
                            className={studentStyles.actionButton}
                            title="נתח בעיות"
                          >
                            <AlertTriangle size={14} />
                          </button>
                          <button 
                            onClick={() => handleViewConversationInsights(profile)}
                            className={studentStyles.actionButton}
                            title="צפה בתובנות שיחה"
                          >
                            <BarChart3 size={14} />
                          </button>
                          <button 
                            className={studentStyles.actionButton}
                            title="צפה בפרטים"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            className={studentStyles.actionButton}
                            title="ערוך"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={studentStyles.paginationSection}>
                <div className={studentStyles.paginationInfo}>
                  מציג <span className="font-medium">{(currentPage - 1) * 20 + 1}</span> עד{' '}
                  <span className="font-medium">{Math.min(currentPage * 20, filteredProfiles.length)}</span> מתוך{' '}
                  <span className="font-medium">{filteredProfiles.length}</span> תוצאות
                </div>
                <div className={studentStyles.paginationControls}>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={studentStyles.paginationButton}
                      >
                        הקודם
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`${studentStyles.paginationButton} ${currentPage === page ? studentStyles.active : ''}`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className={studentStyles.paginationButton}
                      >
                        הבא
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Conversation Insights Modal */}
      {showConversationInsights && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  תובנות שיחה - {selectedStudent.name || selectedStudent.email}
                </h3>
                <button
                  onClick={() => setShowConversationInsights(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="סגור חלון"
                >
                  <span className="text-sm font-medium ml-2">סגור</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Conversation Summaries */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">סיכומי שיחות אחרונות</h4>
                {conversationSummaries.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    אין סיכומי שיחות זמינים עבור תלמיד זה
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversationSummaries.slice(0, 5).map((summary, index) => (
                      <div key={summary._id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{summary.sessionTitle}</h5>
                          <span className="text-sm text-gray-500">
                            {new Date(summary.createdAt).toLocaleDateString('he-IL')}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <h6 className="text-sm font-medium text-gray-700 mb-1">תובנות עיקריות:</h6>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {summary.summaryPoints.map((point: string, pointIndex: number) => (
                              <li key={pointIndex} className="flex items-start">
                                <span className="text-blue-500 mr-2">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">נושאים:</span>
                            <div className="text-gray-600">
                              {summary.keyTopics.join(', ')}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">רמת הבנה:</span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              summary.learningIndicators.comprehensionLevel === 'high' ? 'bg-green-100 text-green-800' :
                              summary.learningIndicators.comprehensionLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {summary.learningIndicators.comprehensionLevel === 'high' ? 'גבוהה' :
                               summary.learningIndicators.comprehensionLevel === 'medium' ? 'בינונית' : 'נמוכה'}
                            </span>
                          </div>
                        </div>

                        {summary.learningIndicators.challengeAreas.length > 0 && (
                          <div className="mt-3">
                            <span className="text-sm font-medium text-gray-700">אזורי אתגר:</span>
                            <div className="text-sm text-gray-600 mt-1">
                              {summary.learningIndicators.challengeAreas.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Issue History Modal */}
      {showIssueHistory && selectedStudent && selectedStudentIssues && (
        <div className={studentStyles.modalOverlay}>
          <div className={studentStyles.modalContainer}>
            <div className={studentStyles.modalContent}>
              <div className={studentStyles.modalHeader}>
                <h3 className={studentStyles.modalTitle}>
                  היסטוריית בעיות - {selectedStudent.name || selectedStudent.email}                                                                             
                </h3>
                <button
                  onClick={() => setShowIssueHistory(false)}
                  className={studentStyles.modalCloseButton}
                  aria-label="סגור חלון"
                >
                  <span className={studentStyles.modalCloseText}>סגור</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">                                                               
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />                                              
                  </svg>
                </button>
              </div>

              {/* Issue Content Wrapper */}
              <div className={studentStyles.issueHistoryContent}>
              {/* Issue Summary */}
              <div className={studentStyles.issueSummaryGrid}>
                <div className={studentStyles.issueSummaryCard}>
                  <div className={studentStyles.issueSummaryValue}>{formatInteger(selectedStudentIssues.totalIssues)}</div>
                  <div className={studentStyles.issueSummaryLabel}>סה&quot;כ בעיות</div>
                </div>
                <div className={`${studentStyles.issueSummaryCard} ${studentStyles.issueSummaryCardAlert}`}>
                  <div className={studentStyles.issueSummaryValue}>{formatInteger(selectedStudentIssues.unresolvedIssues)}</div>
                  <div className={studentStyles.issueSummaryLabel}>בעיות לא פתורות</div>
                </div>
                <div className={`${studentStyles.issueSummaryCard} ${studentStyles.issueSummaryCardSuccess}`}>
                  <div className={studentStyles.issueSummaryValue}>
                    {formatInteger(selectedStudentIssues.totalIssues - selectedStudentIssues.unresolvedIssues)}
                  </div>
                  <div className={studentStyles.issueSummaryLabel}>בעיות פתורות</div>
                </div>
              </div>

              {/* Issue History */}
              <div className={studentStyles.issueTimelineSection}>
                <div className={studentStyles.issueTimelineHeader}>
                  <h4 className={studentStyles.issueTimelineTitle}>היסטוריית בעיות</h4>
                  <p className={studentStyles.issueTimelineDescription}>
                    סקירה מרוכזת של האיתורים האחרונים והטיפול בהם.
                  </p>
                </div>
                {selectedStudentIssues.issueHistory.length === 0 ? (
                  <div className={studentStyles.issueEmptyState}>
                    אין בעיות זמינות עבור תלמיד זה
                  </div>
                ) : (
                  <div className={studentStyles.issueTimelineList}>
                    {selectedStudentIssues.issueHistory.map((issue) => (
                      <article
                        key={issue.issueId}
                        className={`${studentStyles.issueCard} ${
                          issue.resolvedAt
                            ? studentStyles.issueResolved
                            : issue.severity === 'high'
                              ? studentStyles.issueHigh
                              : issue.severity === 'medium'
                                ? studentStyles.issueMedium
                                : studentStyles.issueLow
                        }`}
                      >
                        <div className={studentStyles.issueCardHeader}>
                          <div className={studentStyles.issueBadgeGroup}>
                            <span className={`${studentStyles.issueBadge} ${studentStyles[`severity${issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}`]}`}>
                                {issue.severity === 'high' ? 'גבוהה' :
                                 issue.severity === 'medium' ? 'בינונית' : 'נמוכה'}
                            </span>
                            <span className={`${studentStyles.issueBadge} ${issue.resolvedAt ? studentStyles.issueStatusResolved : studentStyles.issueStatusOpen}`}>
                              {issue.resolvedAt ? 'נפתרה' : 'פתוחה'}
                            </span>
                          </div>
                          {!issue.resolvedAt && (
                            <button
                              onClick={() => handleResolveIssue(issue.issueId)}
                              className={studentStyles.resolveIssueButton}
                            >
                              סמן כנפתרה
                            </button>
                          )}
                        </div>

                        <p className={studentStyles.issueDescription}>{issue.description}</p>

                        <div className={studentStyles.issueMetaGrid}>
                          <div className={studentStyles.issueMetaItem}>
                            <span className={studentStyles.issueMetaLabel}>זוהתה</span>
                            <span className={studentStyles.issueMetaValue}>{formatDate(issue.detectedAt)}</span>
                          </div>
                          {issue.resolvedAt && (
                            <div className={studentStyles.issueMetaItem}>
                              <span className={studentStyles.issueMetaLabel}>נפתרה</span>
                              <span className={studentStyles.issueMetaValue}>{formatDate(issue.resolvedAt)}</span>
                            </div>
                          )}
                          <div className={studentStyles.issueMetaItem}>
                            <span className={studentStyles.issueMetaLabel}>מזהה</span>
                            <span className={studentStyles.issueMetaValue}>{issue.issueId}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Challenges Popup Modal */}
      {showChallengesPopup && selectedStudent && (
        <div className={studentStyles.modalOverlay}>
          <div className={studentStyles.modalContainer}>
            <div className={studentStyles.modalContent}>
              <div className={studentStyles.modalHeader}>
                <h3 className={studentStyles.modalTitle}>
                  אתגרים נפוצים - {selectedStudent.name || selectedStudent.email}
                </h3>
                <button
                  onClick={() => setShowChallengesPopup(false)}
                  className={studentStyles.modalCloseButton}
                  aria-label="סגור חלון"
                >
                  <span className={studentStyles.modalCloseText}>סגור</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Challenges List */}
              <div className={studentStyles.challengesModalContent}>
                <div className={studentStyles.challengesSummary}>
                  <div className={studentStyles.challengesSummaryIcon}>
                    <AlertTriangle size={20} />
                  </div>
                  <div className={studentStyles.challengesSummaryText}>
                    <span className={studentStyles.challengesSummaryCount}>{selectedStudentChallenges.length}</span>
                    <span className={studentStyles.challengesSummaryLabel}>אתגרים זוהו עבור תלמיד זה</span>
                  </div>
                </div>
                
                <div className={studentStyles.challengesList}>
                  {selectedStudentChallenges.map((challenge, index) => (
                    <div key={index} className={studentStyles.challengeCard}>
                      <div className={studentStyles.challengeNumber}>
                        {index + 1}
                      </div>
                      <div className={studentStyles.challengeContent}>
                        <p className={studentStyles.challengeText}>{challenge}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default StudentProfiles;
