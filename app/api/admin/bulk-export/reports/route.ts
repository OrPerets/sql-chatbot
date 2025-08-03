import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../config';
import JSZip from 'jszip';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    console.log('🏁 Starting bulk reports export...');
    
    // Fetch all final exams
    const examsResponse = await fetch(`${SERVER_BASE}/admin/final-exams`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!examsResponse.ok) {
      throw new Error('Failed to fetch exam sessions');
    }

    const examsData = await examsResponse.json();
    let examSessions = examsData.exams || examsData;
    
    // Also try to fetch regular exam sessions in case some students are there
    try {
      const regularExamsResponse = await fetch(`${SERVER_BASE}/admin/exam-sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      
      if (regularExamsResponse.ok) {
        const regularData = await regularExamsResponse.json();
        const regularSessions = regularData.exams || regularData;
        
        // Combine both sources, removing duplicates by ID
        const allSessions = [...examSessions, ...regularSessions];
        const uniqueSessions = allSessions.filter((session, index, arr) => 
          arr.findIndex(s => s._id === session._id) === index
        );
        examSessions = uniqueSessions;
        console.log(`📊 Combined ${examSessions.length} total exam sessions from both sources`);
      }
    } catch (err) {
      console.log('Could not fetch regular exam sessions, using final exams only:', err);
    }
    
    // Include ALL exams that have student data (not just 'completed' status)
    const validExams = examSessions.filter((session: any) => 
      session.studentEmail || session.studentName || session.studentId
    );

    console.log(`📊 Found ${validExams.length} exams with student data to export reports for`);

    if (validExams.length === 0) {
      return NextResponse.json(
        { error: 'לא נמצאו בחינות עם מידע סטודנטים לייצוא' },
        { status: 404 }
      );
    }

    // Create ZIP file
    const zip = new JSZip();
    
    // Generate reports for all exams with student data
    const reportPromises = validExams.map(async (session: any, index: number) => {
      try {
        console.log(`📝 Processing report ${index + 1}/${validExams.length} for student: ${session.studentName}`);
        
        // Fetch report data using existing API endpoint
        const baseUrl = request.nextUrl.origin;
        const reportResponse = await fetch(`${baseUrl}/api/admin/exam/${session._id}/report`);
        
        if (!reportResponse.ok) {
          // Try final exam endpoint if regular exam fails
          const finalExamResponse = await fetch(`${baseUrl}/api/admin/final-exam/${session._id}/report`);
          if (!finalExamResponse.ok) {
            console.error(`Failed to fetch report for exam ${session._id}`);
            return null;
          }
          const reportData = await finalExamResponse.json();
          return { session, reportData };
        }
        
        const reportData = await reportResponse.json();
        return { session, reportData };
        
      } catch (error) {
        console.error(`Error generating report for exam ${session._id}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(reportPromises);
    const validReports = results
      .filter((result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);

    console.log(`✅ Successfully generated ${validReports.length} reports`);

    // Add each report to ZIP
    for (const { session, reportData } of validReports) {
      const htmlContent = generateReportHTML(reportData);
      const fileName = `דוח_${reportData.studentInfo.name}_${reportData.studentInfo.studentId}.html`;
      zip.file(fileName, htmlContent);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    // Generate safe filename (ASCII-only for HTTP headers)
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `reports_export_${dateStr}.zip`;
    const hebrewFilename = encodeURIComponent(`דוחות_ציונים_${dateStr}.zip`);

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${hebrewFilename}`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error in bulk reports export:', error);
    return NextResponse.json(
      { error: 'Failed to export reports', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to generate HTML report (copied and modified from the main grading page)
function generateReportHTML(reportData: any): string {
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

    .questions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 0.95em;
    }

    .questions-table th,
    .questions-table td {
      border: 1px solid #dee2e6;
      padding: 14px;
      vertical-align: top;
    }

    .questions-table th {
      background-color: #f1f1f1;
      font-weight: 600;
      color: #333;
    }

    .questions-table td {
      background-color: #ffffff;
      border: 1px solid #e2e6ea;
      padding: 16px 12px;
      vertical-align: top;
    }

    .questions-table .col-question {
      width: 15%;
      text-align: right;
    }

    .questions-table .col-answer {
      width: 30%;
      text-align: right;
      direction: ltr;
      font-family: monospace;
      white-space: pre-wrap;
      background-color: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      border-right: 3px solid #007bff;
      overflow-x: auto;
      display: block;
      min-height: 80px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .questions-table .col-score {
      width: 10%;
      text-align: center;
      font-weight: bold;
    }

    .questions-table .col-feedback {
      width: 45%;
      text-align: right;
    }

    .feedback-text {
      background-color: #f8f9fa;
      border-left: 3px solid #2196f3;
      padding: 12px;
      border-radius: 4px;
      white-space: pre-wrap;
    }

    .score-full { color: #2e7d32; }
    .score-partial { color: #ef6c00; }
    .score-zero { color: #c62828; }
    .score-ungraded { color: #757575; font-style: italic; }

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
      <div class="logo-placeholder">🎓</div>
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
          ${questions.map((q: any) => {
            const gradeInfo = getGradeDisplay(q);
            return `
              <tr>
                <td class="col-question">
                  <div style="font-weight: bold; margin-bottom: 8px;">שאלה ${q.questionNumber}</div>
                  <div style="color: #555; line-height: 1.4;">${q.questionText || 'שאלה לא זמינה'}</div>
                </td>
                <td class="col-answer">
                  ${q.studentAnswer || 'לא נענתה'}
                </td>
                <td class="col-score">
                  <div class="score-badge score-${gradeInfo.class}">
                    ${gradeInfo.icon} ${gradeInfo.text}
                  </div>
                </td>
                <td class="col-feedback">
                  ${q.feedback 
                    ? `<div class="feedback-text">${q.feedback}</div>` 
                    : '<div class="no-feedback">אין הערות</div>'}
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
}