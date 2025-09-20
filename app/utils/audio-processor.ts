// Audio Processing Service for TTS Enhancement
export interface AudioProcessingOptions {
  normalize?: boolean;
  compress?: boolean;
  quality?: 'low' | 'medium' | 'high';
  format?: 'mp3' | 'wav' | 'ogg';
  bitrate?: number;
  noiseReduction?: boolean;
  dynamicRange?: boolean;
}

export interface AudioQualityMetrics {
  quality: number; // 1-5 scale
  size: number; // bytes
  duration: number; // seconds
  bitrate: number; // kbps
  sampleRate: number; // Hz
  channels: number;
  dynamicRange: number; // dB
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private isSupported = false;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    if (typeof window === 'undefined') {
      this.isSupported = false;
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.isSupported = true;
      }
    } catch (error) {
      console.warn('AudioContext not supported:', error);
      this.isSupported = false;
    }
  }

  // Normalize audio levels for consistent volume
  async normalizeAudio(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.isSupported || !this.audioContext) {
      return audioBuffer;
    }

    try {
      const audioBufferSource = await this.audioContext.decodeAudioData(audioBuffer);
      const samples = audioBufferSource.getChannelData(0);
      
      // Find peak level
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        peak = Math.max(peak, Math.abs(samples[i]));
      }

      // Normalize to 95% of full scale (leave headroom)
      if (peak > 0) {
        const factor = 0.95 / peak;
        for (let i = 0; i < samples.length; i++) {
          samples[i] *= factor;
        }
      }

      // In a real implementation, you'd re-encode the audio
      // For now, return the original buffer
      return audioBuffer;
    } catch (error) {
      console.error('Audio normalization failed:', error);
      return audioBuffer;
    }
  }

  // Apply noise reduction (basic implementation)
  async reduceNoise(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.isSupported || !this.audioContext) {
      return audioBuffer;
    }

    try {
      const audioBufferSource = await this.audioContext.decodeAudioData(audioBuffer);
      const samples = audioBufferSource.getChannelData(0);
      
      // Simple noise gate - remove samples below threshold
      const threshold = 0.01; // Adjust based on noise level
      for (let i = 0; i < samples.length; i++) {
        if (Math.abs(samples[i]) < threshold) {
          samples[i] = 0;
        }
      }

      return audioBuffer;
    } catch (error) {
      console.error('Noise reduction failed:', error);
      return audioBuffer;
    }
  }

  // Dynamic range compression
  async compressDynamicRange(audioBuffer: ArrayBuffer, ratio: number = 4): Promise<ArrayBuffer> {
    if (!this.isSupported || !this.audioContext) {
      return audioBuffer;
    }

    try {
      const audioBufferSource = await this.audioContext.decodeAudioData(audioBuffer);
      const samples = audioBufferSource.getChannelData(0);
      
      // Simple dynamic range compression
      const threshold = 0.5; // Compression threshold
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        if (Math.abs(sample) > threshold) {
          const excess = Math.abs(sample) - threshold;
          const compressed = threshold + (excess / ratio);
          samples[i] = Math.sign(sample) * Math.min(compressed, 1.0);
        }
      }

      return audioBuffer;
    } catch (error) {
      console.error('Dynamic range compression failed:', error);
      return audioBuffer;
    }
  }

  // Assess audio quality metrics
  async assessQuality(audioBuffer: ArrayBuffer): Promise<AudioQualityMetrics> {
    if (!this.isSupported || !this.audioContext) {
      return {
        quality: 3,
        size: audioBuffer.byteLength,
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        channels: 0,
        dynamicRange: 0
      };
    }

    try {
      const audioBufferSource = await this.audioContext.decodeAudioData(audioBuffer);
      const duration = audioBufferSource.duration;
      const sampleRate = audioBufferSource.sampleRate;
      const channels = audioBufferSource.numberOfChannels;
      const size = audioBuffer.byteLength;
      const bitrate = (size * 8) / duration / 1000; // kbps

      // Calculate dynamic range
      const samples = audioBufferSource.getChannelData(0);
      let min = 0, max = 0;
      for (let i = 0; i < samples.length; i++) {
        min = Math.min(min, samples[i]);
        max = Math.max(max, samples[i]);
      }
      const dynamicRange = 20 * Math.log10(max / Math.abs(min)); // dB

      // Calculate quality score (1-5)
      let quality = 3; // Base quality
      if (bitrate > 192) quality += 1;
      if (sampleRate >= 44100) quality += 0.5;
      if (dynamicRange > 60) quality += 0.5;
      if (channels > 1) quality += 0.5;
      quality = Math.min(5, quality);

      return {
        quality,
        size,
        duration,
        bitrate,
        sampleRate,
        channels,
        dynamicRange
      };
    } catch (error) {
      console.error('Quality assessment failed:', error);
      return {
        quality: 3,
        size: audioBuffer.byteLength,
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        channels: 0,
        dynamicRange: 0
      };
    }
  }

  // Format conversion (placeholder - would need proper audio encoding)
  async convertFormat(
    audioBuffer: ArrayBuffer, 
    targetFormat: 'mp3' | 'wav' | 'ogg'
  ): Promise<ArrayBuffer> {
    // In a real implementation, you'd use proper audio encoding libraries
    // For now, return the original buffer
    console.log(`Converting audio to ${targetFormat} format (placeholder)`);
    return audioBuffer;
  }

  // Get optimal bitrate based on content type and length
  getOptimalBitrate(textLength: number, contentType?: string): number {
    switch (contentType) {
      case 'sql':
        return textLength > 200 ? 128 : 192;
      case 'explanation':
        return textLength > 500 ? 128 : 160;
      case 'question':
        return 192;
      case 'feedback':
        return 160;
      default:
        return textLength > 300 ? 128 : 160;
    }
  }

  // Process audio with multiple enhancements
  async processAudio(
    audioBuffer: ArrayBuffer, 
    options: AudioProcessingOptions = {}
  ): Promise<{ processedAudio: ArrayBuffer; metrics: AudioQualityMetrics }> {
    let processedAudio = audioBuffer;

    // Apply processing steps
    if (options.normalize) {
      processedAudio = await this.normalizeAudio(processedAudio);
    }

    if (options.noiseReduction) {
      processedAudio = await this.reduceNoise(processedAudio);
    }

    if (options.dynamicRange) {
      processedAudio = await this.compressDynamicRange(processedAudio);
    }

    if (options.format && options.format !== 'mp3') {
      processedAudio = await this.convertFormat(processedAudio, options.format);
    }

    // Assess final quality
    const metrics = await this.assessQuality(processedAudio);

    return { processedAudio, metrics };
  }

  // Check if audio processing is supported
  isAudioProcessingSupported(): boolean {
    return this.isSupported;
  }

  // Get supported formats
  getSupportedFormats(): string[] {
    if (!this.isSupported) {
      return ['mp3']; // Fallback to basic support
    }
    
    return ['mp3', 'wav', 'ogg'];
  }

  // Clean up resources
  cleanup(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const audioProcessor = new AudioProcessor();
