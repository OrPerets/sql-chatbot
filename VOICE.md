# Voice Mode Enhancement Guide - OpenAI Integration

This guide provides detailed instructions for enhancing the voice mode in the SQL chatbot to use OpenAI's advanced voice capabilities and create a more integrated conversational experience.

## 🎯 Current State Analysis

### Existing Voice Infrastructure
- **TTS (Text-to-Speech)**: Currently uses both OpenAI TTS API (`/api/audio/tts`) and macOS `say` command (`/api/tts`)
- **STT (Speech-to-Text)**: OpenAI Whisper API via `/api/audio/transcribe`
- **Avatar Integration**: 3D Michael avatar with lip-sync and state management
- **Voice Components**: `MichaelAvatarDirect`, `VoiceModeCircle`, `StaticLogoMode`
- **Enhanced TTS Service**: Progressive speech with chunk-based delivery

### Environment Variables
```bash
FEATURE_VOICE=1                    # Enable voice features
OPENAI_API_KEY=your_key_here      # Required for OpenAI services
NEXT_PUBLIC_VOICE_ENABLED=1       # Client-side voice toggle
NEXT_PUBLIC_AVATAR_ENABLED=1      # Avatar display toggle
```

## 🚀 Enhancement Roadmap

### Phase 1: OpenAI Realtime API Integration

#### 1.1 Setup Realtime API Connection
Create a new WebSocket-based service for real-time voice conversations:

```typescript
// app/services/openai-realtime.ts
import OpenAI from 'openai';

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  async connect(): Promise<void> {
    const response = await this.openai.beta.realtime.sessions.create({
      model: 'gpt-4o-realtime-preview-2024-10-01',
      voice: 'alloy',
      instructions: `You are Michael, an expert SQL tutor. 
        Provide clear, concise explanations about SQL concepts.
        Support both Hebrew and English languages.
        Keep responses conversational and educational.`,
    });
    
    this.ws = new WebSocket(response.url);
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    if (!this.ws) return;
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleRealtimeEvent(data);
    };
  }
  
  private handleRealtimeEvent(event: any): void {
    switch (event.type) {
      case 'response.audio.delta':
        this.playAudioChunk(event.delta);
        break;
      case 'response.text.delta':
        this.updateTranscript(event.delta);
        break;
      case 'input_audio_buffer.speech_started':
        this.onSpeechStarted();
        break;
      case 'input_audio_buffer.speech_stopped':
        this.onSpeechStopped();
        break;
    }
  }
}
```

#### 1.2 Create Realtime API Endpoint
```typescript
// app/api/voice/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OpenAIRealtimeService } from '@/app/services/openai-realtime';

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();
    const realtimeService = new OpenAIRealtimeService();
    
    switch (action) {
      case 'connect':
        const sessionUrl = await realtimeService.connect();
        return NextResponse.json({ sessionUrl });
        
      case 'send_audio':
        await realtimeService.sendAudio(data.audioBuffer);
        return NextResponse.json({ success: true });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Realtime API error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
```

### Phase 2: Enhanced Voice Components

#### 2.1 Real-time Voice Chat Component
```typescript
// app/components/RealtimeVoiceChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { OpenAIRealtimeService } from '@/app/services/openai-realtime';

interface RealtimeVoiceChatProps {
  onTranscriptionUpdate: (text: string) => void;
  onResponseUpdate: (text: string) => void;
  isEnabled: boolean;
}

export const RealtimeVoiceChat: React.FC<RealtimeVoiceChatProps> = ({
  onTranscriptionUpdate,
  onResponseUpdate,
  isEnabled
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const realtimeService = useRef<OpenAIRealtimeService | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  
  useEffect(() => {
    if (isEnabled && !realtimeService.current) {
      initializeRealtime();
    }
    
    return () => {
      cleanup();
    };
  }, [isEnabled]);
  
  const initializeRealtime = async () => {
    try {
      realtimeService.current = new OpenAIRealtimeService();
      await realtimeService.current.connect();
      setIsConnected(true);
      
      // Setup event listeners
      realtimeService.current.on('speech_started', () => setIsListening(true));
      realtimeService.current.on('speech_stopped', () => setIsListening(false));
      realtimeService.current.on('response_started', () => setIsSpeaking(true));
      realtimeService.current.on('response_ended', () => setIsSpeaking(false));
      realtimeService.current.on('transcription_update', onTranscriptionUpdate);
      realtimeService.current.on('response_update', onResponseUpdate);
    } catch (error) {
      console.error('Failed to initialize realtime voice:', error);
    }
  };
  
  const startListening = async () => {
    if (!realtimeService.current || !isConnected) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await realtimeService.current.startListening(stream);
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  };
  
  const stopListening = () => {
    realtimeService.current?.stopListening();
  };
  
  const cleanup = () => {
    realtimeService.current?.disconnect();
    audioContext.current?.close();
  };
  
  return (
    <div className="realtime-voice-chat">
      <button 
        onClick={isListening ? stopListening : startListening}
        disabled={!isConnected}
        className={`voice-button ${isListening ? 'listening' : ''}`}
      >
        {isListening ? '🎤 Listening...' : '🎙️ Start Voice Chat'}
      </button>
      
      <div className="status-indicators">
        <div className={`indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <div className={`indicator ${isSpeaking ? 'speaking' : ''}`}>
          {isSpeaking ? '🔊 Speaking' : '🔇 Silent'}
        </div>
      </div>
    </div>
  );
};
```

#### 2.2 Enhanced Avatar Integration
Modify the existing `MichaelAvatarDirect` component to support real-time voice:

```typescript
// app/components/MichaelAvatarDirect.tsx (additions)

interface MichaelAvatarDirectProps {
  // ... existing props
  realtimeMode?: boolean;
  onVoiceInteractionStart?: () => void;
  onVoiceInteractionEnd?: () => void;
}

// Add to the component:
const [realtimeVoice, setRealtimeVoice] = useState<RealtimeVoiceChat | null>(null);

useEffect(() => {
  if (props.realtimeMode) {
    setRealtimeVoice(new RealtimeVoiceChat({
      onTranscriptionUpdate: (text) => {
        // Update UI with user's speech
        console.log('User said:', text);
      },
      onResponseUpdate: (text) => {
        // Update avatar text and trigger speech
        setText(text);
        setState('speaking');
      },
      isEnabled: true
    }));
  }
}, [props.realtimeMode]);
```

### Phase 3: Advanced Voice Features

#### 3.1 Context-Aware Voice Responses
```typescript
// app/services/voice-context.ts
export class VoiceContextManager {
  private conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [];
  private currentSQLContext: string | null = null;
  
  updateSQLContext(query: string, results?: any) {
    this.currentSQLContext = `Current SQL: ${query}${results ? ` | Results: ${JSON.stringify(results).slice(0, 200)}...` : ''}`;
  }
  
  addToHistory(role: 'user' | 'assistant', content: string) {
    this.conversationHistory.push({ role, content });
    // Keep last 10 interactions
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }
  
  getContextualPrompt(): string {
    const history = this.conversationHistory
      .slice(-6) // Last 3 exchanges
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
      
    return `
Previous conversation:
${history}

Current SQL context: ${this.currentSQLContext || 'None'}

Respond naturally as Michael, the SQL tutor. Keep responses concise but helpful.
    `.trim();
  }
}
```

#### 3.2 Smart Voice Activation
```typescript
// app/hooks/useSmartVoiceActivation.ts
import { useState, useEffect, useCallback } from 'react';

export const useSmartVoiceActivation = () => {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [confidenceLevel, setConfidenceLevel] = useState(0);
  
  const analyzeVoiceIntent = useCallback(async (audioBuffer: ArrayBuffer) => {
    // Use OpenAI to analyze if the user is trying to interact
    const response = await fetch('/api/voice/analyze-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        audioBuffer: Array.from(new Uint8Array(audioBuffer)),
        context: 'sql_learning'
      })
    });
    
    const { intent, confidence } = await response.json();
    setConfidenceLevel(confidence);
    
    return intent === 'interaction_request' && confidence > 0.7;
  }, []);
  
  return {
    isVoiceActive,
    confidenceLevel,
    analyzeVoiceIntent,
    setIsVoiceActive
  };
};
```

### Phase 4: Integration with Chat System

#### 4.1 Modify Chat Component
Update `app/components/chat.tsx` to support enhanced voice mode:

```typescript
// Add to Chat component state:
const [voiceMode, setVoiceMode] = useState<'disabled' | 'enhanced' | 'realtime'>('disabled');
const [voiceContext] = useState(new VoiceContextManager());

// Add voice mode selector:
const VoiceModeSelector = () => (
  <div className={styles.voiceModeSelector}>
    <button 
      onClick={() => setVoiceMode('disabled')}
      className={voiceMode === 'disabled' ? styles.active : ''}
    >
      🔇 Text Only
    </button>
    <button 
      onClick={() => setVoiceMode('enhanced')}
      className={voiceMode === 'enhanced' ? styles.active : ''}
    >
      🔊 Enhanced Voice
    </button>
    <button 
      onClick={() => setVoiceMode('realtime')}
      className={voiceMode === 'realtime' ? styles.active : ''}
    >
      🎙️ Real-time Chat
    </button>
  </div>
);

// Update avatar rendering:
{avatarMode === 'avatar' ? (
  <MichaelAvatarDirect
    text={lastAssistantMessage}
    state={avatarState}
    size="medium"
    progressiveMode={enableVoice && !isDone}
    isStreaming={enableVoice && !isDone}
    realtimeMode={voiceMode === 'realtime'}
    onSpeakingStart={() => {
      console.log('🎤 Michael started speaking');
      if (enableVoice) setShouldSpeak(true);
    }}
    onSpeakingEnd={() => {
      console.log('🎤 Michael finished speaking');
      if (enableVoice) setShouldSpeak(false);
      setIsAssistantMessageComplete(false);
      setHasStartedSpeaking(false);
      setIsManualSpeech(false);
    }}
    onVoiceInteractionStart={() => {
      setAvatarState('listening');
      voiceContext.addToHistory('user', 'Voice interaction started');
    }}
    onVoiceInteractionEnd={() => {
      setAvatarState('idle');
    }}
  />
) : (
  // ... existing VoiceModeCircle code
)}
```

#### 4.2 SQL Query Integration
```typescript
// app/services/voice-sql-integration.ts
export class VoiceSQLIntegration {
  static async processVoiceQuery(transcript: string, context: VoiceContextManager): Promise<{
    sqlQuery?: string;
    explanation?: string;
    needsConfirmation?: boolean;
  }> {
    const response = await fetch('/api/voice/process-sql-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        context: context.getContextualPrompt(),
        intent: 'sql_assistance'
      })
    });
    
    return response.json();
  }
  
  static async explainQuery(query: string, results?: any): Promise<string> {
    const response = await fetch('/api/voice/explain-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, results })
    });
    
    const { explanation } = await response.json();
    return explanation;
  }
}
```

### Phase 5: Advanced Features

#### 5.1 Voice-Controlled SQL Editor
```typescript
// app/components/VoiceControlledSQLEditor.tsx
import React, { useState, useRef } from 'react';
import { Editor } from '@monaco-editor/react';

interface VoiceControlledSQLEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  onExecute?: (query: string) => void;
}

export const VoiceControlledSQLEditor: React.FC<VoiceControlledSQLEditorProps> = ({
  initialValue = '',
  onChange,
  onExecute
}) => {
  const [value, setValue] = useState(initialValue);
  const [isListening, setIsListening] = useState(false);
  const editorRef = useRef(null);
  
  const voiceCommands = {
    'select all from': (tableName: string) => `SELECT * FROM ${tableName}`,
    'insert into': (tableName: string, values: string) => `INSERT INTO ${tableName} VALUES (${values})`,
    'update table': (tableName: string, condition: string) => `UPDATE ${tableName} SET ${condition}`,
    'delete from': (tableName: string, condition: string) => `DELETE FROM ${tableName} WHERE ${condition}`,
    'execute query': () => onExecute?.(value),
    'clear editor': () => setValue(''),
  };
  
  const processVoiceCommand = async (transcript: string) => {
    // Use OpenAI to parse natural language SQL commands
    const response = await fetch('/api/voice/parse-sql-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        transcript,
        currentQuery: value,
        availableCommands: Object.keys(voiceCommands)
      })
    });
    
    const { command, parameters, sqlQuery } = await response.json();
    
    if (sqlQuery) {
      setValue(sqlQuery);
      onChange?.(sqlQuery);
    }
  };
  
  return (
    <div className="voice-controlled-sql-editor">
      <div className="editor-header">
        <button 
          onClick={() => setIsListening(!isListening)}
          className={`voice-control-btn ${isListening ? 'listening' : ''}`}
        >
          {isListening ? '🎤 Listening for commands...' : '🎙️ Voice Control'}
        </button>
      </div>
      
      <Editor
        height="300px"
        defaultLanguage="sql"
        value={value}
        onChange={(newValue) => {
          setValue(newValue || '');
          onChange?.(newValue || '');
        }}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
        }}
      />
      
      {isListening && (
        <RealtimeVoiceChat
          onTranscriptionUpdate={processVoiceCommand}
          onResponseUpdate={(response) => console.log('Assistant response:', response)}
          isEnabled={isListening}
        />
      )}
    </div>
  );
};
```

#### 5.2 Voice Analytics & Learning
```typescript
// app/services/voice-analytics.ts
export class VoiceAnalytics {
  static async trackVoiceInteraction(data: {
    duration: number;
    transcript: string;
    sqlGenerated?: string;
    userSatisfaction?: number;
    errorCount?: number;
  }) {
    await fetch('/api/analytics/voice-interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        sessionId: localStorage.getItem('sessionId')
      })
    });
  }
  
  static async getVoiceUsageStats(): Promise<{
    totalInteractions: number;
    averageDuration: number;
    successRate: number;
    commonQueries: string[];
  }> {
    const response = await fetch('/api/analytics/voice-stats');
    return response.json();
  }
}
```

## 🔧 Implementation Steps

### Step 1: Environment Setup
1. Ensure OpenAI API key is configured
2. Add new environment variables:
   ```bash
   OPENAI_REALTIME_ENABLED=1
   VOICE_ANALYTICS_ENABLED=1
   ```

### Step 2: Install Dependencies
```bash
npm install @openai/realtime-api-beta
npm install web-audio-api
npm install voice-activity-detection
```

### Step 3: Backend API Endpoints
Create the following new API routes:
- `/api/voice/realtime` - Realtime API connection
- `/api/voice/analyze-intent` - Voice intent analysis
- `/api/voice/process-sql-query` - SQL query from voice
- `/api/voice/explain-query` - Query explanation
- `/api/voice/parse-sql-command` - Voice command parsing

### Step 4: Frontend Integration
1. Update the chat component to include voice mode selector
2. Enhance avatar components with realtime capabilities
3. Add voice-controlled SQL editor
4. Implement voice analytics tracking

### Step 5: Testing & Optimization
1. Test voice recognition accuracy
2. Optimize audio quality and latency
3. Test multilingual support (Hebrew/English)
4. Performance testing with concurrent users

## 🎨 UI/UX Enhancements

### Voice Mode Indicators
```css
/* app/components/voice-indicators.module.css */
.voiceIndicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 500;
}

.listening {
  animation: pulse 2s infinite;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.speaking {
  animation: wave 1s infinite;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes wave {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-2px); }
  75% { transform: translateY(2px); }
}
```

### Voice Control Panel
```typescript
// app/components/VoiceControlPanel.tsx
export const VoiceControlPanel: React.FC = () => (
  <div className={styles.voiceControlPanel}>
    <div className={styles.modeSelector}>
      <h3>🎤 Voice Mode</h3>
      <VoiceModeSelector />
    </div>
    
    <div className={styles.voiceSettings}>
      <h3>⚙️ Settings</h3>
      <EnhancedVoiceSettings />
    </div>
    
    <div className={styles.voiceStats}>
      <h3>📊 Usage Stats</h3>
      <VoiceUsageStats />
    </div>
  </div>
);
```

## 🚨 Security & Privacy Considerations

### Audio Data Handling
- Implement client-side audio processing where possible
- Use secure WebSocket connections (WSS)
- Encrypt audio data in transit
- Implement data retention policies
- Add user consent for voice data processing

### Privacy Settings
```typescript
// app/components/VoicePrivacySettings.tsx
export const VoicePrivacySettings: React.FC = () => {
  const [settings, setSettings] = useState({
    saveTranscriptions: false,
    shareAnalytics: false,
    localProcessing: true,
    dataRetention: '7days'
  });
  
  return (
    <div className={styles.privacySettings}>
      <h3>🔒 Privacy Settings</h3>
      
      <label>
        <input 
          type="checkbox" 
          checked={settings.saveTranscriptions}
          onChange={(e) => setSettings({...settings, saveTranscriptions: e.target.checked})}
        />
        Save voice transcriptions for learning improvement
      </label>
      
      <label>
        <input 
          type="checkbox" 
          checked={settings.shareAnalytics}
          onChange={(e) => setSettings({...settings, shareAnalytics: e.target.checked})}
        />
        Share anonymous usage analytics
      </label>
      
      <label>
        <input 
          type="checkbox" 
          checked={settings.localProcessing}
          onChange={(e) => setSettings({...settings, localProcessing: e.target.checked})}
        />
        Prefer local audio processing when possible
      </label>
      
      <select 
        value={settings.dataRetention}
        onChange={(e) => setSettings({...settings, dataRetention: e.target.value})}
      >
        <option value="session">Delete after session</option>
        <option value="1day">Keep for 1 day</option>
        <option value="7days">Keep for 7 days</option>
        <option value="30days">Keep for 30 days</option>
      </select>
    </div>
  );
};
```

## 📈 Monitoring & Analytics

### Performance Metrics
- Voice recognition accuracy
- Response latency
- Audio quality scores
- User satisfaction ratings
- Feature adoption rates

### Error Tracking
- Failed transcriptions
- Network connectivity issues
- API rate limiting
- Browser compatibility problems

## 🌐 Deployment Considerations

### Production Checklist
- [ ] Configure OpenAI Realtime API limits
- [ ] Set up CDN for audio assets
- [ ] Implement graceful fallbacks
- [ ] Add monitoring and alerting
- [ ] Test cross-browser compatibility
- [ ] Verify mobile responsiveness
- [ ] Load test voice endpoints
- [ ] Document API rate limits

### Scaling Considerations
- Implement connection pooling for WebSocket connections
- Use Redis for session management
- Consider edge computing for audio processing
- Implement circuit breakers for external APIs
- Set up horizontal scaling for voice services

This comprehensive guide provides a roadmap for enhancing your SQL chatbot's voice capabilities using OpenAI's advanced APIs while maintaining integration with your existing avatar and chat systems.
