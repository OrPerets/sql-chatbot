"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Volume2, Play, Pause, RotateCcw, Mic, Headphones } from 'lucide-react';
import { enhancedTTS, AVAILABLE_VOICES, TTSOptions, TTSVoice } from '../utils/enhanced-tts';
import styles from './enhanced-voice-settings.module.css';

interface VoicePersonality {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: Partial<TTSOptions>;
  previewText: string;
}

interface VoicePreset {
  id: string;
  name: string;
  description: string;
  category: 'beginner' | 'advanced' | 'accessibility';
  settings: TTSOptions;
}

interface EnhancedVoiceSettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSettingsChange?: (settings: TTSOptions) => void;
  currentSettings?: TTSOptions;
  enableRealTimePreview?: boolean;
}

const EnhancedVoiceSettings: React.FC<EnhancedVoiceSettingsProps> = ({
  isOpen = false,
  onClose,
  onSettingsChange,
  currentSettings = {},
  enableRealTimePreview = true
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
  const [selectedPersonality, setSelectedPersonality] = useState<string>('friendly');
  const [selectedPreset, setSelectedPreset] = useState<string>('default');
  const [isRealTimePreview, setIsRealTimePreview] = useState(enableRealTimePreview);
  const [previewDebounceTimer, setPreviewDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Voice personalities
  const voicePersonalities: VoicePersonality[] = useMemo(() => [
    {
      id: 'friendly',
      name: 'חברותי',
      description: 'חם, מעודד ונגיש - מושלם ללמידה',
      icon: '😊',
      settings: {
        characterStyle: 'university_ta',
        speed: 1.0,
        enhanceProsody: true,
        backgroundAmbiance: false
      },
      previewText: 'היי! אני מייקל, המורה שלך ל-SQL. בואו נלמד יחד בצורה חברותית ומעניינת!'
    },
    {
      id: 'professional',
      name: 'מקצועי',
      description: 'רשמי, מדויק ואמין - לסביבה עסקית',
      icon: '👔',
      settings: {
        characterStyle: 'professional',
        speed: 0.9,
        enhanceProsody: true,
        backgroundAmbiance: false
      },
      previewText: 'שלום, אני מייקל. אני כאן כדי לסייע לכם ללמוד SQL בצורה מקצועית ויסודית.'
    },
    {
      id: 'casual',
      name: 'רגוע',
      description: 'נינוח, קליל ובלתי פורמלי',
      icon: '😎',
      settings: {
        characterStyle: 'casual',
        speed: 1.1,
        enhanceProsody: false,
        backgroundAmbiance: true
      },
      previewText: 'אהלן! אני מייקל. בואו נלמד SQL בצורה רגועה וללא לחץ.'
    },
    {
      id: 'energetic',
      name: 'אנרגטי',
      description: 'מלא אנרגיה, מלהיב ומעורר השראה',
      icon: '⚡',
      settings: {
        characterStyle: 'university_ta',
        speed: 1.2,
        enhanceProsody: true,
        backgroundAmbiance: false
      },
      previewText: 'וואו! אני מייקל ואני כל כך נרגש ללמד אתכם SQL! זה יהיה מדהים!'
    }
  ], []);
  
  // Voice presets
  const voicePresets: VoicePreset[] = [
    {
      id: 'beginner_friendly',
      name: 'מתחילים',
      description: 'מהירות איטית, הסברים ברורים',
      category: 'beginner',
      settings: {
        voice: 'alloy',
        speed: 0.8,
        volume: 0.9,
        characterStyle: 'university_ta',
        enhanceProsody: true,
        useOpenAI: true,
        backgroundAmbiance: false
      }
    },
    {
      id: 'advanced_learner',
      name: 'מתקדמים',
      description: 'מהירות רגילה, תוכן מעמיק',
      category: 'advanced',
      settings: {
        voice: 'echo',
        speed: 1.1,
        volume: 0.9,
        characterStyle: 'professional',
        enhanceProsody: true,
        useOpenAI: true,
        backgroundAmbiance: false
      }
    },
    {
      id: 'accessibility_focus',
      name: 'נגישות',
      description: 'אופטימיזציה לקוראי מסך וליקויי שמיעה',
      category: 'accessibility',
      settings: {
        voice: 'nova',
        speed: 0.9,
        volume: 1.0,
        characterStyle: 'professional',
        enhanceProsody: true,
        useOpenAI: true,
        backgroundAmbiance: false
      }
    },
    {
      id: 'quick_review',
      name: 'סקירה מהירה',
      description: 'מהירות גבוהה לחזרה על חומר',
      category: 'advanced',
      settings: {
        voice: 'shimmer',
        speed: 1.3,
        volume: 0.8,
        characterStyle: 'casual',
        enhanceProsody: false,
        useOpenAI: true,
        backgroundAmbiance: false
      }
    }
  ];

  // Update selectedVoice when settings.voice changes
  useEffect(() => {
    const voice = AVAILABLE_VOICES.find(v => v.id === settings.voice);
    setSelectedVoice(voice || null);
  }, [settings.voice]);
  
  // Auto-detect personality based on current settings
  useEffect(() => {
    const matchingPersonality = voicePersonalities.find(p => 
      p.settings.characterStyle === settings.characterStyle &&
      Math.abs((p.settings.speed || 1.0) - (settings.speed || 1.0)) < 0.1
    );
    
    if (matchingPersonality && selectedPersonality !== matchingPersonality.id) {
      setSelectedPersonality(matchingPersonality.id);
    }
  }, [settings.characterStyle, settings.speed, selectedPersonality, voicePersonalities]);

  // Handle settings change with real-time preview
  const updateSetting = (key: keyof TTSOptions, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
    
    // Trigger real-time preview if enabled
    if (isRealTimePreview && key !== 'useOpenAI') {
      triggerRealTimePreview(newSettings);
    }
  };
  
  // Real-time preview with debouncing
  const triggerRealTimePreview = (newSettings: TTSOptions) => {
    if (previewDebounceTimer) {
      clearTimeout(previewDebounceTimer);
    }
    
    const timer = setTimeout(() => {
      const personality = voicePersonalities.find(p => p.id === selectedPersonality);
      const previewText = personality?.previewText || 'זהו דוגמה לקול החדש שלך.';
      
      if (!isTestPlaying) {
        playPreview(previewText, newSettings);
      }
    }, 800); // 800ms debounce
    
    setPreviewDebounceTimer(timer);
  };
  
  // Play preview with specific settings
  const playPreview = async (text: string, previewSettings: TTSOptions) => {
    try {
      setIsTestPlaying(true);
      await enhancedTTS.speak(text, previewSettings);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setIsTestPlaying(false);
    }
  };
  
  // Apply personality settings
  const applyPersonality = (personalityId: string) => {
    const personality = voicePersonalities.find(p => p.id === personalityId);
    if (personality) {
      setSelectedPersonality(personalityId);
      const newSettings = { ...settings, ...personality.settings };
      setSettings(newSettings);
      onSettingsChange?.(newSettings);
      
      // Update test text
      setTestText(personality.previewText);
      
      // Trigger preview if enabled
      if (isRealTimePreview) {
        triggerRealTimePreview(newSettings);
      }
    }
  };
  
  // Apply preset settings
  const applyPreset = (presetId: string) => {
    const preset = voicePresets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      setSettings(preset.settings);
      onSettingsChange?.(preset.settings);
      
      // Trigger preview if enabled
      if (isRealTimePreview) {
        triggerRealTimePreview(preset.settings);
      }
    }
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
    setSelectedPersonality('friendly');
    setSelectedPreset('default');
    onSettingsChange?.(defaults);
    
    if (isRealTimePreview) {
      triggerRealTimePreview(defaults);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
      }
      enhancedTTS.stop();
    };
  }, [previewDebounceTimer]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Settings size={20} />
            <span>Michael&apos;s Voice Settings</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {/* Voice Personalities */}
          <div className={styles.section}>
            <h3>אישיות קולית</h3>
            <div className={styles.personalityGrid}>
              {voicePersonalities.map((personality) => (
                <div
                  key={personality.id}
                  className={`${styles.personalityCard} ${selectedPersonality === personality.id ? styles.selected : ''}`}
                  onClick={() => applyPersonality(personality.id)}
                >
                  <div className={styles.personalityIcon}>{personality.icon}</div>
                  <div className={styles.personalityInfo}>
                    <span className={styles.personalityName}>{personality.name}</span>
                    <span className={styles.personalityDescription}>{personality.description}</span>
                  </div>
                  <button
                    className={styles.personalityPreviewButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(personality.previewText, { ...settings, ...personality.settings });
                    }}
                    disabled={isTestPlaying}
                    title="השמע דוגמה"
                  >
                    {isTestPlaying ? '⏸️' : '▶️'}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Voice Presets */}
          <div className={styles.section}>
            <h3>הגדרות מוכנות</h3>
            <div className={styles.presetTabs}>
              {['beginner', 'advanced', 'accessibility'].map(category => (
                <div key={category} className={styles.presetCategory}>
                  <h4 className={styles.presetCategoryTitle}>
                    {category === 'beginner' ? '🌱 מתחילים' : 
                     category === 'advanced' ? '🚀 מתקדמים' : 
                     '♿ נגישות'}
                  </h4>
                  <div className={styles.presetList}>
                    {voicePresets.filter(p => p.category === category).map(preset => (
                      <div
                        key={preset.id}
                        className={`${styles.presetCard} ${selectedPreset === preset.id ? styles.selected : ''}`}
                        onClick={() => applyPreset(preset.id)}
                      >
                        <div className={styles.presetInfo}>
                          <span className={styles.presetName}>{preset.name}</span>
                          <span className={styles.presetDescription}>{preset.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Real-time Preview Toggle */}
          <div className={styles.section}>
            <div className={styles.previewControls}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isRealTimePreview}
                  onChange={(e) => setIsRealTimePreview(e.target.checked)}
                />
                <span>תצוגה מקדימה בזמן אמת</span>
              </label>
              <span className={styles.previewNote}>
                כאשר מופעל, תשמעו דוגמה אוטומטית כשאתם משנים הגדרות
              </span>
            </div>
          </div>

          {/* Voice Selection */}
          <div className={styles.section}>
            <h3>בחירת קול</h3>
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

          {/* Advanced Test Section */}
          <div className={styles.section}>
            <h3>בדיקת קול מתקדמת</h3>
            <div className={styles.testSection}>
              <div className={styles.testTextOptions}>
                <button
                  className={styles.testTextPreset}
                  onClick={() => setTestText('שלום! אני מייקל, המורה שלך ל-SQL.')}
                >
                  ברכה
                </button>
                <button
                  className={styles.testTextPreset}
                  onClick={() => setTestText('SELECT * FROM users WHERE age > 25 ORDER BY name;')}
                >
                  שאילתת SQL
                </button>
                <button
                  className={styles.testTextPreset}
                  onClick={() => setTestText('בואו נלמד על JOIN - זהו אחד הכלים החשובים ביותר ב-SQL.')}
                >
                  הסבר טכני
                </button>
              </div>
              
              <textarea
                className={styles.testTextarea}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="הכנס טקסט לבדיקת הקול..."
                rows={4}
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
                      עצור בדיקה
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      בדוק קול
                    </>
                  )}
                </button>
                
                <div className={styles.testInfo}>
                  <span className={styles.testLength}>
                    אורך: {testText.length} תווים
                  </span>
                  <span className={styles.testDuration}>
                    זמן משוער: ~{Math.ceil(testText.length / 10)} שניות
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <button className={styles.resetButton} onClick={resetToDefaults}>
              <RotateCcw size={16} />
              איפוס להגדרות ברירת מחדל
            </button>
            <button 
              className={styles.exportButton}
              onClick={() => {
                const settingsJson = JSON.stringify(settings, null, 2);
                navigator.clipboard.writeText(settingsJson);
              }}
              title="העתק הגדרות ללוח"
            >
              📋 יצא הגדרות
            </button>
          </div>
          <div className={styles.footerButtons}>
            <button className={styles.cancelButton} onClick={onClose}>
              ביטול
            </button>
            <button className={styles.saveButton} onClick={onClose}>
              שמור הגדרות
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVoiceSettings;
export type { VoicePersonality, VoicePreset }; 
