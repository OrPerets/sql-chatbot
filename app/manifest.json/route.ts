import { NextResponse } from 'next/server';
import manifest from './data.json';

export const runtime = 'nodejs';

const MANIFEST_HEADERS = {
  'Content-Type': 'application/manifest+json',
  'Cache-Control': 'public, max-age=3600',
} as const;

/**
 * Route handler for manifest.json. Serves the PWA manifest from bundled JSON
 * (no fs/path) so it works even when those Node modules are not available in
 * the server build (e.g. webpack resolve.fallback).
 */
export async function GET() {
  return NextResponse.json(manifest, {
    status: 200,
    headers: MANIFEST_HEADERS,
  });
}
