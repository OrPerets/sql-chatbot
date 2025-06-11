"use client";

import React, { useState } from 'react';
import { Play, Square, Settings } from 'lucide-react';
import MichaelChatAvatar from './michael-chat-avatar';
import EnhancedVoiceSettings from './enhanced-voice-settings';
import { enhancedTTS, TTSOptions, AVAILABLE_VOICES } from '../utils/enhanced-tts';

const MichaelTTSDemo: React.FC = () => {
  const [currentText, setCurrentText] = useState('Hello! I\'m Michael, your SQL tutor. I can now speak with much more natural and expressive voices using OpenAI\'s premium text-to-speech technology.');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedExample, setSelectedExample] = useState(0);
  const [voiceSettings, setVoiceSettings] = useState<TTSOptions>({
    voice: 'echo',
    speed: 1.0,
    volume: 0.9,
    useOpenAI: true,
    characterStyle: 'university_ta',
    enhanceProsody: true,
    backgroundAmbiance: false
  });

  const exampleTexts = [
    {
      title: "Welcome Message",
      text: "Hello! I'm Michael, your SQL tutor. I can now speak with much more natural and expressive voices using OpenAI's premium text-to-speech technology.",
      category: "greeting"
    },
    {
      title: "SQL Explanation",
      text: "Let's explore a SELECT query. When you write SELECT * FROM students WHERE grade > 85, you're asking the database to show all columns from the students table, but only for rows where the grade is greater than 85.",
      category: "technical"
    },
    {
      title: "Hebrew Example",
      text: "שלום! אני מיכאל, המורה שלכם למסדי נתונים. אני כאן כדי לעזור לכם ללמוד SQL בצורה קלה ומובנת.",
      category: "multilingual"
    },
    {
      title: "Encouraging Feedback",
      text: "Great job! You've successfully written your first JOIN query. This is a fundamental skill in SQL, and you're making excellent progress. Let's try a more complex example now.",
      category: "feedback"
    },
    {
      title: "Error Explanation",
      text: "I notice there's a syntax error in your query. Don't worry - this is completely normal when learning SQL! The issue is that you're missing a comma between the column names. Let me show you how to fix it.",
      category: "correction"
    }
  ];

  const playText = async (text: string) => {
    if (isPlaying) {
      enhancedTTS.stop();
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      await enhancedTTS.speak(text, {
        ...voiceSettings,
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false)
      });
    } catch (error) {
      console.error('Demo TTS failed:', error);
      setIsPlaying(false);
    }
  };

  const stopPlayback = () => {
    enhancedTTS.stop();
    setIsPlaying(false);
  };

  return (
    <div style={{ 
      padding: '32px', 
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
          🎙️ Michael's Enhanced Voice Demo
        </h1>
        <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
          Experience natural, human-like text-to-speech with OpenAI's premium voices
        </p>
      </div>

      {/* Michael Avatar */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <MichaelChatAvatar
          text={currentText}
          autoPlay={false}
          size="large"
          onSpeechStart={() => setIsPlaying(true)}
          onSpeechEnd={() => setIsPlaying(false)}
        />
      </div>

      {/* Example Texts */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', color: '#374151' }}>Choose an Example:</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '12px' 
        }}>
          {exampleTexts.map((example, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedExample(index);
                setCurrentText(example.text);
              }}
              style={{
                padding: '16px',
                border: selectedExample === index ? '2px solid #6366f1' : '2px solid #e5e7eb',
                borderRadius: '12px',
                background: selectedExample === index ? '#f0f0ff' : 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ 
                fontWeight: 600, 
                marginBottom: '4px',
                color: selectedExample === index ? '#6366f1' : '#374151'
              }}>
                {example.title}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {example.category}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Text Editor */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '8px', color: '#374151' }}>Edit Text:</h3>
        <textarea
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
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

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px'
      }}>
        <button
          onClick={() => playText(currentText)}
          disabled={!currentText.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: isPlaying 
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: currentText.trim() ? 'pointer' : 'not-allowed',
            opacity: currentText.trim() ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
        >
          {isPlaying ? (
            <>
              <Square size={18} />
              Stop Speaking
            </>
          ) : (
            <>
              <Play size={18} />
              Test Voice
            </>
          )}
        </button>

        <button
          onClick={() => setShowSettings(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Settings size={18} />
          Voice Settings
        </button>
      </div>

      {/* Current Voice Info */}
      <div style={{
        background: '#f8f9fa',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>Current Voice Settings:</h4>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '8px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <div><strong>Voice:</strong> {AVAILABLE_VOICES.find(v => v.id === voiceSettings.voice)?.name || 'Default'}</div>
          <div><strong>Speed:</strong> {voiceSettings.speed}x</div>
          <div><strong>Style:</strong> {voiceSettings.characterStyle}</div>
          <div><strong>OpenAI TTS:</strong> {voiceSettings.useOpenAI ? 'Enabled' : 'Disabled'}</div>
          <div><strong>Prosody:</strong> {voiceSettings.enhanceProsody ? 'Enhanced' : 'Standard'}</div>
        </div>
      </div>

      {/* Voice Settings Modal */}
      <EnhancedVoiceSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentSettings={voiceSettings}
        onSettingsChange={setVoiceSettings}
      />
    </div>
  );
};

export default MichaelTTSDemo; 