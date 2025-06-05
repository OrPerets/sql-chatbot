import React, { useState, useRef, useEffect } from 'react';
import { uploadFile } from '@/app/utils/message-helpers';
import styles from './multimodal-input.module.css';

interface MultimodalInputProps {
  onSendMessage: (text: string, imageUrl?: string, audioUrl?: string) => void;
  disabled: boolean;
  userInput: string;
  setUserInput: (value: string) => void;
  placeholder?: string;
  authToken: string;
}

export const MultimodalInput: React.FC<MultimodalInputProps> = ({
  onSendMessage,
  disabled,
  userInput,
  setUserInput,
  placeholder = "הקלד כאן...",
  authToken
}) => {
  // State for file uploads
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // State for voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const preview = URL.createObjectURL(file);
      setImagePreview(preview);
    }
  };

  // Handle audio file selection
  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAudio(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) { // Stop at 1 minute
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('לא ניתן לגשת למיקרופון. אנא בדוק את ההרשאות.');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Clear selected image
  const clearImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clear selected/recorded audio
  const clearAudio = () => {
    setSelectedAudio(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
    setRecordingTime(0);
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userInput.trim() && !selectedImage && !selectedAudio && !audioBlob) {
      return;
    }

    setUploading(true);
    try {
      let uploadedImageUrl: string | undefined;
      let uploadedAudioUrl: string | undefined;

      // Upload image if selected
      if (selectedImage) {
        uploadedImageUrl = await uploadFile(selectedImage, 'image', authToken);
      }

      // Upload audio file if selected
      if (selectedAudio) {
        uploadedAudioUrl = await uploadFile(selectedAudio, 'audio', authToken);
      }
      
      // Upload recorded audio if exists
      if (audioBlob) {
        const recordedFile = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
        uploadedAudioUrl = await uploadFile(recordedFile, 'audio', authToken);
      }

      // Send message with media URLs
      onSendMessage(userInput, uploadedImageUrl, uploadedAudioUrl);
      
      // Clear form
      setUserInput('');
      clearImage();
      clearAudio();
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('שגיאה בהעלאת הקובץ: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.multimodalForm}>
      {/* Media Previews */}
      <div className={styles.mediaPreviewContainer}>
        {/* Image Preview */}
        {imagePreview && (
          <div className={styles.imagePreview}>
            <img src={imagePreview} alt="תצוגה מקדימה" className={styles.previewImage} />
            <button type="button" onClick={clearImage} className={styles.clearButton}>
              ✕
            </button>
          </div>
        )}
        
        {/* Audio Preview */}
        {audioUrl && (
          <div className={styles.audioPreview}>
            <audio controls className={styles.audioPlayer}>
              <source src={audioUrl} type="audio/webm" />
              <source src={audioUrl} type="audio/mpeg" />
              הדפדפן שלך לא תומך בנגן האודיו.
            </audio>
            <button type="button" onClick={clearAudio} className={styles.clearButton}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Input Container */}
      <div className={styles.inputContainer}>
        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={userInput}
          onChange={(e) => {
            setUserInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={placeholder}
          className={styles.textInput}
          disabled={disabled || uploading}
        />

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          {/* Voice Recording Button */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`${styles.actionButton} ${isRecording ? styles.recording : ''}`}
            disabled={disabled || uploading}
            title={isRecording ? 'עצור הקלטה' : 'הקלט הודעה קולית'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              {isRecording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              )}
              {!isRecording && <path d="M19 10v1a7 7 0 0 1-14 0v-1" />}
              {!isRecording && <line x1="12" y1="19" x2="12" y2="23" />}
              {!isRecording && <line x1="8" y1="23" x2="16" y2="23" />}
            </svg>
            {isRecording && <span className={styles.recordingTime}>{formatTime(recordingTime)}</span>}
          </button>

          {/* Image Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={styles.actionButton}
            disabled={disabled || uploading}
            title="העלה תמונה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </button>

          {/* Audio File Upload Button */}
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className={styles.actionButton}
            disabled={disabled || uploading}
            title="העלה קובץ אודיו"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </button>

          {/* Send Button */}
          <button
            type="submit"
            className={styles.sendButton}
            disabled={disabled || uploading || (!userInput.trim() && !selectedImage && !selectedAudio && !audioBlob)}
          >
            {uploading ? (
              <div className={styles.spinner} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 30V9M8 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mp3,audio/mpeg,audio/webm"
          onChange={handleAudioSelect}
          style={{ display: 'none' }}
        />
      </div>
    </form>
  );
}; 