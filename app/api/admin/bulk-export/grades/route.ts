import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../config';

const SERVER_BASE = config.serverUrl;

export async function POST(request: NextRequest) {
  try {
    console.log('🏁 Starting bulk grades export with fresh database data...');
    
    // Get the filtered exam sessions from the request body
    const { examSessions } = await request.json();
    
    if (!examSessions || !Array.isArray(examSessions)) {
      throw new Error('No exam sessions provided');
    }
    
    console.log(`📊 Received ${examSessions.length} filtered exam sessions for export`);

    // Get fresh grades from database for each exam
    const freshGrades = await Promise.allSettled(
      examSessions.map(async (session: any) => {
        try {
          // Use the same logic as individual exam page - check /grade endpoints with fallback
          let gradeResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${session._id}/grade`);
          
          // If primary source fails, try the other source (grades might be saved in either location)
          if (!gradeResponse.ok) {
            console.log(`⚠️ Primary grade source failed for ${session._id}, trying alternate source...`);
            gradeResponse = await fetch(`${SERVER_BASE}/admin/exam/${session._id}/grade`);
            
            if (gradeResponse.ok) {
              console.log(`✅ Found grade data in alternate source (exam) for ${session._id}`);
            }
          }
          
          if (gradeResponse.ok) {
            const gradeData = await gradeResponse.json();
            console.log(`📊 CSV Export - Grade data for ${session._id}:`, {
              source: gradeData.dataSource,
              totalScore: gradeData.totalScore,
              questionGrades: gradeData.questionGrades?.length || 0
            });
            
            if (gradeData && gradeData.totalScore !== undefined) {
              return { 
                ...session, 
                finalGrade: gradeData.totalScore, 
                gradeSource: gradeData.dataSource || 'unknown'
              };
            }
          }
          
          // No grade found
          return { ...session, finalGrade: 0, source: 'no-grade' };
        } catch (error) {
          console.error(`Error fetching grade for exam ${session._id}:`, error);
          return { ...session, finalGrade: 0, source: 'error' };
        }
      })
    );

    // Process the results and create export data
    const validGrades = freshGrades
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result: any) => result.value)
      .filter((session: any) => session.studentName && session.studentName !== 'לא צוין')
      .map((session: any) => {
        console.log(`📊 Export data for ${session.studentName}: Grade=${session.finalGrade}, Source=${session.gradeSource}`);
        
        return {
          studentId: session.studentId || 'לא צוין',
          studentName: session.studentName || 'לא צוין',
          email: session.studentEmail || '',
          finalGrade: session.finalGrade || 0,
          examDate: session.startTime || new Date().toISOString(),
          examId: session._id,
          gradeSource: session.gradeSource || 'unknown'
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'he'));

    console.log(`✅ Successfully processed ${validGrades.length} grades`);

    // Generate CSV content with UTF-8 BOM for proper Hebrew display
    const BOM = '\uFEFF'; // UTF-8 Byte Order Mark
    const csvHeader = 'תעודת זהות,שם סטודנט,ציון סופי,תאריך מבחן,מזהה מבחן,מקור הציון\n';
    const csvRows = validGrades.map(grade => {
      const formatDate = (dateString: string) => {
        try {
          return new Date(dateString).toLocaleDateString('he-IL');
        } catch {
          return 'לא זמין';
        }
      };
      
      return `"${grade.studentId}","${grade.studentName}","${grade.finalGrade}","${formatDate(grade.examDate)}","${grade.examId}","${grade.gradeSource}"`;
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