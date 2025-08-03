import { NextRequest, NextResponse } from 'next/server';
import { detectAITraps, analyzeExamForAI } from '../../../utils/trapDetector';

const SERVER_BASE = process.env.NEXT_PUBLIC_SERVER_BASE || 'https://mentor-server-theta.vercel.app';

interface ExamAnswer {
  _id: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  questionIndex: number;
  questionText: string;
  studentAnswer: string;
  examId: string;
}

interface SimilarityMatch {
  student1: {
    id: string;
    name: string;
    email: string;
  };
  student2: {
    id: string;
    name: string;
    email: string;
  };
  questionIndex: number;
  questionText: string;
  similarityScore: number;
  student1Answer: string;
  student2Answer: string;
  suspicionLevel: 'low' | 'medium' | 'high';
}

interface AIDetectionResult {
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  totalQuestions: number;
  suspiciousAnswers: number;
  maxSuspicionScore: number;
  averageSuspicionScore: number;
  aiSuspicionLevel: 'low' | 'medium' | 'high';
  details: {
    questionIndex: number;
    questionText: string;
    answer: string;
    suspicionScore: number;
    triggeredTraps: string[];
  }[];
}

// Text similarity calculation using Jaccard similarity
function calculateJaccardSimilarity(text1: string, text2: string): number {
  // Normalize and tokenize texts
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 2); // Filter out very short words
  };

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Calculate intersection and union
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// Advanced similarity calculation combining multiple metrics
function calculateAdvancedSimilarity(text1: string, text2: string): number {
  // Jaccard similarity
  const jaccardScore = calculateJaccardSimilarity(text1, text2);
  
  // Levenshtein distance similarity (normalized)
  const levenshteinSimilarity = calculateLevenshteinSimilarity(text1, text2);
  
  // Sequence similarity (for SQL statements)
  const sequenceSimilarity = calculateSequenceSimilarity(text1, text2);
  
  // Weighted average - giving more weight to Jaccard and sequence for SQL
  return (jaccardScore * 0.4 + levenshteinSimilarity * 0.3 + sequenceSimilarity * 0.3);
}

function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

function calculateSequenceSimilarity(text1: string, text2: string): number {
  // Extract SQL keywords and their order
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'INSERT', 'UPDATE', 'DELETE'];
  
  const extractKeywordSequence = (text: string) => {
    const upperText = text.toUpperCase();
    return sqlKeywords.filter(keyword => upperText.includes(keyword));
  };

  const seq1 = extractKeywordSequence(text1);
  const seq2 = extractKeywordSequence(text2);

  if (seq1.length === 0 && seq2.length === 0) return 1;
  if (seq1.length === 0 || seq2.length === 0) return 0;

  // Find longest common subsequence
  const lcs = findLCS(seq1, seq2);
  const maxLen = Math.max(seq1.length, seq2.length);
  
  return lcs.length / maxLen;
}

function findLCS(seq1: string[], seq2: string[]): string[] {
  const dp = Array(seq1.length + 1).fill(null).map(() => Array(seq2.length + 1).fill(0));
  
  for (let i = 1; i <= seq1.length; i++) {
    for (let j = 1; j <= seq2.length; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct LCS
  const lcs = [];
  let i = seq1.length, j = seq2.length;
  while (i > 0 && j > 0) {
    if (seq1[i - 1] === seq2[j - 1]) {
      lcs.unshift(seq1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function getSuspicionLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

function getAISuspicionLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export async function POST(request: NextRequest) {
  try {
    const { similarityThreshold = 0.8, aiThreshold = 30 } = await request.json();

    console.log('🔍 Calling mentor-server for cheat detection analysis...');
    
    // Call the mentor-server backend
    const response = await fetch(`${SERVER_BASE}/admin/cheat-detection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        similarityThreshold,
        aiThreshold
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const backendData = await response.json();
    
    // Process AI detection on the frontend using our trapDetector
    if (backendData.examAnswers && Array.isArray(backendData.examAnswers)) {
      const aiDetectionResults: AIDetectionResult[] = [];
      const examAnswersByStudent: { [studentId: string]: any[] } = {};

      // Group answers by student
      backendData.examAnswers.forEach((answer: any) => {
        const studentId = answer.studentId || answer.studentEmail;
        if (!examAnswersByStudent[studentId]) {
          examAnswersByStudent[studentId] = [];
        }
        examAnswersByStudent[studentId].push(answer);
      });

      // Run AI detection for each student
      Object.keys(examAnswersByStudent).forEach(studentId => {
        const answers = examAnswersByStudent[studentId];
        if (!answers || answers.length === 0) return;

        const analysisResults = answers.map((answer, index) => {
          const analysis = detectAITraps(answer.studentAnswer || '');
          return {
            questionIndex: index,
            questionText: answer.questionText || `שאלה ${index + 1}`,
            answer: answer.studentAnswer || '',
            suspicionScore: analysis.suspicionScore,
            triggeredTraps: analysis.triggeredTraps.map(trap => trap.description)
          };
        });

        const suspiciousAnswers = analysisResults.filter(r => r.suspicionScore >= aiThreshold);
        const maxSuspicionScore = Math.max(...analysisResults.map(r => r.suspicionScore));
        const averageSuspicionScore = analysisResults.reduce((sum, r) => sum + r.suspicionScore, 0) / analysisResults.length;

        if (suspiciousAnswers.length > 0 || maxSuspicionScore >= aiThreshold) {
          const firstAnswer = answers[0];
          aiDetectionResults.push({
            studentId: firstAnswer.studentId || firstAnswer.studentEmail,
            studentName: firstAnswer.studentName || 'לא צוין',
            studentEmail: firstAnswer.studentEmail,
            examId: firstAnswer.examId,
            totalQuestions: answers.length,
            suspiciousAnswers: suspiciousAnswers.length,
            maxSuspicionScore,
            averageSuspicionScore: Math.round(averageSuspicionScore),
            aiSuspicionLevel: getAISuspicionLevel(maxSuspicionScore),
            details: suspiciousAnswers
          });
        }
      });

      // Sort AI results by suspicion score
      aiDetectionResults.sort((a, b) => b.maxSuspicionScore - a.maxSuspicionScore);

      // Update the backend data with our AI analysis
      backendData.aiDetectionResults = aiDetectionResults;
      if (backendData.stats) {
        backendData.stats.suspiciousAI = aiDetectionResults.length;
      }
    }

    console.log('✅ Cheat detection analysis completed');
    return NextResponse.json(backendData);

  } catch (error) {
    console.error('Error in cheat detection analysis:', error);
    return NextResponse.json(
      { error: 'שגיאה בניתוח חשדות העתקה' },
      { status: 500 }
    );
  }
}