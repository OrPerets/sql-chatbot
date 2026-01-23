import { NextRequest, NextResponse } from 'next/server';

import {
  getLearningAnnotations,
  LearningAnnotation,
  upsertLearningAnnotations,
} from '@/lib/learning-annotations';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const MAX_ANNOTATIONS = 2000;

const parseAnnotations = (value: unknown): LearningAnnotation[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const sanitized: LearningAnnotation[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const annotation = entry as LearningAnnotation;

    if (
      typeof annotation.id !== 'string' ||
      typeof annotation.page !== 'number' ||
      !Number.isFinite(annotation.page) ||
      (annotation.type !== 'draw' && annotation.type !== 'highlight') ||
      typeof annotation.color !== 'string' ||
      typeof annotation.thickness !== 'number' ||
      !Number.isFinite(annotation.thickness) ||
      !Array.isArray(annotation.points)
    ) {
      return null;
    }

    const points = annotation.points.filter(
      (point) =>
        point &&
        typeof point === 'object' &&
        typeof point.x === 'number' &&
        typeof point.y === 'number' &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
    );

    sanitized.push({
      ...annotation,
      points,
      page: Math.max(1, Math.round(annotation.page)),
      thickness: Math.min(Math.max(annotation.thickness, 1), 12),
      createdAt: new Date(annotation.createdAt ?? Date.now()),
    });

    if (sanitized.length > MAX_ANNOTATIONS) {
      return null;
    }
  }

  return sanitized;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')?.trim() ?? '';
    const pdfId = searchParams.get('pdfId')?.trim() ?? '';

    if (!userId || !pdfId) {
      return NextResponse.json({ error: 'userId and pdfId are required' }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const document = await getLearningAnnotations(userId, pdfId);
    return NextResponse.json({ annotations: document?.annotations ?? [] });
  } catch (error: any) {
    console.error('Failed to load annotations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load annotations' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const pdfId = typeof body.pdfId === 'string' ? body.pdfId.trim() : '';
    const annotations = parseAnnotations(body.annotations);

    if (!userId || !pdfId || !annotations) {
      return NextResponse.json(
        { error: 'userId, pdfId, and annotations are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const document = await upsertLearningAnnotations(userId, pdfId, annotations);
    return NextResponse.json({ annotations: document.annotations });
  } catch (error: any) {
    console.error('Failed to save annotations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save annotations' },
      { status: 500 }
    );
  }
}
