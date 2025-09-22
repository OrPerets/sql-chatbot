import { NextRequest, NextResponse } from 'next/server';
import { NotificationHelpers } from '../../../../../lib/notifications';

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

interface CheatDetectionData {
  similarityMatches: SimilarityMatch[];
  aiDetectionResults: AIDetectionResult[];
  stats: {
    totalExams: number;
    suspiciousSimilarities: number;
    suspiciousAI: number;
    averageSimilarityScore: number;
    highRiskPairs: number;
  };
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateSimilarityCSV(matches: SimilarityMatch[]): string {
  const headers = [
    'סוג חשד',
    'שם סטודנט 1',
    'תעודת זהות 1',
    'אימייל 1',
    'שם סטודנט 2',
    'תעודת זהות 2',
    'אימייל 2',
    'מספר שאלה',
    'טקסט שאלה',
    'ציון דמיון (%)',
    'רמת חשד',
    'תשובת סטודנט 1',
    'תשובת סטודנט 2'
  ];

  let csv = headers.map(escapeCSV).join(',') + '\n';

  matches.forEach(match => {
    const row = [
      'דמיון בתשובות',
      match.student1.name,
      match.student1.id,
      match.student1.email,
      match.student2.name,
      match.student2.id,
      match.student2.email,
      (match.questionIndex + 1).toString(),
      match.questionText,
      Math.round(match.similarityScore * 100).toString(),
      match.suspicionLevel === 'high' ? 'גבוה' : match.suspicionLevel === 'medium' ? 'בינוני' : 'נמוך',
      match.student1Answer.replace(/\n/g, ' ').substring(0, 500),
      match.student2Answer.replace(/\n/g, ' ').substring(0, 500)
    ];
    csv += row.map(escapeCSV).join(',') + '\n';
  });

  return csv;
}

function generateAIDetectionCSV(results: AIDetectionResult[]): string {
  const headers = [
    'סוג חשד',
    'שם סטודנט',
    'תעודת זהות',
    'אימייל',
    'מזהה מבחן',
    'סה"כ שאלות',
    'תשובות חשודות',
    'ציון חשד מקסימלי',
    'ציון חשד ממוצע',
    'רמת חשד',
    'מספר שאלה חשודה',
    'טקסט שאלה',
    'תשובת סטודנט',
    'מלכודות שהופעלו'
  ];

  let csv = headers.map(escapeCSV).join(',') + '\n';

  results.forEach(result => {
    if (result.details.length === 0) {
      // Add a summary row even if no specific details
      const row = [
        'עזרה חיצונית/AI',
        result.studentName,
        result.studentId,
        result.studentEmail,
        result.examId,
        result.totalQuestions.toString(),
        result.suspiciousAnswers.toString(),
        result.maxSuspicionScore.toString(),
        result.averageSuspicionScore.toString(),
        result.aiSuspicionLevel === 'high' ? 'גבוה' : result.aiSuspicionLevel === 'medium' ? 'בינוני' : 'נמוך',
        '',
        '',
        '',
        ''
      ];
      csv += row.map(escapeCSV).join(',') + '\n';
    } else {
      // Add a row for each suspicious answer
      result.details.forEach(detail => {
        const row = [
          'עזרה חיצונית/AI',
          result.studentName,
          result.studentId,
          result.studentEmail,
          result.examId,
          result.totalQuestions.toString(),
          result.suspiciousAnswers.toString(),
          result.maxSuspicionScore.toString(),
          result.averageSuspicionScore.toString(),
          result.aiSuspicionLevel === 'high' ? 'גבוה' : result.aiSuspicionLevel === 'medium' ? 'בינוני' : 'נמוך',
          (detail.questionIndex + 1).toString(),
          detail.questionText,
          detail.answer.replace(/\n/g, ' ').substring(0, 500),
          detail.triggeredTraps.join('; ')
        ];
        csv += row.map(escapeCSV).join(',') + '\n';
      });
    }
  });

  return csv;
}

function generateCombinedCSV(data: CheatDetectionData): string {
  const similarityCSV = generateSimilarityCSV(data.similarityMatches);
  const aiDetectionCSV = generateAIDetectionCSV(data.aiDetectionResults);

  // Create statistics summary
  const statsHeaders = ['סטטיסטיקה', 'ערך'];
  let statsCSV = statsHeaders.map(escapeCSV).join(',') + '\n';
  
  const statsRows = [
    ['סה"כ בחינות נבדקו', data.stats.totalExams.toString()],
    ['זוגות חשודים בהעתקה', data.stats.suspiciousSimilarities.toString()],
    ['חשודים בעזרה חיצונית', data.stats.suspiciousAI.toString()],
    ['דמיון ממוצע (זוגות חשודים)', `${Math.round(data.stats.averageSimilarityScore * 100)}%`],
    ['זוגות בסיכון גבוה', data.stats.highRiskPairs.toString()],
    ['תאריך הדוח', new Date().toLocaleDateString('he-IL')]
  ];

  statsRows.forEach(row => {
    statsCSV += row.map(escapeCSV).join(',') + '\n';
  });

  // Combine all sections
  return statsCSV + '\n\n' + similarityCSV + '\n\n' + aiDetectionCSV;
}

export async function POST(request: NextRequest) {
  try {
    const data: CheatDetectionData = await request.json();

    const csvContent = generateCombinedCSV(data);
    
    // Add BOM for proper Hebrew display in Excel
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // Create filename with Hebrew text and current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `דוח_חשדות_העתקה_${date}.csv`;

    // Create notification for data export
    const recordCount = data.similarityMatches?.length || 0;
    await NotificationHelpers.dataExport('דוח חשדות העתקה', recordCount);

    // Set headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    return new NextResponse(csvWithBom, { headers });

  } catch (error) {
    console.error('Error exporting cheat detection results:', error);
    
    // Create error notification
    await NotificationHelpers.systemError(
      'שגיאה בייצוא דוח חשדות העתקה',
      'cheat-detection-export'
    );
    
    return NextResponse.json(
      { error: 'שגיאה בייצוא דוח חשדות העתקה' },
      { status: 500 }
    );
  }
}