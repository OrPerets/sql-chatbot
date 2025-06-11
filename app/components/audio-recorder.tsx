"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import styles from './audio-recorder.module.css';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscription, disabled, onRecordingStateChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      console.log('Starting recording...');
      
      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      console.log('Got media stream:', stream);

      // Setup audio context for waveform visualization
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      (source as any).connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Start waveform animation
      updateAudioLevel();

      // Setup MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Cannot access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const updateAudioLevel = () => {
    if (analyserRef.current && isRecording) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);

      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      console.log('Transcribing audio blob:', audioBlob.size, 'bytes');
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('Transcription response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription error response:', errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Transcription result:', data);
      onTranscription(data.transcription);

    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  return (
    <div className={styles.audioRecorder}>
      <button
        type="button"
        className={`${styles.recordButton} ${isRecording ? styles.recording : ''} ${isProcessing ? styles.processing : ''}`}
        onClick={toggleRecording}
        disabled={disabled || isProcessing}
        title={isRecording ? "Stop recording" : "Start recording"}
      >
        {isProcessing ? (
          <div className={styles.spinner} />
        ) : isRecording ? (
          <Square size={16} />
        ) : (
          <Mic size={16} />
        )}
      </button>

      {isRecording && (
        <div className={styles.waveform}>
          <div 
            className={styles.waveBar}
            style={{ height: `${Math.max(audioLevel * 100, 5)}%` }}
          />
          <div 
            className={styles.waveBar}
            style={{ height: `${Math.max(audioLevel * 80, 5)}%` }}
          />
          <div 
            className={styles.waveBar}
            style={{ height: `${Math.max(audioLevel * 60, 5)}%` }}
          />
          <div 
            className={styles.waveBar}
            style={{ height: `${Math.max(audioLevel * 40, 5)}%` }}
          />
          <div 
            className={styles.waveBar}
            style={{ height: `${Math.max(audioLevel * 60, 5)}%` }}
          />
        </div>
      )}

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder; 