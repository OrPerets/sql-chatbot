import { NextRequest, NextResponse } from 'next/server';
import { getSubmissionsService } from '@/lib/submissions';

/**
 * GET /api/submissions/by-id/[submissionId]/table-data
 * 
 * Returns the student-specific table data for a submission
 * This is used by instructors during grading to see what data the student worked with
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  try {
    const submissionId = params.submissionId;
    
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID is required' },
        { status: 400 }
      );
    }

    const submissionsService = await getSubmissionsService();
    const submission = await submissionsService.getSubmissionById(submissionId);

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Return the student table data
    return NextResponse.json({
      submissionId: submission.id,
      studentId: submission.studentId,
      homeworkSetId: submission.homeworkSetId,
      tableData: submission.studentTableData || {},
      hasTableData: Boolean(submission.studentTableData && Object.keys(submission.studentTableData).length > 0),
    });
  } catch (error: any) {
    console.error('Error fetching submission table data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch submission table data' },
      { status: 500 }
    );
  }
}

