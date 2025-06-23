'use client';

import React, { useState } from 'react';
import { Play, Square, Mic, Settings } from 'lucide-react';
import { enhancedTTS, speakWithMichael } from '../utils/enhanced-tts';
import MichaelAvatarDirect from '../components/MichaelAvatarDirect';

export default function TestMichaelVoice() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedExample, setSelectedExample] = useState(0);
  const [status, setStatus] = useState('Ready to test Michael\'s improved voice');

  const testExamples = [
    {
      title: "Natural Greeting",
      text: "Hello! I'm Michael, your SQL tutor. Let me help you understand databases in a clear and natural way. I'll speak at a comfortable pace with thoughtful pauses.",
    },
    {
      title: "SQL Explanation with Pauses",
      text: "Let's explore SQL queries. When you write SELECT * FROM students, you're asking the database for all student records. Notice how I pause naturally between concepts, making it easier to follow along.",
    },
    {
      title: "Complex Technical Content",
      text: "Database normalization is important. First Normal Form eliminates duplicate data. Second Normal Form removes partial dependencies. Third Normal Form addresses transitive dependencies. Each concept builds on the previous one.",
    },
    {
      title: "Encouraging Feedback",
      text: "Excellent work! You've mastered the JOIN concept. This is a fundamental skill in SQL, and you're making great progress. Let's build on this foundation with more advanced queries.",
    },
    {
      title: "Long Explanation",
      text: "SQL injection is a serious security vulnerability. It occurs when user input is directly concatenated into SQL queries without proper sanitization. To prevent this, always use parameterized queries or prepared statements. This ensures that user input is treated as data, not as executable SQL code. Remember, security should be a top priority in any database application.",
    }
  ];

  const playExample = async (text: string) => {
    if (isPlaying) {
      enhancedTTS.stop();
      setIsPlaying(false);
      setStatus('Stopped');
      return;
    }

    try {
      setIsPlaying(true);
      setStatus('Speaking with natural, human-like voice...');
      
      await speakWithMichael(text, {
        onStart: () => {
          console.log('🎤 Voice test started');
          setStatus('Michael is speaking naturally...');
        },
        onEnd: () => {
          console.log('✅ Voice test completed');
          setIsPlaying(false);
          setStatus('Finished speaking - did you notice the natural pauses?');
        },
        onError: (error) => {
          console.error('❌ Voice test error:', error);
          setIsPlaying(false);
          setStatus(`Error: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Failed to play:', error);
      setIsPlaying(false);
      setStatus('Failed to play audio');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      color: 'white',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          🎙️ Michael's Natural Voice Test
        </h1>
        
        <p style={{
          textAlign: 'center',
          fontSize: '1.2rem',
          marginBottom: '2rem',
          opacity: 0.9
        }}>
          Testing improved human-like speech with natural pauses and rhythm
        </p>

        {/* Status Display */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'center',
          marginBottom: '2rem',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>{status}</p>
        </div>

        {/* Avatar Display */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            padding: '2rem',
            backdropFilter: 'blur(10px)'
          }}>
            <MichaelAvatarDirect
              state={isPlaying ? 'speaking' : 'idle'}
              size="large"
              onReady={() => console.log('Avatar ready')}
              onError={(error) => console.error('Avatar error:', error)}
              progressiveMode={false}
              isStreaming={false}
            />
          </div>
        </div>

        {/* Test Examples */}
        <div style={{
          display: 'grid',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {testExamples.map((example, index) => (
            <div
              key={index}
              style={{
                background: selectedExample === index ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                border: selectedExample === index ? '2px solid rgba(255, 255, 255, 0.5)' : '2px solid transparent'
              }}
              onClick={() => setSelectedExample(index)}
            >
              <h3 style={{ margin: '0 0 0.5rem 0' }}>{example.title}</h3>
              <p style={{ margin: 0, opacity: 0.9 }}>{example.text}</p>
            </div>
          ))}
        </div>

        {/* Play Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <button
            onClick={() => playExample(testExamples[selectedExample].text)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              background: isPlaying ? '#dc2626' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {isPlaying ? <Square size={24} /> : <Play size={24} />}
            {isPlaying ? 'Stop' : 'Play Selected Example'}
          </button>
        </div>

        {/* Settings Info */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>
            <Settings size={24} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Current Voice Settings
          </h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <p>✅ <strong>Speed:</strong> 0.9 (reduced from 1.0 for natural pace)</p>
            <p>✅ <strong>Voice:</strong> Onyx (warm, friendly male voice)</p>
            <p>✅ <strong>Sentence Pauses:</strong> 350ms (increased from 150ms)</p>
            <p>✅ <strong>Clause Pauses:</strong> 200ms (increased from 50ms)</p>
            <p>✅ <strong>Enhanced Prosody:</strong> Enabled</p>
            <p>✅ <strong>Natural Pauses:</strong> Enabled</p>
            <p>✅ <strong>Human-like Speech:</strong> Enabled</p>
            <p>✅ <strong>Audio Completion:</strong> Ensured with proper event handling</p>
          </div>
        </div>
      </div>
    </div>
  );
} 