"use client";

import React, { useState, useRef } from 'react';
import MichaelChatAvatar from '../components/michael-chat-avatar';
import { enhancedTTS } from '../utils/enhanced-tts';

const VoiceOptimizationTest = () => {
  const [testText, setTestText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [latencyLog, setLatencyLog] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<'standard' | 'lowLatency' | 'preload'>('lowLatency');
  const startTimeRef = useRef<number>(0);

  const testMessages = [
    "Hello! I'm Michael, your SQL tutor. Let me help you learn database queries.",
    "Great question! In SQL, SELECT statements are used to retrieve data from tables.",
    "שלום! אני מיכאל, המורה שלכם למסדי נתונים. בואו נלמד SQL יחד!",
    "Let's try a JOIN query. This combines data from multiple tables based on related columns.",
    "Perfect! You're making excellent progress with these SQL concepts."
  ];

  const logLatency = (event: string, time?: number) => {
    const timestamp = time || performance.now();
    const elapsed = startTimeRef.current ? timestamp - startTimeRef.current : 0;
    const logEntry = `${event}: ${elapsed.toFixed(0)}ms (${new Date().toLocaleTimeString()})`;
    console.log(`📊 ${logEntry}`);
    setLatencyLog(prev => [logEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
  };

  const testVoiceOptimization = async (text: string) => {
    if (!text.trim()) return;

    setIsGenerating(true);
    startTimeRef.current = performance.now();
    logLatency('🚀 Speech request started', startTimeRef.current);

    try {
      const options = {
        voice: 'onyx',
        speed: 1.1,
        volume: 0.9,
        useOpenAI: true,
        characterStyle: 'university_ta' as const,
        humanize: true,
        lowLatency: selectedMode === 'lowLatency',
        preload: selectedMode === 'preload',
        onStart: () => {
          logLatency('🎤 Audio playback started');
        },
        onEnd: () => {
          logLatency('✅ Audio playback completed');
          setIsGenerating(false);
        },
        onError: (error: Error) => {
          logLatency(`❌ Error: ${error.message}`);
          setIsGenerating(false);
        }
      };

      await enhancedTTS.speak(text, options);

    } catch (error) {
      console.error('Test failed:', error);
      logLatency(`💥 Test failed: ${error}`);
      setIsGenerating(false);
    }
  };

  const testWithRandomMessage = () => {
    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
    setTestText(randomMessage);
    testVoiceOptimization(randomMessage);
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '24px',
        padding: '32px',
        color: 'white',
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h1 style={{ margin: '0 0 16px 0', fontSize: '28px' }}>
          🚀 Michael's Voice Optimization Test
        </h1>
        <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
          Testing low-latency, human-like speech with the "onyx" voice
        </p>
        <div style={{ 
          marginTop: '16px', 
          padding: '12px 24px', 
          background: 'rgba(255,255,255,0.2)', 
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          Target: &lt;1 second delay from text to speech
        </div>
      </div>

      {/* Michael Avatar */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <MichaelChatAvatar
          text={testText}
          autoPlay={false}
          size="large"
        />
      </div>

      {/* Test Mode Selection */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', color: '#374151' }}>Test Mode:</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { key: 'lowLatency', label: 'Low Latency ⚡', color: '#10b981' },
            { key: 'preload', label: 'Preload Mode 🚀', color: '#3b82f6' },
            { key: 'standard', label: 'Standard 📱', color: '#6b7280' }
          ].map(mode => (
            <button
              key={mode.key}
              onClick={() => setSelectedMode(mode.key as any)}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: 'none',
                background: selectedMode === mode.key ? mode.color : '#f3f4f6',
                color: selectedMode === mode.key ? 'white' : '#374151',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Test Input */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '8px', color: '#374151' }}>Test Text:</h3>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          style={{
            width: '100%',
            height: '120px',
            padding: '16px',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
          placeholder="Enter text for Michael to speak..."
        />
      </div>

      {/* Test Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => testVoiceOptimization(testText)}
          disabled={!testText.trim() || isGenerating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: isGenerating 
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: testText.trim() && !isGenerating ? 'pointer' : 'not-allowed',
            opacity: testText.trim() && !isGenerating ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
        >
          {isGenerating ? '⏳ Speaking...' : '🎤 Test Voice'}
        </button>

        <button
          onClick={testWithRandomMessage}
          disabled={isGenerating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: !isGenerating ? 'pointer' : 'not-allowed',
            opacity: !isGenerating ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
        >
          🎲 Random Test
        </button>

        <button
          onClick={() => {
            enhancedTTS.stop();
            setIsGenerating(false);
            setLatencyLog([]);
          }}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🛑 Stop & Clear
        </button>
      </div>

      {/* Performance Metrics */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        border: '2px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>
          📊 Performance Metrics (Last 10 Tests)
        </h3>
        
        {latencyLog.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
            No tests run yet. Click "Test Voice" to measure latency.
          </p>
        ) : (
          <div style={{
            background: '#1f2937',
            borderRadius: '8px',
            padding: '16px',
            color: '#f9fafb',
            fontFamily: 'Courier New, monospace',
            fontSize: '13px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {latencyLog.map((entry, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {entry}
              </div>
            ))}
          </div>
        )}

        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#ecfccb', 
          borderRadius: '8px',
          fontSize: '14px',
          color: '#365314'
        }}>
          <strong>💡 Optimization Features:</strong>
          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
            <li>Uses OpenAI TTS-1-HD with "onyx" voice for human-like warmth</li>
            <li>Low-latency mode skips complex processing for faster response</li>
            <li>Preload mode generates audio in parallel with text rendering</li>
            <li>Audio caching for instant replay of repeated phrases</li>
            <li>Optimized speed settings (1.1x) for natural conversation flow</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceOptimizationTest; 