'use client';

import React, { useState } from 'react';
import { enhancedTTS, speakWithMichael } from '../utils/enhanced-tts';

export default function TestVoiceSimple() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Click play to hear Michael\'s natural voice');

  const testSentences = [
    "Hello! I'm Michael, your SQL tutor. Let me explain databases in a clear and natural way.",
    "היי, איזה כיף שקראת לי מייקוש! 😊 איך אפשר לעזור לך היום בלמידה של מסדי נתונים או שאלות ב-SQL?",
    "When you write a SELECT query, you're asking the database to retrieve specific data. Notice how I pause naturally between concepts, making it easier to understand.",
  ];

  const playFullText = async () => {
    if (isPlaying) {
      enhancedTTS.stop();
      setIsPlaying(false);
      setStatus('Stopped');
      return;
    }

    const fullText = testSentences.join(' ');
    
    try {
      setIsPlaying(true);
      setStatus('Playing full text with natural pauses...');
      
      await speakWithMichael(fullText, {
        progressiveMode: false,  // Disable progressive mode
        onStart: () => {
          console.log('🎤 Started speaking full text');
          setStatus('Speaking with natural voice...');
        },
        onEnd: () => {
          console.log('✅ Finished speaking full text');
          setIsPlaying(false);
          setStatus('Completed! Did you hear the entire message with natural pauses?');
        },
        onError: (error) => {
          console.error('❌ Error:', error);
          setIsPlaying(false);
          setStatus(`Error: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Failed:', error);
      setIsPlaying(false);
      setStatus('Failed to play');
    }
  };

  const playSingleSentence = async (sentence: string, index: number) => {
    if (isPlaying) {
      enhancedTTS.stop();
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      setStatus(`Playing sentence ${index + 1}...`);
      
      await speakWithMichael(sentence, {
        progressiveMode: false,
        onStart: () => setStatus(`Speaking sentence ${index + 1}...`),
        onEnd: () => {
          setIsPlaying(false);
          setStatus(`Finished sentence ${index + 1}`);
        },
        onError: (error) => {
          setIsPlaying(false);
          setStatus(`Error: ${error.message}`);
        }
      });
    } catch (error) {
      setIsPlaying(false);
      setStatus('Failed to play');
    }
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'system-ui'
    }}>
      <h1>🎤 Michael Voice Test (Non-Progressive)</h1>
      
      <div style={{
        background: '#f0f0f0',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <p style={{ margin: 0 }}>{status}</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Test Individual Sentences:</h2>
        {testSentences.map((sentence, index) => (
          <div key={index} style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#e0e0e0',
            borderRadius: '8px',
            cursor: 'pointer'
          }} onClick={() => playSingleSentence(sentence, index)}>
            <p style={{ margin: 0 }}>{sentence}</p>
          </div>
        ))}
      </div>

      <button
        onClick={playFullText}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          background: isPlaying ? '#dc2626' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        {isPlaying ? 'Stop' : 'Play All Sentences Together'}
      </button>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#f9f9f9',
        borderRadius: '8px'
      }}>
        <h3>Settings Applied:</h3>
        <ul>
          <li>Speed: 0.9 (natural pace)</li>
          <li>Progressive Mode: Disabled</li>
          <li>Natural Pauses: Enabled</li>
          <li>Enhanced Prosody: Enabled</li>
          <li>Voice: Onyx (warm male) for English, Nova for Hebrew</li>
        </ul>
      </div>
    </div>
  );
} 