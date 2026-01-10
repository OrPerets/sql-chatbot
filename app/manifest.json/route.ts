import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Route handler for manifest.json to ensure it's always publicly accessible
 * This prevents 401 errors in Vercel preview deployments
 */
export async function GET() {
  try {
    // Read the manifest.json from public folder
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading manifest.json:', error);
    // Return a basic manifest if file read fails
    return NextResponse.json({
      name: 'Michael - SQL Assistant',
      short_name: 'Michael',
      start_url: '/',
      display: 'standalone',
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    });
  }
}
