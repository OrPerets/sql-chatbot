"use client";

import React, { useState } from 'react';
import SmartMichaelAvatar from '../components/SmartMichaelAvatar';

export default function TestMichaelIntegration() {
  const [text, setText] = useState('שלום! אני מיכל, העוזר הדיגיטלי שלכם. אני כאן כדי לעזור לכם ללמוד SQL בצורה האפקטיבית ביותר.');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [preferMichael, setPreferMichael] = useState(true);
  const [fallbackToLottie, setFallbackToLottie] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(3000);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const testMessages = [
    'שלום! אני מיכל, העוזר הדיגיטלי שלכם.',
    'בואו נתחיל ללמוד SQL יחד. איזה נושא מעניין אתכם?',
    'SQL הוא שפה חזקה לניהול מסדי נתונים. בואו נראה איך היא עובדת.',
    'הפקודה SELECT היא הבסיס של כל שאילתה. נתחיל ממנה.'
  ];

  const handleTestMessage = (message: string) => {
    setText(message);
    setIsThinking(true);
    
    setTimeout(() => {
      setIsThinking(false);
    }, 2000);
  };

  return (
    <div style={{ 
      padding: '32px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '24px',
        padding: '32px',
        color: 'white',
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h1 style={{ margin: '0 0 16px 0', fontSize: '32px' }}>
          🎭 Michael Avatar Integration Test
        </h1>
        <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
          Testing smart 3D avatar with graceful fallback to Lottie animations
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Avatar Display */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 24px 0', color: '#374151' }}>Smart Michael Avatar</h2>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '24px',
            position: 'relative' 
          }}>
            <SmartMichaelAvatar
              text={text}
              autoPlay={isSpeaking}
              size={size}
              isListening={isListening}
              isThinking={isThinking}
              preferMichael={preferMichael}
              fallbackToLottie={fallbackToLottie}
              loadTimeout={loadTimeout}
              onSpeechStart={() => setIsSpeaking(true)}
              onSpeechEnd={() => setIsSpeaking(false)}
            />
          </div>

          {/* Status Indicators */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'center',
            marginBottom: '16px' 
          }}>
            <button
              onClick={() => setIsListening(!isListening)}
              style={{
                background: isListening ? '#10b981' : '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isListening ? '👂 מקשיב' : '🔇 לא מקשיב'}
            </button>
            
            <button
              onClick={() => setIsThinking(!isThinking)}
              style={{
                background: isThinking ? '#8b5cf6' : '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isThinking ? '🤔 חושב' : '💭 לא חושב'}
            </button>
            
            <button
              onClick={() => setIsSpeaking(!isSpeaking)}
              style={{
                background: isSpeaking ? '#ef4444' : '#10b981',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isSpeaking ? '🔇 עצור דיבור' : '🗣️ התחל לדבר'}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ margin: '0 0 24px 0', color: '#374151' }}>Controls & Settings</h2>

          {/* Avatar Settings */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#4b5563', fontSize: '16px' }}>
              Avatar Settings
            </h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#6b7280' }}>
                Size:
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px'
                }}
              >
                <option value="small">Small (200px)</option>
                <option value="medium">Medium (300px)</option>
                <option value="large">Large (400px)</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#6b7280' }}>
                <input
                  type="checkbox"
                  checked={preferMichael}
                  onChange={(e) => setPreferMichael(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Prefer 3D Michael Avatar
              </label>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#6b7280' }}>
                <input
                  type="checkbox"
                  checked={fallbackToLottie}
                  onChange={(e) => setFallbackToLottie(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Fallback to Lottie
              </label>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#6b7280' }}>
                Load Timeout: {loadTimeout}ms
              </label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={loadTimeout}
                onChange={(e) => setLoadTimeout(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Test Messages */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#4b5563', fontSize: '16px' }}>
              Test Messages
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {testMessages.map((message, index) => (
                <button
                  key={index}
                  onClick={() => handleTestMessage(message)}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'right',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    color: '#374151'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  {message}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <h3 style={{ margin: '0 0 12px 0', color: '#4b5563', fontSize: '16px' }}>
              Custom Message
            </h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a custom message for Michael to speak..."
              style={{
                width: '100%',
                height: '80px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>
      </div>

      {/* Implementation Notes */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        marginTop: '32px'
      }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#374151' }}>🔧 Implementation Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '16px' }}>✅ Smart Loading</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              Tries to load 3D Michael avatar first, with configurable timeout and graceful fallback.
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '16px' }}>🔄 Bulletproof Fallback</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              If 3D avatar fails, seamlessly switches to proven Lottie animation system.
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '16px' }}>⚡ Progressive Enhancement</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              Zero breaking changes - existing functionality continues working while adding 3D capabilities.
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '16px' }}>🎭 State Synchronization</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              Both 3D and 2D avatars respond to the same state changes (speaking, listening, thinking).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 