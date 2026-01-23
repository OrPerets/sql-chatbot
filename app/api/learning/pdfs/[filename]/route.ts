import { readFile } from 'fs/promises';
import path from 'path';

import { LEARNING_PDF_FILENAMES } from '@/lib/learning-content';

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  const decodedFilename = decodeURIComponent(params.filename);

  if (!LEARNING_PDF_FILENAMES.has(decodedFilename)) {
    return new Response('Not found', { status: 404 });
  }

  const pdfPath = path.join(process.cwd(), 'docs', 'pdfs', decodedFilename);

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
