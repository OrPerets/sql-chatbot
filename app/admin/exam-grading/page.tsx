"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Clock, User, CheckCircle, XCircle, AlertTriangle, AlertCircle, Info, Download } from 'lucide-react';
import styles from './page.module.css';
import { analyzeExamForAI, getSuspicionColor, getSuspicionIcon } from '../../utils/trapDetector';

interface ExamSession {
  _id: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed' | 'timeout';
  score?: number;
  totalQuestions: number;
  totalPoints?: number;
  graded?: boolean;
  aiAnalysis?: {
    isExamSuspicious: boolean;
    totalSuspiciousAnswers: number;
    averageSuspicionScore: number;
    maxSuspicionScore: number;
    summary: string;
  };
}

const ExamGradingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'moed-a' | 'moed-b' | null>(null);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter out lecturers and assistants
  const EXCLUDED_USERS = new Set([
    "304993082", // אור פרץ
    "315661033", // נעם ניר  
    "035678622"  // רואי זרחיה
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'timeout' | 'ai_suspicious'>('all');
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Set<string>>(new Set());
  const [bulkAnalysisLoading, setBulkAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [sortBy, setSortBy] = useState<'grade' | 'totalPoints' | 'date' | 'name'>('totalPoints');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State for actual graded scores (final scores after manual grading)
  const [actualGradedScores, setActualGradedScores] = useState<{[examId: string]: number}>({});
  
  // State for loading graded scores
  const [loadingGrades, setLoadingGrades] = useState<Set<string>>(new Set());
  
  // State for new statistics
  const [statisticsData, setStatisticsData] = useState<{
    averageGrade: number;
    standardDeviation: number;
    failurePercentage: number;
    averageTime: number;
  }>({
    averageGrade: 0,
    standardDeviation: 0,
    failurePercentage: 0,
    averageTime: 0
  });
  
  // State for report generation loading
  const [reportLoading, setReportLoading] = useState<Set<string>>(new Set());
  
  // State for bulk export operations
  const [bulkExportLoading, setBulkExportLoading] = useState<{
    grades: boolean;
    reports: boolean;
  }>({
    grades: false,
    reports: false
  });
  
  const router = useRouter();

  // Helper function to filter out lecturers and assistants
  const filterOutStaff = (sessions: ExamSession[]) => {
    const originalCount = sessions.length;
    const filtered = sessions.filter(session => {
      // Check both studentId and studentEmail for exclusion
      const studentId = session.studentId;
      const studentEmail = session.studentEmail;
      
      // Filter by student ID if available
      if (studentId && EXCLUDED_USERS.has(studentId)) {
        console.log(`🚫 Filtered out lecturer/assistant: ${session.studentName || 'Unknown'} (ID: ${studentId})`);
        return false;
      }
      
      // Also filter by email patterns for these specific users
      if (studentEmail) {
        const email = studentEmail.toLowerCase();
        if (email.includes('or.perez') || 
            email.includes('orperez') ||
            email.includes('roey.zarchia') ||
            email.includes('roeyza') ||
            email.includes('nir.naam') ||
            email.includes('naam')) {
          console.log(`🚫 Filtered out lecturer/assistant by email: ${session.studentName || 'Unknown'} (${studentEmail})`);
          return false;
        }
      }
      
      return true;
    });
    
    const filteredCount = filtered.length;
    console.log(`👥 Staff filtering: ${originalCount} → ${filteredCount} exams (removed ${originalCount - filteredCount} staff members)`);
    
    return filtered;
  };

  // Calculate statistics for completed exams using actual graded scores
  const calculateStatistics = () => {
    const completedExams = examSessions.filter(session => 
      session.status === 'completed'
    );

    if (completedExams.length === 0) {
      setStatisticsData({
        averageGrade: 0,
        standardDeviation: 0,
        failurePercentage: 0,
        averageTime: 0
      });
      return;
    }

    // Use actual graded scores instead of initial session scores
    const scores = completedExams
      .map(session => actualGradedScores[session._id])
      .filter(score => score !== undefined && score !== null);
    
    if (scores.length === 0) {
      setStatisticsData({
        averageGrade: 0,
        standardDeviation: 0,
        failurePercentage: 0,
        averageTime: 0
      });
      return;
    }
    
    // Calculate average
    const averageGrade = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageGrade, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate failure percentage (using threshold of 60)
    const failedExams = scores.filter(score => score < 60).length;
    const failurePercentage = (failedExams / scores.length) * 100;
    
    // Calculate average time (in minutes)
    const examTimes = completedExams
      .filter(session => session.startTime && session.endTime)
      .map(session => {
        const startTime = new Date(session.startTime);
        const endTime = new Date(session.endTime!);
        return (endTime.getTime() - startTime.getTime()) / (1000 * 60); // Convert to minutes
      })
      .filter(time => time > 0 && time < 300); // Filter out invalid times (negative or > 5 hours)
    
    const averageTime = examTimes.length > 0 
      ? examTimes.reduce((sum, time) => sum + time, 0) / examTimes.length 
      : 0;
    
    setStatisticsData({
      averageGrade: Math.round(averageGrade * 10) / 10, // Round to 1 decimal place
      standardDeviation: Math.round(standardDeviation * 10) / 10,
      failurePercentage: Math.round(failurePercentage * 10) / 10,
      averageTime: Math.round(averageTime * 10) / 10
    });
  };

  // Restore active tab from session storage on load
  useEffect(() => {
    const savedTab = sessionStorage.getItem('examGradingActiveTab') as 'moed-a' | 'moed-b';
    if (savedTab && (savedTab === 'moed-a' || savedTab === 'moed-b')) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    // Only fetch data if a tab is selected
    if (activeTab) {
      fetchExamSessions();
    }
  }, [activeTab]);

  const fetchExamSessions = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'moed-a') {
        // Fetch from FinalExams collection (current implementation)
        const response = await fetch('/api/admin/final-exams');
        if (!response.ok) {
          // If FinalExams doesn't exist, initialize it first
          if (response.status === 500) {
            console.log('Initializing FinalExams collection...');
            const initResponse = await fetch('/api/admin/final-exams', {
              method: 'POST'
            });
            if (initResponse.ok) {
              // Try fetching again after initialization
              const retryResponse = await fetch('/api/admin/final-exams');
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                const sessions = data.exams || data;
                const filteredSessions = filterOutStaff(sessions);
                setExamSessions(filteredSessions);
                return;
              }
            }
          }
          throw new Error('Failed to fetch final exams');
        }
        const data = await response.json();
        const sessions = data.exams || data;
        const filteredSessions = filterOutStaff(sessions);
        setExamSessions(filteredSessions);
      } else if (activeTab === 'moed-b') {
        // Fetch from examSessions collection
        const response = await fetch('/api/admin/exam-sessions');
        if (!response.ok) {
          throw new Error('Failed to fetch exam sessions');
        }
        const sessions = await response.json();
        const filteredSessions = filterOutStaff(sessions);
        setExamSessions(filteredSessions);
      }
    } catch (err) {
      console.error('Error fetching exam data:', err);
      setError(`Failed to load ${activeTab === 'moed-a' ? 'final exams' : 'exam sessions'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className={styles.completedIcon} />;
      case 'in_progress':
        return <Clock size={16} className={styles.inProgressIcon} />;
      case 'timeout':
        return <XCircle size={16} className={styles.timeoutIcon} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'הושלם';
      case 'in_progress':
        return 'בתהליך';
      case 'timeout':
        return 'פג תוקף';
      default:
        return status;
    }
  };

  const filteredSessions = examSessions.filter(session => {
    const matchesSearch = 
      (session.studentEmail && session.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (session.studentName && session.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (session.studentId && session.studentId.includes(searchTerm));
    
    let matchesStatus = true;
    if (statusFilter === 'ai_suspicious') {
      matchesStatus = session.aiAnalysis?.isExamSuspicious === true;
    } else if (statusFilter !== 'all') {
      matchesStatus = session.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Sort the filtered sessions
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'grade':
        aValue = actualGradedScores[a._id] !== undefined ? actualGradedScores[a._id] : (a.score || 0);
        bValue = actualGradedScores[b._id] !== undefined ? actualGradedScores[b._id] : (b.score || 0);
        break;
      case 'totalPoints':
        aValue = actualGradedScores[a._id] || 0;
        bValue = actualGradedScores[b._id] || 0;
        break;
      case 'date':
        aValue = new Date(a.startTime).getTime();
        bValue = new Date(b.startTime).getTime();
        break;
      case 'name':
        aValue = a.studentName?.toLowerCase() || '';
        bValue = b.studentName?.toLowerCase() || '';
        // Handle string comparison separately
        if (sortOrder === 'desc') {
          return bValue.localeCompare(aValue);
        } else {
          return aValue.localeCompare(bValue);
        }
      default:
        aValue = 0;
        bValue = 0;
    }

    // Handle numeric comparison
    return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
  });

  const handleSort = (column: 'grade' | 'totalPoints' | 'date' | 'name') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: 'grade' | 'totalPoints' | 'date' | 'name') => {
    if (sortBy !== column) return null;
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  const handleGradeExam = (examId: string) => {
    // Store the current tab in session storage so we can return to the right tab
    if (activeTab) {
      sessionStorage.setItem('examGradingActiveTab', activeTab);
    }
    router.push(`/admin/exam-grading/${examId}`);
  };

  const handleDownloadReport = async (examId: string, studentName?: string, studentId?: string, format: 'print' | 'html' = 'print') => {
    // Add to loading state
    setReportLoading(prev => new Set(prev).add(examId));
    
    try {
      const response = await fetch(`/api/admin/exam/${examId}/report`);
      
      if (!response.ok) {
        // Try final exam endpoint if regular exam fails
        const finalExamResponse = await fetch(`/api/admin/final-exam/${examId}/report`);
        if (!finalExamResponse.ok) {
          throw new Error('Failed to fetch report data');
        }
        const reportData = await finalExamResponse.json();
        
        if (format === 'html') {
          await downloadHTMLReport(reportData);
        } else {
          generatePDFReport(reportData);
        }
      } else {
        const reportData = await response.json();
        
        if (format === 'html') {
          await downloadHTMLReport(reportData);
        } else {
          generatePDFReport(reportData);
        }
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('שגיאה ביצירת הדוח. אנא נסה שוב.');
    } finally {
      // Remove from loading state
      setReportLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(examId);
        return newSet;
      });
    }
  };

  const generatePDFReport = (reportData: any) => {
    // Create HTML content for the report (for print preview, use original logo URL)
    const htmlContent = generateReportHTML(reportData);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const downloadHTMLReport = async (reportData: any) => {
    try {
      // Convert logo to base64 for embedding
      const logoBase64 = await convertImageToBase64('/report_logo.jpeg');
      
      // Create HTML content for the report with embedded logo
      const htmlContent = generateReportHTML(reportData, logoBase64);
      
      // Create a blob with the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `דוח_ציונים_${reportData.studentInfo.name}_${reportData.studentInfo.studentId}.html`;
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating HTML report:', error);
      // Fallback: create report without logo
      const htmlContent = generateReportHTML(reportData, null);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `דוח_ציונים_${reportData.studentInfo.name}_${reportData.studentInfo.studentId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const convertImageToBase64 = (imagePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx?.drawImage(img, 0, 0);
        
        try {
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataURL);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imagePath;
    });
  };

  const generateReportHTML = (reportData: any, logoBase64?: string | null) => {
    const { studentInfo, questions, summary, metadata } = reportData;
    
    // Helper function to format dates properly
    const formatDate = (dateString: string) => {
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return 'תאריך לא זמין';
        }
        return date.toLocaleDateString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return 'תאריך לא זמין';
      }
    };

    // Helper function to get grade styling and icon
    const getGradeDisplay = (question: any) => {
      if (!question.isGraded) {
        return {
          class: 'ungraded',
          icon: '⚠️',
          text: 'לא תוקן',
          color: '#ff9800'
        };
      }
      
      const percentage = (question.pointsAwarded / question.maxPoints) * 100;
      if (percentage === 100) {
        return {
          class: 'full',
          icon: '✅',
          text: `${question.pointsAwarded}/${question.maxPoints}`,
          color: '#4caf50'
        };
      } else if (percentage > 0) {
        return {
          class: 'partial',
          icon: '🟠',
          text: `${question.pointsAwarded}/${question.maxPoints}`,
          color: '#ff9800'
        };
      } else {
        return {
          class: 'zero',
          icon: '❌',
          text: `${question.pointsAwarded}/${question.maxPoints}`,
          color: '#f44336'
        };
      }
    };

    // Calculate percentage for progress bar
    const percentage = Math.round((summary.totalPointsAwarded / summary.totalPossiblePoints) * 100);
    
    return `
      <!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח ציונים - ${studentInfo.name}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      background-color: #f4f6f9;
      color: #2c2c2c;
      direction: rtl;
      text-align: right;
      line-height: 1.6;
    }

    .report-container {
      max-width: 950px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.05);
      padding: 40px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #d0d4da;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .logo {
      height: 100px;
      width: 160px;
      object-fit: contain;
    }

    .logo-placeholder {
      height: 100px;
      width: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3em;
      background-color: #f8f9fa;
      border: 2px dashed #dee2e6;
      border-radius: 8px;
      color: #6c757d;
    }

    .report-title {
      flex: 1;
      text-align: center;
    }

    .report-title h1 {
      margin: 0;
      font-size: 1.8em;
      font-weight: 600;
      color: #1a1a1a;
    }

    .report-title h2 {
      margin-top: 8px;
      font-size: 1.2em;
      font-weight: 400;
      color: #6c757d;
    }

    .student-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      background-color: #f9f9fb;
      padding: 30px;
      border-radius: 10px;
      border: 1px solid #dee2e6;
      margin-bottom: 30px;
      align-items: start;
    }

    .info-item {
      background: white;
      padding: 15px 20px;
      border-radius: 6px;
      border: 1px solid #e3e6ea;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      font-size: 0.95em;
      line-height: 1.4;
    }

    .info-label {
      font-weight: 600;
      color: #555;
      margin-bottom: 5px;
      font-size: 0.9em;
    }

    .info-value {
      color: #2c2c2c;
      font-weight: 500;
      font-size: 1em;
    }

    .final-grade {
      background-color: #f1f3f5;
      border-left: 5px solid #007bff;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      font-size: 1.1em;
      font-weight: 600;
      color: #1a237e;
    }

    .questions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 0.9em;
      table-layout: fixed;
    }

    .questions-table th,
    .questions-table td {
      border: 1px solid #dee2e6;
      padding: 12px;
      vertical-align: top;
      word-wrap: break-word;
    }

    .questions-table th {
      background-color: #f1f1f1;
      font-weight: 600;
      color: #333;
      text-align: center;
    }

    .questions-table td {
      background-color: #ffffff;
      border: 1px solid #e2e6ea;
      vertical-align: top;
    }

    .questions-table .col-question {
      width: 20%;
      text-align: right;
      font-size: 0.85em;
    }

    .questions-table .col-answer {
      width: 35%;
      text-align: left;
      direction: ltr;
      font-family: 'Courier New', monospace;
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: break-word;
      font-size: 0.8em;
      line-height: 1.4;
    }

    .questions-table .col-answer-content {
      background-color: #f8f9fa;
      padding: 8px;
      border-radius: 4px;
      border-right: 3px solid #007bff;
      min-height: 40px;
      max-height: 200px;
      overflow-y: auto;
    }

    .questions-table .col-score {
      width: 12%;
      text-align: center;
      font-weight: bold;
    }

    .questions-table .col-feedback {
      width: 33%;
      text-align: right;
      font-size: 0.85em;
    }

    .feedback-text {
      background-color: #f8f9fa;
      border-left: 3px solid #2196f3;
      padding: 12px;
      border-radius: 4px;
      white-space: pre-wrap;
    }

    .score-full {
      color: #2e7d32;
    }

    .score-partial {
      color: #ef6c00;
    }

    .score-zero {
      color: #c62828;
    }

    .score-ungraded {
      color: #757575;
      font-style: italic;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      font-size: 0.85em;
      color: #6c757d;
      border-top: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div></div>
      <div class="report-title">
        <h1>משוב עבור הערכת מסכמת</h1>
        <h2>קורס בסיסי נתונים</h2>
        <h3>רואי זרחיה</h3>
      </div>
      ${logoBase64 
        ? `<img src="${logoBase64}" alt="לוגו מוסד" class="logo" />`
        : logoBase64 === null 
          ? '<div class="logo-placeholder">🎓</div>' 
          : '<img src="/report_logo.jpeg" alt="לוגו מוסד" class="logo" />'}
    </div>

    <div class="content">
      <div class="student-info">
        <h3 style="grid-column: span 4;">📝 פרטי הסטודנט</h3>

        <div class="info-item">
          <div class="info-label">שם מלא</div>
          <div class="info-value">${studentInfo.name}</div>
        </div>

        <div class="info-item">
          <div class="info-label">תעודת זהות</div>
          <div class="info-value">${studentInfo.studentId}</div>
        </div>

        <div class="info-item final-grade-item">
          <div class="info-label">ציון סופי</div>
          <div class="info-value final-grade-value">${summary.totalPointsAwarded}</div>
        </div>

        ${summary.overallFeedback ? `
          <div style="grid-column: span 2; background: white; padding: 15px; margin-top: 15px; border-radius: 8px; border-right: 4px solid #28a745;">
            <strong>הערות כלליות:</strong> ${summary.overallFeedback}
          </div>
        ` : ''}
      </div>

      <table class="questions-table">
        <thead>
          <tr>
            <th class="col-question">שאלה</th>
            <th class="col-answer">תשובת סטודנט</th>
            <th class="col-score">ניקוד</th>
            <th class="col-feedback">הערות</th>
          </tr>
        </thead>
        <tbody>
          ${questions.map(q => {
            const gradeInfo = getGradeDisplay(q);
            return `
              <tr>
                <td class="col-question">
                  <div style="font-weight: bold; margin-bottom: 6px; color: #333;">שאלה ${q.questionNumber}</div>
                  <div style="color: #666; line-height: 1.3; font-size: 0.9em;">${q.questionText || 'שאלה לא זמינה'}</div>
                </td>
                <td class="col-answer">
                  <div class="col-answer-content">
                    ${(q.studentAnswer || 'לא נענתה').replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')}
                  </div>
                </td>
                <td class="col-score">
                  <div class="score-badge score-${gradeInfo.class}" style="color: ${gradeInfo.color};">
                    ${gradeInfo.icon}<br/>${gradeInfo.text}
                  </div>
                </td>
                <td class="col-feedback">
                  ${q.feedback 
                    ? `<div class="feedback-text">${q.feedback}</div>` 
                    : '<div style="color: #999; font-style: italic;">אין הערות</div>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div class="footer-item">
        <span class="footer-icon">🕒</span>
        <span>דוח נוצר ב-${formatDate(metadata.reportGeneratedAt)}</span>
      </div>
      <div class="footer-item">
        <span class="footer-icon">🧾</span>
        <span>מזהה מבחן: ${metadata.examId}</span>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  };

  // Enhanced function to fetch graded scores including question-by-question grading
  const fetchGradedScores = async () => {
    // Include all completed exams, not just those marked as "graded"
    const visibleExams = examSessions.filter(session => session.status === 'completed');
    const examIds = visibleExams.map(session => session._id);
    
    if (examIds.length === 0) return;
    
    setLoadingGrades(new Set(examIds));
    console.log(`🔄 Fetching grades for ${examIds.length} exams...`);
    
    const results = await Promise.allSettled(
      examIds.map(async (examId) => {
        try {
          // Use the same logic as individual exam page - check /grade endpoints with fallback
          let gradeResponse = await fetch(`/api/admin/final-exam/${examId}/grade`, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          // If primary source fails, try the other source (grades might be saved in either location)
          if (!gradeResponse.ok) {
            console.log(`⚠️ Primary grade source failed for ${examId}, trying alternate source...`);
            gradeResponse = await fetch(`/api/admin/exam/${examId}/grade`, {
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (gradeResponse.ok) {
              console.log(`✅ Found grade data in alternate source (exam) for ${examId}`);
            }
          }
          
          if (gradeResponse.ok) {
            const gradeData = await gradeResponse.json();
            console.log(`📊 Grade data for ${examId}:`, {
              source: gradeData.dataSource,
              totalScore: gradeData.totalScore,
              questionGrades: gradeData.questionGrades?.length || 0
            });
            
            if (gradeData && gradeData.totalScore !== undefined) {
              return { examId, score: gradeData.totalScore, source: gradeData.dataSource || 'unknown' };
            }
          }
          
          console.log(`⚠️ No grade data found for exam ${examId}`);
          return null;
        } catch (error) {
          console.error(`Error fetching grade for exam ${examId}:`, error);
          return null;
        }
      })
    );
    
    // Process results
    const newScores = {};
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const { examId, score } = result.value;
        newScores[examId] = score;
      }
    });
    
    setActualGradedScores(prev => ({ ...prev, ...newScores }));
    setLoadingGrades(new Set());
  };

  // Enhanced refresh function with sync capabilities
  const refreshGradesWithSync = async () => {
    console.log('🔄 Starting enhanced grade refresh with sync...');
    
    // First, sync any exams that might need it
    const visibleExams = examSessions.filter(session => session.status === 'completed');
    setLoadingGrades(new Set(visibleExams.map(exam => exam._id)));
    
    let syncCount = 0;
    for (const exam of visibleExams) {
      try {
        const syncResponse = await fetch('/api/admin/unified-grade-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_exam',
            examId: exam._id
          }),
        });
        
        if (syncResponse.ok) {
          syncCount++;
        }
      } catch (error) {
        console.error(`Failed to sync exam ${exam._id}:`, error);
      }
    }
    
    console.log(`✅ Synced ${syncCount} exams`);
    
    // Then refresh the grades
    await fetchGradedScores();
    
    console.log('🎉 Grade refresh and sync complete!');
  };

  // Simplified refresh grades function
  const refreshGrades = () => {
    setActualGradedScores({});
    fetchGradedScores();
  };
  
  // Validation function to debug grade synchronization
  const validateGradeSync = async (examId: string, studentName?: string) => {
    try {
      console.log(`🔍 Validating grade sync for exam ${examId} (${studentName})`);
      
      // 1. Check finalExams.review data
      const examResponse = await fetch(`/api/admin/final-exam/${examId}/for-grading`);
      if (examResponse.ok) {
        const examData = await examResponse.json();
        console.log('📊 Final Exam Data:', {
          hasReview: !!examData.review,
          reviewData: examData.review,
          isGraded: examData.graded,
          totalQuestions: examData.answers?.length || 0
        });
        
        if (examData.review?.questionGrades) {
          console.log('📝 Question Grades:', examData.review.questionGrades.map(qg => ({
            questionIndex: qg.questionIndex,
            score: qg.score,
            maxScore: qg.maxScore,
            feedback: qg.feedback ? 'Has feedback' : 'No feedback'
          })));
        }
      }
      
      // 2. Check examGrades collection
      const gradeResponse = await fetch(`/api/admin/final-exam/${examId}/grade`);
      if (gradeResponse.ok) {
        const gradeData = await gradeResponse.json();
        console.log('🏆 Exam Grades Collection:', gradeData);
      }
      
      // 3. Check what the report API returns
      const reportResponse = await fetch(`/api/admin/final-exam/${examId}/report`);
      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        console.log('📄 Report Data:', {
          totalPointsAwarded: reportData.summary.totalPointsAwarded,
          totalPossiblePoints: reportData.summary.totalPossiblePoints,
          questionsCount: reportData.questions.length,
          gradedQuestionsCount: reportData.questions.filter(q => q.isGraded).length
        });
      }
      
    } catch (error) {
      console.error('❌ Error validating grade sync:', error);
    }
  };

  // Bulk validation function for all visible exams
  const validateAllGrades = async () => {
    console.log('🚀 Starting bulk validation for all visible exams...');
    console.log('='.repeat(80));
    
    const results = {
      total: sortedSessions.length,
      withGrades: 0,
      withoutGrades: 0,
      errors: 0,
      details: [] as any[]
    };
    
    for (let i = 0; i < sortedSessions.length; i++) {
      const session = sortedSessions[i];
      const studentInfo = `${session.studentName || 'Unknown'} (${session.studentId || 'No ID'})`;
      
      try {
        console.log(`\n📋 [${i + 1}/${sortedSessions.length}] Checking: ${studentInfo}`);
        
        // Check finalExams.review data
        const examResponse = await fetch(`/api/admin/final-exam/${session._id}/for-grading`);
        let examData = null;
        let hasGrades = false;
        let totalScore = 0;
        let questionCount = 0;
        let gradedQuestionCount = 0;
        
        if (examResponse.ok) {
          examData = await examResponse.json();
          
          if (examData.review?.questionGrades?.length > 0) {
            hasGrades = true;
            totalScore = examData.review.totalScore || 0;
            questionCount = examData.answers?.length || 0;
            gradedQuestionCount = examData.review.questionGrades.length;
            
            console.log(`  ✅ Has grades: ${totalScore} points (${gradedQuestionCount}/${questionCount} questions graded)`);
            results.withGrades++;
          } else {
            console.log(`  ⚠️  No grades found in review system`);
            results.withoutGrades++;
          }
        } else {
          console.log(`  ❌ Failed to fetch exam data`);
          results.errors++;
        }
        
        // Store detailed results
        results.details.push({
          studentName: session.studentName,
          studentId: session.studentId,
          examId: session._id,
          hasGrades,
          totalScore,
          questionCount,
          gradedQuestionCount,
          displayedScore: actualGradedScores[session._id],
          syncStatus: hasGrades && actualGradedScores[session._id] === totalScore ? 'SYNCED' : 'NEEDS_ATTENTION'
        });
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error checking ${studentInfo}:`, error);
        results.errors++;
      }
    }
    
    // Summary report
    console.log('\n' + '='.repeat(80));
    console.log('📊 BULK VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Exams Checked: ${results.total}`);
    console.log(`✅ With Grades: ${results.withGrades}`);
    console.log(`⚠️  Without Grades: ${results.withoutGrades}`);
    console.log(`❌ Errors: ${results.errors}`);
    
    // Detailed breakdown
    const gradedExams = results.details.filter(d => d.hasGrades);
    const syncIssues = results.details.filter(d => d.syncStatus === 'NEEDS_ATTENTION');
    
    if (gradedExams.length > 0) {
      console.log('\n📝 GRADED EXAMS DETAILS:');
      gradedExams.forEach(exam => {
        console.log(`  ${exam.studentName}: ${exam.totalScore} points (${exam.gradedQuestionCount}/${exam.questionCount} questions) - ${exam.syncStatus}`);
      });
    }
    
    if (syncIssues.length > 0) {
      console.log('\n⚠️  SYNC ISSUES DETECTED:');
      syncIssues.forEach(exam => {
        console.log(`  ${exam.studentName}: Backend=${exam.totalScore}, Display=${exam.displayedScore}`);
      });
    } else {
      console.log('\n✅ All graded exams are properly synchronized!');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 Validation complete! Check individual entries above for details.');
    
    return results;
  };

  const analyzeExamForAIPatterns = async (examId: string) => {
    if (aiAnalysisLoading.has(examId)) return;

    setAiAnalysisLoading(prev => new Set(prev).add(examId));
    
    try {
      const response = await fetch(`/api/admin/exam/${examId}/for-grading`);
      if (!response.ok) {
        throw new Error('Failed to fetch exam data for AI analysis');
      }
      
      const examData = await response.json();
      if (examData.answers) {
        const analysis = analyzeExamForAI(examData.answers);
        
        // Update the exam session with AI analysis
        setExamSessions(prev => prev.map(session => 
          session._id === examId 
            ? { ...session, aiAnalysis: analysis }
            : session
        ));
      }
    } catch (err) {
      console.error('Error analyzing exam for AI:', err);
    } finally {
      setAiAnalysisLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(examId);
        return newSet;
      });
    }
  };

  // Note: Bulk AI analysis function removed to reduce database load
  // Individual AI analysis can still be triggered manually if needed

  const getAIIcon = (score: number) => {
    const iconName = getSuspicionIcon(score);
    switch (iconName) {
      case 'AlertTriangle':
        return <AlertTriangle size={16} className={styles.aiHighRisk} />;
      case 'AlertCircle':
        return <AlertCircle size={16} className={styles.aiMediumRisk} />;
      case 'Info':
        return <Info size={16} className={styles.aiLowRisk} />;
      default:
        return <CheckCircle size={16} className={styles.aiClean} />;
    }
  };

  // Fetch graded scores when sessions are loaded
  useEffect(() => {
    if (examSessions.length > 0) {
      fetchGradedScores();
    }
  }, [examSessions]);

  // Recalculate statistics when exam sessions or actual graded scores change
  useEffect(() => {
    calculateStatistics();
  }, [examSessions, actualGradedScores]);

  // Bulk export functions
  const handleBulkGradesExport = async () => {
    setBulkExportLoading(prev => ({ ...prev, grades: true }));
    
    try {
      // Send only the currently filtered exam sessions to export (grades will be fetched fresh from DB)
      const exportData = {
        examSessions: sortedSessions // Export will fetch fresh grades directly from database
      };
      
      const response = await fetch('/api/admin/bulk-export/grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to export grades');
      }
      
      // Get the filename from the response headers
      const disposition = response.headers.get('content-disposition');
      let filename = `רשימת_ציונים_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (disposition) {
        // Try to extract UTF-8 filename first, then fallback to regular filename
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
        const regularMatch = disposition.match(/filename="([^"]+)"/);
        
        if (utf8Match) {
          filename = decodeURIComponent(utf8Match[1]);
        } else if (regularMatch) {
          filename = regularMatch[1];
        }
      }
      
      // Create download link
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting grades:', error);
      alert('שגיאה בייצוא הציונים. אנא נסה שוב.');
    } finally {
      setBulkExportLoading(prev => ({ ...prev, grades: false }));
    }
  };

  const handleBulkReportsExport = async () => {
    setBulkExportLoading(prev => ({ ...prev, reports: true }));
    
    try {
      const response = await fetch('/api/admin/bulk-export/reports');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export reports');
      }
      
      // Get the filename from the response headers
      const disposition = response.headers.get('content-disposition');
      let filename = `דוחות_ציונים_${new Date().toISOString().split('T')[0]}.zip`;
      
      if (disposition) {
        // Try to extract UTF-8 filename first, then fallback to regular filename
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
        const regularMatch = disposition.match(/filename="([^"]+)"/);
        
        if (utf8Match) {
          filename = decodeURIComponent(utf8Match[1]);
        } else if (regularMatch) {
          filename = regularMatch[1];
        }
      }
      
      // Create download link
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting reports:', error);
      alert(`שגיאה בייצוא הדוחות: ${error.message}`);
    } finally {
      setBulkExportLoading(prev => ({ ...prev, reports: false }));
    }
  };

  // Show initial interface without loading when no tab is selected
  if (!activeTab) {
    return (
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button 
            onClick={() => router.push('/admin')}
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
            חזרה לממשק ניהול
          </button>
          <h1 className={styles.title}>
            <FileText size={24} />
            בדיקה וציונים - בחינות סופיות
          </h1>
          <div className={styles.subtitle}>
            מציג בחינות מאוחדות - בחינה אחת לכל סטודנט (מעדיף מבחן מקורי על פני חזרה)
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <button
              className={styles.tab}
              onClick={() => setActiveTab('moed-a')}
            >
              מועד א 2025
            </button>
            <button
              className={styles.tab}
              onClick={() => setActiveTab('moed-b')}
            >
              מועד ב 2025
            </button>
          </div>
          <div className={styles.tabDescription}>
            בחר מועד כדי לצפות ברשימת הבחינות
          </div>
        </div>

        {/* Initial State Message */}
        <div className={styles.initialStateContainer}>
          <div className={styles.initialStateContent}>
            <FileText size={48} className={styles.initialStateIcon} />
            <h2>בחר מועד בחינה</h2>
            <p>כדי להתחיל, בחר את המועד הרצוי:</p>
            <div className={styles.moedOptions}>
              <button 
                className={styles.moedButton}
                onClick={() => setActiveTab('moed-a')}
              >
                <div className={styles.moedButtonTitle}>מועד א 2025</div>
                <div className={styles.moedButtonDesc}>בחינות מאוחדות עם ציון עליון</div>
              </button>
              <button 
                className={styles.moedButton}
                onClick={() => setActiveTab('moed-b')}
              >
                <div className={styles.moedButtonTitle}>מועד ב 2025</div>
                <div className={styles.moedButtonDesc}>בחינות רגילות מהמערכת</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button 
            onClick={() => router.push('/admin')}
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
            חזרה לממשק ניהול
          </button>
          <h1 className={styles.title}>
            <FileText size={24} />
            בדיקה וציונים - בחינות סופיות
          </h1>
          <div className={styles.subtitle}>
            מציג בחינות מאוחדות - בחינה אחת לכל סטודנט (מעדיף מבחן מקורי על פני חזרה)
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'moed-a' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('moed-a')}
            >
              מועד א 2025
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'moed-b' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('moed-b')}
            >
              מועד ב 2025
            </button>
          </div>
          <div className={styles.tabDescription}>
            {activeTab === 'moed-a' 
              ? 'בחינות מועד א (FinalExams) - בחינות מאוחדות עם ציון עליון' 
              : 'בחינות מועד ב (ExamSessions) - בחינות רגילות מהמערכת'
            }
          </div>
        </div>

        <div className={styles.loading}>
          טוען {activeTab === 'moed-a' ? 'בחינות מועד א' : 'בחינות מועד ב'}...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          onClick={() => router.push('/admin')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          חזרה לממשק ניהול
        </button>
        <h1 className={styles.title}>
          <FileText size={24} />
          בדיקה וציונים - בחינות סופיות
        </h1>
        <div className={styles.subtitle}>
          מציג בחינות מאוחדות - בחינה אחת לכל סטודנט (מעדיף מבחן מקורי על פני חזרה)
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'moed-a' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('moed-a')}
          >
            מועד א 2025
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'moed-b' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('moed-b')}
          >
            מועד ב 2025
          </button>
        </div>
        <div className={styles.tabDescription}>
          {activeTab === 'moed-a' 
            ? 'בחינות מועד א (FinalExams) - בחינות מאוחדות עם ציון עליון' 
            : activeTab === 'moed-b'
            ? 'בחינות מועד ב (ExamSessions) - בחינות רגילות מהמערכת'
            : 'בחר מועד כדי לצפות ברשימת הבחינות'
          }
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Loading indicator for batch processing */}
      {loadingGrades.size > 0 && (
        <div className={styles.batchLoadingIndicator}>
          <div className={styles.loadingSpinner}></div>
          <span>טוען ציונים...</span>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>חיפוש:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="שם סטודנט או מספר זהות"
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>סטטוס:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={styles.statusFilter}
          >
            <option value="all">הכל</option>
            <option value="completed">הושלם</option>
            <option value="in_progress">בתהליך</option>
            <option value="timeout">נגמר הזמן</option>
          </select>
        </div>
        {/* Debug refresh button */}
        <button
          onClick={refreshGrades}
          className={styles.gradeButton}
          style={{ background: '#28a745', color: 'white' }}
        >
          🔄 רענן נתונים
        </button>
      </div>

      {/* Bulk Export Controls */}
      <div className={styles.bulkExportSection}>
       
        <div className={styles.bulkExportButtons}>
          <button
            onClick={handleBulkGradesExport}
            className={styles.bulkExportButton}
            disabled={bulkExportLoading.grades || examSessions.length === 0}
            style={{ backgroundColor: '#2196f3' }}
          >
            {bulkExportLoading.grades ? (
              <>
                <Clock size={16} className={styles.loadingSpinner} />
                מייצא ציונים...
              </>
            ) : (
              <>
                📊 ייצא רשימת ציונים (CSV)
              </>
            )}
          </button>
          
          <button
            onClick={handleBulkReportsExport}
            className={styles.bulkExportButton}
            disabled={bulkExportLoading.reports || examSessions.length === 0}
            style={{ backgroundColor: '#ff6b6b' }}
          >
            {bulkExportLoading.reports ? (
              <>
                <Clock size={16} className={styles.loadingSpinner} />
                מייצא דוחות...
              </>
            ) : (
              <>
                📁 ייצא כל הדוחות (ZIP)
              </>
            )}
          </button>
          
          <button
            onClick={validateAllGrades}
            className={styles.bulkExportButton}
            disabled={examSessions.length === 0}
            style={{ backgroundColor: '#9c27b0' }}
          >
            🔍 בדוק סנכרון ציונים (כל הבחינות)
          </button>
          
          <button
            onClick={refreshGradesWithSync}
            className={styles.bulkExportButton}
            disabled={loadingGrades.size > 0}
            style={{ backgroundColor: '#2196f3' }}
          >
            {loadingGrades.size > 0 ? '🔄 מעדכן...' : '🔄 רענן וסנכרן ציונים'}
          </button>
        </div>
        <div className={styles.bulkExportInfo}>
          <p>• ייצוא ציונים: קובץ CSV עם תעודת זהות, שם ופירוט ציונים (כולל בחינות שתוקנו לפי שאלה)</p>
          <p>• ייצוא דוחות: קובץ ZIP עם כל הדוחות האישיים בפורמט HTML (רק בחינות עם ציונים)</p>
          <p>• בדיקת סנכרון: בודק את כל הבחינות ומציג דוח מפורט ב-Console (פתח בF12)</p>
          <p>💡 <strong>עצה:</strong> לצפייה נכונה בעברית ב-Excel, פתח את הקובץ דרך &quot;נתונים → מטקסט/CSV&quot; ובחר קידוד UTF-8</p>
        </div>
      </div>

      {/* AI Analysis Controls */}
      {/* (הוסרו כפתורי ניתוח AI, טקסטים ואנימציות) */}
      {/* Bulk AI Analysis Progress */}
      {/* (הוסרו כל האנימציות והטעינות של ניתוח AI) */}

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{statisticsData.averageGrade}</div>
          <div className={styles.statLabel}>ציון ממוצע</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{statisticsData.standardDeviation}</div>
          <div className={styles.statLabel}>סטיית תקן</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{statisticsData.failurePercentage}%</div>
          <div className={styles.statLabel}>אחוז נכשלים (מתחת ל60)</div>
        </div>
      
      </div>

      {/* Exam Sessions Table */}
      <div className={styles.tableContainer}>
        <table className={styles.examTable}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={styles.sortableHeader} style={{width: "20%"}}>
                סטודנט {getSortIcon('name')}
              </th>
              {/* <th onClick={() => handleSort('grade')} className={styles.sortableHeader}>
                ציון סטודנט {getSortIcon('grade')}
              </th> */}
              <th onClick={() => handleSort('totalPoints')} className={styles.sortableHeader} style={{width: "20%"}}>
                ציון {getSortIcon('totalPoints')}
              </th>
              {/* הסתרת עמודת AI חשד */}
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.noData}>
                  לא נמצאו בחינות
                </td>
              </tr>
            ) : (
              sortedSessions.map((session) => (
                <tr key={session._id} className={styles.tableRow}>
                  <td className={styles.studentCell}>
                    <div className={styles.studentInfo}>
                      <User size={16} />
                      <span>{session.studentName || 'לא צוין'}</span>
                    </div>
                    {session.studentId && (
                      <div className={styles.studentId}>
                        ID: {session.studentId}
                      </div>
                    )}
                    <div className={styles.studentEmail}>
                      {session.studentEmail}
                    </div>
                  </td>
                  {/* <td className={styles.scoreCell}>
                    {(actualGradedScores[session._id] !== undefined || session.score !== undefined) ? (
                      <span className={styles.score}>
                        {(() => {
                          const finalScore = actualGradedScores[session._id] ?? session.score;
                          // Special debug for problematic student
                          if (session.studentId === '207749219') {
                            console.log(`🔍 Student 207749219 DEBUG:`, {
                              examId: session._id,
                              actualGradedScore: actualGradedScores[session._id],
                              sessionScore: session.score,
                              finalDisplayed: finalScore,
                              hasActualGraded: actualGradedScores[session._id] !== undefined
                            });
                          }
                          return finalScore;
                        })()}
                      </span>
                    ) : (
                      loadingTotalPoints.has(session._id) ? (
                        <span className={styles.loading}>טוען...</span>
                      ) : (
                        '-'
                      )
                    )}
                  </td> */}
                  <td className={styles.totalPointsCell}>
                    {actualGradedScores[session._id] !== undefined ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={styles.totalPoints}>
                          {actualGradedScores[session._id]}
                        </span>
                        <span 
                          style={{ 
                            fontSize: '0.8em', 
                            color: '#28a745', 
                            fontWeight: 'bold'
                          }}
                          title="צוין באמצעות מערכת הציון לפי שאלה"
                        >
                          ✓ מצוין
                        </span>
                      </div>
                    ) : (
                      <span className={styles.notAvailable}>לא זמין</span>
                    )}
                  </td>
                  {/* הסתרת עמודת AI חשד ופעולות ניתוח */}
                  <td className={styles.actionsCell}>
                  
                    <div className={styles.reportButtonGroup}>
                    <button
                      onClick={() => handleGradeExam(session._id)}
                      className={styles.gradeButton}
                      disabled={session.status === 'in_progress'}
                    >
                      <FileText size={16} />
                      {session.graded ? 'ערוך ציון' : 'בדוק וציין'}
                    </button>
                      <button
                        onClick={() => handleDownloadReport(session._id, session.studentName, session.studentId, 'print')}
                        className={styles.reportButton}
                        disabled={(!session.graded && !actualGradedScores[session._id]) || reportLoading.has(session._id)}
                        title={
                          (!session.graded && !actualGradedScores[session._id]) 
                            ? 'יש לסיים את הבדיקה לפני הורדת הדוח'
                            : reportLoading.has(session._id)
                            ? 'מכין דוח...'
                            : 'הצג דוח להדפסה'
                        }
                      >
                        {reportLoading.has(session._id) ? (
                          <>
                            <Clock size={16} className={styles.loadingSpinner} />
                            מכין דוח...
                          </>
                        ) : (
                          <>
                            <FileText size={16} />
                            📄 הצג דוח
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDownloadReport(session._id, session.studentName, session.studentId, 'html')}
                        className={styles.htmlButton}
                        disabled={(!session.graded && !actualGradedScores[session._id]) || reportLoading.has(session._id)}
                        title={
                          (!session.graded && !actualGradedScores[session._id]) 
                            ? 'יש לסיים את הבדיקה לפני הורדת הדוח'
                            : reportLoading.has(session._id)
                            ? 'מכין דוח...'
                            : 'הורד דוח כקובץ HTML'
                        }
                      >
                        <Download size={16} />
                        HTML
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExamGradingPage; 