import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
    }
    const { text, voice = 'Carmit', rate = 200 } = await request.json();
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Clean text for speech
    const cleanText = text
      .replace(/[<>\"'`]/g, '') // Remove potentially dangerous characters
      .trim();

    if (cleanText.length === 0) {
      return NextResponse.json({ error: 'No valid text after cleaning' }, { status: 400 });
    }

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp', 'tts');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate unique filename
    const filename = `speech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.aiff`;
    const filepath = path.join(tempDir, filename);

    // Use macOS 'say' command to generate speech
    // Available voices: say -v ? to list all
    const sayCommand = `say -v "${voice}" -r ${rate} -o "${filepath}" "${cleanText}"`;
    
    console.log('🎤 Running TTS command:', sayCommand);
    
    await execAsync(sayCommand);

    // Check if file was created
    if (!fs.existsSync(filepath)) {
      throw new Error('Audio file was not created');
    }

    // Read the audio file
    const audioBuffer = fs.readFileSync(filepath);
    
    // Clean up temp file
    fs.unlinkSync(filepath);

    // Return audio as response
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/aiff',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache', // Don't cache TTS audio
      },
    });

  } catch (error: any) {
    console.error('TTS Error:', error);
    
    // Handle specific macOS say command errors
    if (error.message.includes('say:')) {
      return NextResponse.json({ 
        error: 'Speech synthesis failed', 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      error: 'TTS service unavailable',
      details: process.platform !== 'darwin' ? 'macOS required for this TTS service' : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to list available voices
export async function GET() {
  try {
    if (process.platform !== 'darwin') {
      return NextResponse.json({ 
        voices: [],
        error: 'Voice listing only available on macOS' 
      });
    }

    const { stdout } = await execAsync('say -v ?');
    const voiceLines = stdout.split('\n').filter(line => line.trim());
    
    const voices = voiceLines.map(line => {
      const match = line.match(/^([^\s]+)\s+([^\s]+)\s+(.+)/);
      if (match) {
        return {
          name: match[1],
          language: match[2], 
          description: match[3]
        };
      }
      return null;
    }).filter(Boolean);

    // Filter for Hebrew and English voices
    const hebrewVoices = voices.filter(v => v?.language.includes('he') || v?.name === 'Carmit');
    const englishVoices = voices.filter(v => v?.language.includes('en')).slice(0, 10); // Limit to 10

    return NextResponse.json({
      voices: {
        hebrew: hebrewVoices,
        english: englishVoices,
        all: voices.length
      }
    });

  } catch (error) {
    console.error('Voice listing error:', error);
    return NextResponse.json({ 
      voices: [], 
      error: 'Failed to list voices' 
    }, { status: 500 });
  }
} 