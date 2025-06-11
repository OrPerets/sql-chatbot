"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Play, Pause, RotateCcw, Mic, Headphones } from 'lucide-react';
import { enhancedTTS, AVAILABLE_VOICES, TTSOptions, TTSVoice } from '../utils/enhanced-tts';
import styles from './enhanced-voice-settings.module.css';

interface EnhancedVoiceSettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSettingsChange?: (settings: TTSOptions) => void;
  currentSettings?: TTSOptions;
}

const EnhancedVoiceSettings: React.FC<EnhancedVoiceSettingsProps> = ({
  isOpen = false,
  onClose,
  onSettingsChange,
  currentSettings = {}
}) => {
  const [settings, setSettings] = useState<TTSOptions>({
    voice: 'echo',
    speed: 1.0,
    pitch: 0.95,
    volume: 0.9,
    useOpenAI: true,
    characterStyle: 'university_ta',
    enhanceProsody: true,
    backgroundAmbiance: false,
    ...currentSettings
  });

  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice | null>(null);
  const [testText, setTestText] = useState("Hello! I'm Michael, your SQL tutor. Let me help you understand database queries with clear explanations and examples.");

  // Update selectedVoice when settings.voice changes
  useEffect(() => {
    const voice = AVAILABLE_VOICES.find(v => v.id === settings.voice);
    setSelectedVoice(voice || null);
  }, [settings.voice]);

  // Handle settings change
  const updateSetting = (key: keyof TTSOptions, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  // Test voice with current settings
  const testVoice = async () => {
    if (isTestPlaying) {
      enhancedTTS.stop();
      setIsTestPlaying(false);
      return;
    }

    try {
      setIsTestPlaying(true);
      await enhancedTTS.speak(testText, settings);
    } catch (error) {
      console.error('Voice test failed:', error);
    } finally {
      setIsTestPlaying(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const defaults: TTSOptions = {
      voice: 'echo',
      speed: 1.0,
      pitch: 0.95,
      volume: 0.9,
      useOpenAI: true,
      characterStyle: 'university_ta',
      enhanceProsody: true,
      backgroundAmbiance: false
    };
    setSettings(defaults);
    onSettingsChange?.(defaults);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Settings size={20} />
            <span>Michael's Voice Settings</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {/* Voice Selection */}
          <div className={styles.section}>
            <h3>Voice Selection</h3>
            <div className={styles.voiceGrid}>
              {AVAILABLE_VOICES.map((voice) => (
                <div
                  key={voice.id}
                  className={`${styles.voiceCard} ${settings.voice === voice.id ? styles.selected : ''}`}
                  onClick={() => updateSetting('voice', voice.id)}
                >
                  <div className={styles.voiceHeader}>
                    <span className={styles.voiceName}>{voice.name}</span>
                    <span className={`${styles.voiceType} ${styles[voice.type]}`}>
                      {voice.type === 'openai' ? '🌟 Premium' : '🔊 Standard'}
                    </span>
                  </div>
                  <div className={styles.voiceInfo}>
                    <span className={styles.voiceGender}>{voice.gender}</span>
                    <span className={styles.voiceQuality}>{voice.quality}</span>
                  </div>
                  <p className={styles.voiceDescription}>{voice.description}</p>
                  <div className={styles.voiceLanguages}>
                    {voice.language.map(lang => (
                      <span key={lang} className={styles.langTag}>{lang.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Character Style */}
          <div className={styles.section}>
            <h3>Character Style</h3>
            <div className={styles.radioGroup}>
              {[
                { id: 'university_ta', label: 'University TA', desc: 'Friendly, warm, and encouraging' },
                { id: 'professional', label: 'Professional', desc: 'Formal and authoritative' },
                { id: 'casual', label: 'Casual', desc: 'Relaxed and conversational' },
                { id: 'technical', label: 'Technical', desc: 'Precise and methodical' }
              ].map(style => (
                <label key={style.id} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="characterStyle"
                    value={style.id}
                    checked={settings.characterStyle === style.id}
                    onChange={(e) => updateSetting('characterStyle', e.target.value)}
                  />
                  <div className={styles.radioContent}>
                    <span className={styles.radioLabel}>{style.label}</span>
                    <span className={styles.radioDesc}>{style.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Voice Parameters */}
          <div className={styles.section}>
            <h3>Voice Parameters</h3>
            <div className={styles.sliders}>
              <div className={styles.slider}>
                <label>Speed: {settings.speed?.toFixed(1)}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.speed || 1.0}
                  onChange={(e) => updateSetting('speed', parseFloat(e.target.value))}
                />
                <div className={styles.sliderLabels}>
                  <span>Slower</span>
                  <span>Faster</span>
                </div>
              </div>

              <div className={styles.slider}>
                <label>Volume: {Math.round((settings.volume || 0.9) * 100)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.volume || 0.9}
                  onChange={(e) => updateSetting('volume', parseFloat(e.target.value))}
                />
                <div className={styles.sliderLabels}>
                  <span>Quiet</span>
                  <span>Loud</span>
                </div>
              </div>

              {!settings.useOpenAI && (
                <div className={styles.slider}>
                  <label>Pitch: {settings.pitch?.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={settings.pitch || 0.95}
                    onChange={(e) => updateSetting('pitch', parseFloat(e.target.value))}
                  />
                  <div className={styles.sliderLabels}>
                    <span>Lower</span>
                    <span>Higher</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Features */}
          <div className={styles.section}>
            <h3>Enhanced Features</h3>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={settings.useOpenAI !== false}
                  onChange={(e) => updateSetting('useOpenAI', e.target.checked)}
                />
                <span>Use OpenAI Premium TTS (Higher Quality)</span>
              </label>
              
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={settings.enhanceProsody !== false}
                  onChange={(e) => updateSetting('enhanceProsody', e.target.checked)}
                />
                <span>Enhanced Prosody (Natural pauses and emphasis)</span>
              </label>
              
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={settings.backgroundAmbiance === true}
                  onChange={(e) => updateSetting('backgroundAmbiance', e.target.checked)}
                />
                <span>Background Ambiance (Subtle classroom atmosphere)</span>
              </label>
            </div>
          </div>

          {/* Test Section */}
          <div className={styles.section}>
            <h3>Test Voice</h3>
            <div className={styles.testSection}>
              <textarea
                className={styles.testTextarea}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Enter text to test the voice..."
                rows={3}
              />
              <div className={styles.testControls}>
                <button
                  className={`${styles.testButton} ${isTestPlaying ? styles.playing : ''}`}
                  onClick={testVoice}
                  disabled={!testText.trim()}
                >
                  {isTestPlaying ? (
                    <>
                      <Pause size={16} />
                      Stop Test
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Test Voice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.resetButton} onClick={resetToDefaults}>
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          <div className={styles.footerButtons}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.saveButton} onClick={onClose}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVoiceSettings; 