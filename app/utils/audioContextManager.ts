// Audio Context Manager - Resolves conflicts between TalkingHead and speechSynthesis
export class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private speechActive = false;
  private talkingHeadActive = false;

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  async ensureAudioContextReady(): Promise<boolean> {
    console.log('🔧 AudioContextManager: Ensuring audio context is ready...');
    
    try {
      // Release any existing contexts that might be conflicting
      await this.releaseAllAudioResources();
      
      // Verify speech synthesis is available and clean
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        await this.waitForSpeechSynthesisReady();
        console.log('✅ AudioContextManager: Speech synthesis ready');
        return true;
      }
      
      console.error('❌ AudioContextManager: Speech synthesis not available');
      return false;
    } catch (error) {
      console.error('💥 AudioContextManager: Failed to prepare audio context:', error);
      return false;
    }
  }

  async releaseAllAudioResources(): Promise<void> {
    console.log('🧹 AudioContextManager: Releasing all audio resources...');
    
    // 1. Stop speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.cancel(); // Double cancel for stubborn browsers
      this.speechActive = false;
    }
    
    // 2. Close any existing AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
        console.log('🔇 AudioContextManager: Closed existing AudioContext');
      } catch (error) {
        console.warn('⚠️ AudioContextManager: Error closing AudioContext:', error);
      }
    }
    this.audioContext = null;
    this.talkingHeadActive = false;
    
    // 3. Give browser time to clean up
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async waitForSpeechSynthesisReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });
  }

  async requestSpeechAccess(): Promise<boolean> {
    console.log('🎤 AudioContextManager: Requesting speech access...');
    
    if (this.talkingHeadActive) {
      console.log('⏸️ AudioContextManager: Pausing TalkingHead for speech...');
      this.talkingHeadActive = false;
    }
    
    await this.ensureAudioContextReady();
    this.speechActive = true;
    
    console.log('✅ AudioContextManager: Speech access granted');
    return true;
  }

  releaseSpeechAccess(): void {
    console.log('🤐 AudioContextManager: Releasing speech access...');
    this.speechActive = false;
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  isSpeechActive(): boolean {
    return this.speechActive;
  }

  isTalkingHeadActive(): boolean {
    return this.talkingHeadActive;
  }

  setTalkingHeadActive(active: boolean): void {
    this.talkingHeadActive = active;
    if (active && this.speechActive) {
      console.log('⚠️ AudioContextManager: TalkingHead activated while speech was active');
      this.releaseSpeechAccess();
    }
  }
}

// Export singleton instance
export const audioManager = AudioContextManager.getInstance(); 