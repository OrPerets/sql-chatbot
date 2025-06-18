"use client";

import React, { useState } from 'react';
import MichaelChatAvatar from '../components/michael-chat-avatar';
import MichaelSimpleAvatar from '../components/michael-simple-avatar';

const Test3DAvatarPage = () => {
  const [testMessage, setTestMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleTestSpeak = async () => {
    const testText = testMessage || 'שלום! אני מייקל, העוזר שלך ללימוד SQL. בואו נתחיל!';
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          voice: 'onyx'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
      
    } catch (error) {
      console.error('Error in test speak:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '800px', 
      margin: '0 auto',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          color: '#333',
          fontSize: '28px'
        }}>
          🎭 Michael Avatar Test
        </h1>

        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#666', marginBottom: '20px' }}>Simple Avatar (No SSR Issues)</h2>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: '30px',
            flexWrap: 'wrap'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h3>Idle</h3>
              <MichaelSimpleAvatar avatarState="idle" size="medium" useIframe={false} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3>Speaking</h3>
              <MichaelSimpleAvatar avatarState="speaking" size="medium" useIframe={false} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3>Listening</h3>
              <MichaelSimpleAvatar avatarState="listening" size="medium" useIframe={false} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3>Thinking</h3>
              <MichaelSimpleAvatar avatarState="thinking" size="medium" useIframe={false} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#666', marginBottom: '20px' }}>Full Avatar with TTS</h2>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <MichaelChatAvatar
              useSimpleAvatar={true}
              size="large"
            />
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#666', marginBottom: '15px' }}>Test Custom Message</h3>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Enter text to speak (Hebrew/English)"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '2px solid #ddd',
              fontSize: '16px',
              marginBottom: '15px'
            }}
          />
          <button
            onClick={handleTestSpeak}
            disabled={isGenerating}
            style={{
              padding: '12px 24px',
              backgroundColor: isGenerating ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {isGenerating ? '🔄 Generating...' : '🗣️ Test Speak'}
          </button>
        </div>

        <div style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '10px',
          marginTop: '30px'
        }}>
          <h3 style={{ color: '#666', marginBottom: '15px' }}>Notes:</h3>
          <ul style={{ color: '#666', lineHeight: '1.6' }}>
            <li>✅ <strong>Audio System:</strong> OpenAI TTS with Hebrew support working perfectly</li>
            <li>🎭 <strong>Simple Avatar:</strong> No SSR issues, animated states, professional look</li>
            <li>🔄 <strong>Iframe Integration:</strong> Can embed your working michael-test-app if running on port 5173</li>
            <li>📱 <strong>Graceful Fallbacks:</strong> Always shows a working avatar, never crashes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Test3DAvatarPage; 