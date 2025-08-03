import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../config';

const SERVER_BASE = config.serverUrl;

export async function POST(request: NextRequest) {
  try {
    console.log('🏁 Starting bulk grades export from filtered exam-grading data...');
    
    // Get the filtered exam sessions from the request body
    const { examSessions, actualGradedScores } = await request.json();
    
    if (!examSessions || !Array.isArray(examSessions)) {
      throw new Error('No exam sessions provided');
    }
    
    console.log(`📊 Received ${examSessions.length} filtered exam sessions for export`);

    // Create export data using the pre-filtered exam sessions and computed grades
    const validGrades = examSessions
      .filter((session: any) => session.studentName && session.studentName !== 'לא צוין')
      .map((session: any) => {
        // Use the computed grade from actualGradedScores, or fall back to session score
        const finalGrade = actualGradedScores[session._id] !== undefined 
          ? actualGradedScores[session._id] 
          : session.score || 0;
        
        return {
          studentId: session.studentId || 'לא צוין',
          studentName: session.studentName || 'לא צוין',
          email: session.studentEmail || '',
          finalGrade: finalGrade,
          examDate: session.startTime || new Date().toISOString(),
          examId: session._id
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'he'));

    console.log(`✅ Successfully processed ${validGrades.length} grades`);

    // Generate CSV content with UTF-8 BOM for proper Hebrew display
    const BOM = '\uFEFF'; // UTF-8 Byte Order Mark
    const csvHeader = 'תעודת זהות,שם סטודנט,ציון סופי,תאריך מבחן,מזהה מבחן\n';
    const csvRows = validGrades.map(grade => {
      const formatDate = (dateString: string) => {
        try {
          return new Date(dateString).toLocaleDateString('he-IL');
        } catch {
          return 'לא זמין';
        }
      };
      
      return `"${grade.studentId}","${grade.studentName}","${grade.finalGrade}","${formatDate(grade.examDate)}","${grade.examId}"`;
    }).join('\n');

    const csvContent = BOM + csvHeader + csvRows;

    // Generate safe filename (ASCII-only for HTTP headers)
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `grades_export_${dateStr}.csv`;
    const hebrewFilename = encodeURIComponent(`רשימת_ציונים_${dateStr}.csv`);

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${hebrewFilename}`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error in bulk grades export:', error);
    return NextResponse.json(
      { error: 'Failed to export grades', details: error.message },
      { status: 500 }
    );
  }
}

// Keep old GET method for backward compatibility
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Please use the new filtered export from the exam-grading page' },
    { status: 400 }
  );
}