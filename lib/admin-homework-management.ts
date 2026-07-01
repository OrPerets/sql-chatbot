import { ObjectId } from 'mongodb';

import type { HomeworkSet, Question, Submission } from '@/app/homework/types';
import { DEFAULT_ADMIN_EMAILS } from '@/lib/admin-emails';
import { COLLECTIONS, executeWithRetry } from '@/lib/database';
import { getHomeworkAvailabilityInfo } from '@/lib/deadline-utils';
import {
  getHomeworkAccessOverridesForSet,
  toStrictPersonalAccessWindow,
  type HomeworkAccessOverride,
} from '@/lib/homework-access-overrides';
import { getHomeworkSetById, listHomeworkSets } from '@/lib/homework';
import { getQuestionsByHomeworkSet } from '@/lib/questions';
import type { SubmissionModel } from '@/lib/models';
import type { UserModel } from '@/lib/users';

export interface AdminHomeworkUserRow {
  user: {
    id?: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    studentIdNumber?: string;
    role?: string;
  };
  access: {
    availabilityState: string;
    accessible: boolean;
    availabilityMessage: string;
    globalAvailableFrom?: string;
    globalAvailableUntil?: string;
    effectiveAvailableFrom?: string;
    effectiveAvailableUntil?: string;
    hasOverride: boolean;
    override?: HomeworkAccessOverride;
  };
  submission: {
    id?: string;
    status: Submission['status'] | 'none';
    overallScore?: number;
    submittedAt?: string;
    gradedAt?: string;
    attemptNumber?: number;
    answeredCount: number;
    totalQuestions: number;
    progress: number;
  };
}

export interface AdminHomeworkManagementPayload {
  homeworkSets: HomeworkSet[];
  selectedSet: HomeworkSet | null;
  rows: AdminHomeworkUserRow[];
  summary: {
    totalUsers: number;
    noSubmission: number;
    inProgress: number;
    submitted: number;
    graded: number;
    blockedByClosedWindow: number;
    overrides: number;
  };
}

export interface AdminHomeworkSubmissionPayload {
  user: AdminHomeworkUserRow['user'] | null;
  homeworkSet: HomeworkSet | null;
  questions: Question[];
  submission: Submission | null;
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function getUserName(user: UserModel): string {
  const explicit = user.name?.trim();
  if (explicit) return explicit;
  const parts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return parts || user.email;
}

function getUserRecordId(user: UserModel): string | undefined {
  return user._id?.toString?.() || user.id;
}

function isCurrentStudentUser(user: UserModel): boolean {
  const email = normalizeEmail(user.email);
  const role = String(user.role || '').trim().toLowerCase();
  if (!email) return false;
  if (DEFAULT_ADMIN_EMAILS.map((adminEmail) => adminEmail.toLowerCase()).includes(email)) return false;
  return !['admin', 'instructor', 'teacher', 'builder'].includes(role);
}

function normalizeSubmissionRecord(submission: SubmissionModel | null | undefined): Submission | null {
  if (!submission) return null;
  return {
    id: submission._id?.toString() || submission.id,
    homeworkSetId: submission.homeworkSetId,
    studentId: submission.studentId,
    attemptNumber: submission.attemptNumber,
    answers: submission.answers || {},
    overallScore: submission.overallScore,
    status: submission.status,
    submittedAt: submission.submittedAt,
    gradedAt: submission.gradedAt,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    studentTableData: submission.studentTableData,
    aiCommitment: submission.aiCommitment,
  };
}

function countAnswered(submission: Submission | null): number {
  if (!submission) return 0;
  return Object.values(submission.answers || {}).filter((answer) => {
    const sql = answer?.sql?.trim();
    const expression = answer?.expression?.trim();
    return Boolean(sql || expression || answer?.feedback);
  }).length;
}

function buildSubmissionQuery(homeworkSetId: string, studentIds: string[], userEmails: string[]) {
  return {
    homeworkSetId,
    studentId: { $in: Array.from(new Set([...studentIds, ...userEmails].filter(Boolean))) },
  };
}

function buildStudentIdentifierQuery(studentId: string) {
  const normalized = normalizeEmail(studentId);
  return {
    $or: [
      { email: normalized },
      { id: studentId },
      ...(ObjectId.isValid(studentId) ? [{ _id: new ObjectId(studentId) }] : []),
    ],
  } as any;
}

function getStudentSubmissionIdentifiers(studentId: string, user: UserModel | null): string[] {
  return Array.from(new Set([
    studentId,
    normalizeEmail(studentId),
    user ? normalizeEmail(user.email) : '',
    user ? getUserRecordId(user) || '' : '',
  ].filter(Boolean)));
}

async function loadCurrentUsersAndSubmissions(homeworkSetId: string) {
  return executeWithRetry(async (db) => {
    const users = await db
      .collection<UserModel>(COLLECTIONS.USERS)
      .find({})
      .sort({ lastName: 1, firstName: 1, name: 1, email: 1 })
      .toArray();
    const currentUsers = users.filter(isCurrentStudentUser);
    const userIds = currentUsers.map(getUserRecordId).filter((id): id is string => Boolean(id));
    const emails = currentUsers.map((user) => normalizeEmail(user.email)).filter(Boolean);
    const submissions = await db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .find(buildSubmissionQuery(homeworkSetId, userIds, emails))
      .toArray();

    return { currentUsers, submissions };
  });
}

export async function getAdminHomeworkManagementPayload(
  setId?: string | null,
): Promise<AdminHomeworkManagementPayload> {
  const homeworkSetsResult = await listHomeworkSets({ pageSize: 1000 });
  const homeworkSets = homeworkSetsResult.items;
  const selectedSet = setId
    ? await getHomeworkSetById(setId)
    : homeworkSets[0] ?? null;

  if (!selectedSet) {
    return {
      homeworkSets,
      selectedSet: null,
      rows: [],
      summary: {
        totalUsers: 0,
        noSubmission: 0,
        inProgress: 0,
        submitted: 0,
        graded: 0,
        blockedByClosedWindow: 0,
        overrides: 0,
      },
    };
  }

  const [{ currentUsers, submissions }, overridesByEmail, questions] = await Promise.all([
    loadCurrentUsersAndSubmissions(selectedSet.id),
    getHomeworkAccessOverridesForSet(selectedSet.id),
    getQuestionsByHomeworkSet(selectedSet.id),
  ]);

  const submissionByStudentId = new Map<string, Submission>();
  submissions.forEach((record) => {
    const normalized = normalizeSubmissionRecord(record);
    if (!normalized) return;
    submissionByStudentId.set(normalized.studentId, normalized);
  });

  const totalQuestions = Math.max(questions.length || selectedSet.questionOrder?.length || 0, 0);

  const rows = currentUsers.map<AdminHomeworkUserRow>((user) => {
    const email = normalizeEmail(user.email);
    const userId = getUserRecordId(user);
    const submission = submissionByStudentId.get(email) || (userId ? submissionByStudentId.get(userId) : undefined) || null;
    const override = overridesByEmail.get(email);
    const availability = getHomeworkAvailabilityInfo(
      selectedSet,
      email,
      undefined,
      toStrictPersonalAccessWindow(override),
    );
    const answeredCount = countAnswered(submission);

    return {
      user: {
        id: userId,
        email,
        name: getUserName(user),
        firstName: user.firstName,
        lastName: user.lastName,
        studentIdNumber: user.studentIdNumber,
        role: user.role,
      },
      access: {
        availabilityState: availability.availabilityState,
        accessible: availability.accessible,
        availabilityMessage: availability.availabilityMessage,
        globalAvailableFrom: selectedSet.availableFrom,
        globalAvailableUntil: selectedSet.availableUntil || selectedSet.dueAt,
        effectiveAvailableFrom: override?.availableFrom || selectedSet.availableFrom,
        effectiveAvailableUntil: availability.effectiveAvailableUntil,
        hasOverride: Boolean(override),
        override,
      },
      submission: {
        id: submission?.id,
        status: submission?.status || 'none',
        overallScore: submission?.overallScore,
        submittedAt: submission?.submittedAt,
        gradedAt: submission?.gradedAt,
        attemptNumber: submission?.attemptNumber,
        answeredCount,
        totalQuestions,
        progress: totalQuestions > 0 ? Math.min(1, Number((answeredCount / totalQuestions).toFixed(2))) : 0,
      },
    };
  });

  const summary = rows.reduce<AdminHomeworkManagementPayload['summary']>(
    (acc, row) => {
      acc.totalUsers += 1;
      if (row.access.hasOverride) acc.overrides += 1;
      if (!row.access.accessible && row.access.availabilityState === 'closed') acc.blockedByClosedWindow += 1;
      if (row.submission.status === 'none') acc.noSubmission += 1;
      if (row.submission.status === 'in_progress') acc.inProgress += 1;
      if (row.submission.status === 'submitted') acc.submitted += 1;
      if (row.submission.status === 'graded') acc.graded += 1;
      return acc;
    },
    {
      totalUsers: 0,
      noSubmission: 0,
      inProgress: 0,
      submitted: 0,
      graded: 0,
      blockedByClosedWindow: 0,
      overrides: 0,
    },
  );

  return {
    homeworkSets,
    selectedSet,
    rows,
    summary,
  };
}

export async function getAdminHomeworkSubmissionPayload(
  homeworkSetId: string,
  studentId: string,
): Promise<AdminHomeworkSubmissionPayload> {
  const [homeworkSet, questions] = await Promise.all([
    getHomeworkSetById(homeworkSetId),
    getQuestionsByHomeworkSet(homeworkSetId),
  ]);

  const { user, submission } = await executeWithRetry(async (db) => {
    const record = await db.collection<UserModel>(COLLECTIONS.USERS).findOne(buildStudentIdentifierQuery(studentId));
    const identifiers = getStudentSubmissionIdentifiers(studentId, record);
    const submissionRecord = await db.collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS).findOne({
      homeworkSetId,
      studentId: { $in: identifiers },
    });

    return {
      user: record
        ? {
            id: getUserRecordId(record),
            email: normalizeEmail(record.email),
            name: getUserName(record),
            firstName: record.firstName,
            lastName: record.lastName,
            studentIdNumber: record.studentIdNumber,
            role: record.role,
          }
        : null,
      submission: normalizeSubmissionRecord(submissionRecord),
    };
  });

  return {
    user,
    homeworkSet,
    questions,
    submission,
  };
}

export async function reopenHomeworkSubmission(
  homeworkSetId: string,
  studentId: string,
  actorEmail: string,
): Promise<Submission> {
  return executeWithRetry(async (db) => {
    const now = new Date().toISOString();
    const user = await db.collection<UserModel>(COLLECTIONS.USERS).findOne(buildStudentIdentifierQuery(studentId));
    const identifiers = getStudentSubmissionIdentifiers(studentId, user);
    const submission = await db.collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS).findOne({
      homeworkSetId,
      studentId: { $in: identifiers },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    const normalized = normalizeSubmissionRecord(submission);
    if (!normalized) {
      throw new Error('Submission not found');
    }

    await db.collection(COLLECTIONS.HOMEWORK_SUBMISSION_ARCHIVES).insertOne({
      archivedAt: now,
      archivedBy: normalizeEmail(actorEmail),
      action: 'admin_reopen',
      homeworkSetId,
      studentId,
      submissionId: normalized.id,
      submission,
    });

    const result = await db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOneAndUpdate(
        { _id: submission._id },
        {
          $set: {
            status: 'in_progress',
            updatedAt: now,
          },
          $unset: {
            submittedAt: '',
          },
        },
        { returnDocument: 'after' },
      );

    const reopened = normalizeSubmissionRecord(result);
    if (!reopened) {
      throw new Error('Failed to reopen submission');
    }

    return reopened;
  });
}
