import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, COLLECTIONS } from '@/lib/database';
import { generateHomeworkGradesExcelBuffer } from '@/lib/excel-export';
import { ObjectId } from 'mongodb';
import type { Question, Submission, SubmissionSummary } from '@/app/homework/types';

export async function POST(request: NextRequest) {
  try {
    const { homeworkTitle, questions, submissions, summaries, fileName } = await request.json();

    if (!questions || !submissions) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Fetch user data to get emails for all studentIds
    const { db } = await connectToDatabase();
    const studentIds = submissions.map((s: Submission) => s.studentId);
    console.log('Student IDs from submissions:', studentIds);
    console.log('Sample submission object:', submissions[0]);

    // Convert valid ObjectId strings to ObjectId objects for _id lookup
    const objectIds = studentIds
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));

    console.log('Converted ObjectIds:', objectIds.map(id => id.toString()));

    const users = await db
      .collection(COLLECTIONS.USERS)
      .find({
        $or: [
          { email: { $in: studentIds } },
          { id: { $in: studentIds } },
          ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : [])
        ]
      })
      .toArray();

    console.log('Found users:', users.map(u => ({
      email: u.email,
      id: u.id,
      _id: u._id?.toString()
    })));

    // Create a map of studentId -> email
    const emailMap = new Map<string, string>();
    users.forEach((user: any) => {
      const userEmail = user.email;
      const userId = user.id;
      const userMongoId = user._id?.toString();

      // Map by email (if studentId is an email)
      if (userEmail && studentIds.includes(userEmail)) {
        emailMap.set(userEmail, userEmail);
      }
      // Map by id field (if studentId is the id field)
      if (userId && studentIds.includes(userId)) {
        emailMap.set(userId, userEmail);
      }
      // Map by MongoDB _id (if studentId is the ObjectId string)
      if (userMongoId && studentIds.includes(userMongoId)) {
        emailMap.set(userMongoId, userEmail);
      }
    });

    console.log('Email map:', Object.fromEntries(emailMap));

    // Generate the Excel file as buffer
    const excelBuffer = generateHomeworkGradesExcelBuffer({
      homeworkTitle,
      questions,
      submissions,
      summaries,
      fileName,
      emailMap,
    });

    // Return the Excel file as a downloadable response
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error exporting grades:', error);
    return NextResponse.json({ error: 'Failed to export grades' }, { status: 500 });
  }
}