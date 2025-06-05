import { NextRequest, NextResponse } from 'next/server';
import { validateImageFile, saveFile, validateAuthToken } from '@/app/utils/upload';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    if (!validateAuthToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Please provide a valid Bearer token.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided. Please upload an image.' },
        { status: 400 }
      );
    }

    // Validate the image file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Save the file and get public URL
    const publicUrl = await saveFile(file, 'image');
    
    // Use the custom API route for file serving
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : request.headers.get('origin');

    // Use both the direct static URL and API route URL as fallback
    const staticUrl = `${baseUrl}${publicUrl}`;
    const apiUrl = `${baseUrl}/api/uploads${publicUrl.replace('/uploads', '')}`;
    
    const fullUrl = staticUrl; // Primary URL
    const fallbackUrl = apiUrl; // Fallback URL

    return NextResponse.json({
      success: true,
      url: fullUrl,
      fallbackUrl: fallbackUrl,
      filename: file.name,
      size: file.size,
      type: file.type
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
} 