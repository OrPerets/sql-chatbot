'use client';

import React, { useState } from 'react';
import { MichaelAvatarDirect } from '../components/MichaelAvatarDirect';

export default function TestDirectMichael() {
  const [state, setState] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [message, setMessage] = useState('שלום! אני מיכל, העוזר הדיגיטלי שלכם');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const enableAudio = async () => {
    try {
      // Enable audio context with user gesture
      const audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContext.close();
      
      // Test speech synthesis
      const testUtterance = new SpeechSynthesisUtterance('test');
      testUtterance.volume = 0.1;
      speechSynthesis.speak(testUtterance);
      speechSynthesis.cancel();
      
      setAudioEnabled(true);
      console.log('🔊 Audio enabled successfully!');
    } catch (err) {
      console.error('Failed to enable audio:', err);
    }
  };

  const testSpeak = () => {
    if (!audioEnabled) {
      alert('Please enable audio first by clicking the "🔊 Enable Audio" button');
      return;
    }
    setIsSpeaking(true);
    setState('speaking');
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: '24px',
        padding: '32px',
        color: 'white',
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h1 style={{ margin: '0 0 16px 0', fontSize: '32px' }}>🧪 Direct Michael Avatar Test</h1>
        <p style={{ margin: '0', fontSize: '16px', opacity: 0.9 }}>
          Testing the simplified direct approach to the 3D avatar
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px'
      }}>
        {/* Avatar Display */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 24px 0', color: '#374151' }}>Direct Michael Avatar</h2>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <MichaelAvatarDirect
              state={state}
              size="medium"
              text={isSpeaking ? message : undefined}
              onReady={() => console.log('✅ Direct avatar ready!')}
              onError={(error) => console.error('❌ Direct avatar error:', error)}
              onSpeakingStart={() => console.log('🗣️ Speaking started')}
              onSpeakingEnd={() => {
                console.log('🤐 Speaking ended');
                setIsSpeaking(false);
                setState('idle');
              }}
            />
          </div>

          {/* Audio Enable Button */}
          {!audioEnabled && (
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <button
                onClick={enableAudio}
                style={{
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔊 Enable Audio / הפעל שמע
              </button>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                Click to enable speech synthesis (required by browser)
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <button
              onClick={() => setState('idle')}
              style={{
                background: state === 'idle' ? '#3b82f6' : '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              😌 רגוע
            </button>
            
            <button
              onClick={testSpeak}
              disabled={isSpeaking}
              style={{
                background: isSpeaking ? '#10b981' : '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: isSpeaking ? 1 : 0.8
              }}
            >
              {isSpeaking ? '🗣️ מדבר' : '🎤 דבר'}
            </button>
            
            <button
              onClick={() => setState('listening')}
              style={{
                background: state === 'listening' ? '#8b5cf6' : '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              👂 מקשיב
            </button>
            
            <button
              onClick={() => setState('thinking')}
              style={{
                background: state === 'thinking' ? '#f59e0b' : '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🤔 חושב
            </button>
          </div>
        </div>

        {/* Controls & Info */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ margin: '0 0 24px 0', color: '#374151' }}>Test Controls</h2>
          
          {/* Message Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
              Test Message:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                resize: 'vertical',
                minHeight: '80px',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
              placeholder="הכנס הודעה לבדיקה..."
            />
          </div>

          {/* Implementation Notes */}
          <div style={{
            background: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '16px' }}>
              📋 Direct Approach Features
            </h3>
            <ul style={{ margin: '0', paddingLeft: '20px', color: '#6b7280', fontSize: '14px' }}>
              <li>Minimal TalkingHead configuration (no TTS endpoint)</li>
              <li>Multiple fallback strategies for avatar loading</li>
              <li>ReadyPlayer.me avatar integration</li>
              <li>Browser-based speech synthesis</li>
              <li>Simplified error handling</li>
            </ul>
          </div>

          {/* Debug Info */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <strong>Debug Info:</strong><br/>
            State: {state}<br/>
            Speaking: {isSpeaking ? 'Yes' : 'No'}<br/>
            Message Length: {message.length} chars
          </div>
        </div>
      </div>
    </div>
  );
} 