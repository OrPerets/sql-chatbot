import { readFile, stat } from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';

import { LEARNING_PDF_FILENAMES } from '@/lib/learning-content';
import { requireAuthenticatedUser } from '@/lib/request-auth';

const resolvePdfPath = (filename: string) =>
  path.join(process.cwd(), 'docs', 'pdfs', filename);

const resolveAuthorizedFilename = (filename: string) => {
  const decodedFilename = decodeURIComponent(filename);

  if (!LEARNING_PDF_FILENAMES.has(decodedFilename)) {
    return null;
  }

  return decodedFilename;
};

const ensureAuthenticated = async (request: NextRequest) => {
  const authResult = await requireAuthenticatedUser(request);
  if (authResult.ok === false) {
    return new Response('Unauthorized', { status: authResult.status });
  }

  return null;
};

export async function HEAD(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const unauthorized = await ensureAuthenticated(request);
  if (unauthorized) {
    return unauthorized;
  }

  const decodedFilename = resolveAuthorizedFilename(params.filename);
  if (!decodedFilename) {
    return new Response('Not found', { status: 404 });
  }

  const pdfPath = resolvePdfPath(decodedFilename);

  try {
    const fileStat = await stat(pdfPath);
    const safeFilename = decodedFilename.replace(/"/g, '');

    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileStat.size.toString(),
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const unauthorized = await ensureAuthenticated(request);
  if (unauthorized) {
    return unauthorized;
  }

  const decodedFilename = resolveAuthorizedFilename(params.filename);
  if (!decodedFilename) {
    return new Response('Not found', { status: 404 });
  }

  const pdfPath = resolvePdfPath(decodedFilename);

  try {
    const fileBuffer = await readFile(pdfPath);
    const safeFilename = decodedFilename.replace(/"/g, '');

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}
