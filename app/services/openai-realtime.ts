'use client';

export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export interface RealtimeCallbacks {
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onResponseStarted?: () => void;
  onResponseEnded?: () => void;
  onTranscriptionUpdate?: (text: string) => void;
  onResponseUpdate?: (text: string) => void;
  onAudioDelta?: (audioData: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private callbacks: RealtimeCallbacks = {};
  private isConnected = false;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isPlaying = false;
  private sessionId: string | null = null;
  private previousResponseId: string | null = null;
  private sessionConfig = {
    model: 'gpt-4o-realtime-preview-2024-10-01',
    voice: 'alloy',
    instructions: `You are Michael, an expert SQL tutor. 
      Provide clear, concise explanations about SQL concepts.
      Support both Hebrew and English languages.
      Keep responses conversational and educational.
      When explaining SQL queries, be practical and give examples.`,
  };

  constructor(_apiKey?: string) {}

  private async ensureResponsesSession(): Promise<void> {
    if (this.sessionId) {
      return;
    }

    const sessionResponse = await fetch('/api/responses/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: {
          source: 'realtime-voice-chat',
        },
      }),
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to initialize responses session');
    }

    const sessionData = await sessionResponse.json();
    this.sessionId = sessionData.sessionId || null;
    this.previousResponseId = sessionData.responseId || null;
  }

  async connect(): Promise<void> {
    try {
      // For now, we'll use a hybrid approach since OpenAI Realtime API is still in beta
      // We'll simulate realtime behavior using existing TTS/STT APIs
      console.log('🔌 Initializing OpenAI Realtime Service (Hybrid Mode)');
      
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.ensureResponsesSession();
      
      this.isConnected = true;
      console.log('✅ OpenAI Realtime Service connected');
    } catch (error) {
      console.error('❌ Failed to connect to OpenAI Realtime Service:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isConnected = false;
    this.sessionId = null;
    this.previousResponseId = null;
    console.log('🔌 OpenAI Realtime Service disconnected');
  }

  on(event: keyof RealtimeCallbacks, callback: Function): void {
    this.callbacks[event] = callback as any;
  }

  async startListening(stream: MediaStream): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Service not connected');
    }

    try {
      // Set up media recorder for voice input
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
          await this.processAudioInput(audioBlob);
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log('🎤 Started listening...');
        this.callbacks.onSpeechStarted?.();
      };

      // Start recording
      this.mediaRecorder.start();
      
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  stopListening(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      console.log('🎤 Stopped listening');
      this.callbacks.onSpeechStopped?.();
    }
  }

  private async processAudioInput(audioBlob: Blob): Promise<void> {
    try {
      // Convert audio to text using Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'auto');

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const { text } = await response.json();
      console.log('📝 Transcribed:', text);
      
      // Update transcription
      this.callbacks.onTranscriptionUpdate?.(text);

      // Generate response using chat completion
      await this.generateResponse(text);

    } catch (error) {
      console.error('❌ Failed to process audio input:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  private async generateResponse(userMessage: string): Promise<void> {
    try {
      this.callbacks.onResponseStarted?.();

      await this.ensureResponsesSession();
      const response = await fetch('/api/responses/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          previousResponseId: this.previousResponseId,
          content: userMessage,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      let fullResponse = '';
      let latestResponseId = this.previousResponseId;
      const decoder = new TextDecoder();
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          let data: any;
          try {
            data = JSON.parse(line);
          } catch (parseError) {
            console.warn('Skipping malformed responses stream event:', parseError);
            continue;
          }

          if (data.type === 'response.created' && data.responseId) {
            latestResponseId = data.responseId;
          } else if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') {
            fullResponse += data.delta;
            this.callbacks.onResponseUpdate?.(fullResponse);
          } else if (data.type === 'response.completed') {
            latestResponseId = data.responseId || latestResponseId;
            if (typeof data.outputText === 'string' && data.outputText.length > fullResponse.length) {
              fullResponse = data.outputText;
              this.callbacks.onResponseUpdate?.(fullResponse);
            }
          } else if (data.type === 'response.error') {
            throw new Error(data.message || 'Stream interrupted');
          }
        }
      }

      if (latestResponseId) {
        this.previousResponseId = latestResponseId;
      }

      // Generate TTS for the response
      await this.generateTTS(fullResponse);
      
      this.callbacks.onResponseEnded?.();

    } catch (error) {
      console.error('❌ Failed to generate response:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  private async generateTTS(text: string): Promise<void> {
    try {
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: this.sessionConfig.voice,
          speed: 1.0,
          format: 'mp3',
        }),
      });

      // Handle disabled feature gracefully (200 with enabled: false) - don't treat as error
      if (response.status === 200) {
        const responseData = await response.json().catch(() => ({}));
        if (responseData.enabled === false) {
          console.log('⚠️ Voice feature is disabled, skipping TTS');
          return; // Silently skip TTS if feature is disabled
        }
      }

      if (!response.ok) {
        throw new Error('Failed to generate TTS');
      }

      const audioBuffer = await response.arrayBuffer();
      await this.playAudio(audioBuffer);

    } catch (error) {
      console.error('❌ Failed to generate TTS:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  private async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      const audioData = await this.audioContext.decodeAudioData(audioBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioData;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.isPlaying = false;
      };

      this.isPlaying = true;
      source.start();

      // Notify about audio delta (for avatar lip-sync)
      this.callbacks.onAudioDelta?.(audioBuffer);

    } catch (error) {
      console.error('❌ Failed to play audio:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  // Public methods for configuration
  setVoice(voice: string): void {
    this.sessionConfig.voice = voice;
  }

  setInstructions(instructions: string): void {
    this.sessionConfig.instructions = instructions;
  }

  isServiceConnected(): boolean {
    return this.isConnected;
  }

  getCurrentConfig() {
    return { ...this.sessionConfig };
  }
}
