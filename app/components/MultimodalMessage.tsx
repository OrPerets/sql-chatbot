import React, { useState, useRef } from 'react';
import styles from './multimodal-message.module.css';

interface MultimodalMessageProps {
  role: "user" | "assistant" | "code";
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  feedback?: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
}

export const MultimodalMessage: React.FC<MultimodalMessageProps> = ({
  role,
  text,
  imageUrl,
  audioUrl,
  feedback,
  onFeedback
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioPlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleImageClick = () => {
    setImageExpanded(!imageExpanded);
  };

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Could add a toast notification here
    });
  };

  const handleLike = () => {
    onFeedback?.(feedback === "like" ? null : "like");
  };

  const handleDislike = () => {
    onFeedback?.(feedback === "dislike" ? null : "dislike");
  };

  return (
    <div className={`${styles.message} ${styles[role]}`}>
      <div className={styles.messageContent}>
        {/* Text Content */}
        {text && (
          <div className={styles.textContent}>
            {text}
          </div>
        )}

        {/* Image Content */}
        {imageUrl && (
          <div className={styles.imageContent}>
            {!imageError ? (
              <img
                src={currentImageUrl}
              alt="תמונה שהועלתה"
              className={`${styles.messageImage} ${imageExpanded ? styles.expanded : ''}`}
              onClick={handleImageClick}
              onError={(e) => {
                // Try fallback URL or show placeholder
                if (currentImageUrl === imageUrl && imageUrl?.includes('/uploads/')) {
                  // Try API route fallback
                  const fallbackUrl = imageUrl.replace('/uploads/', '/api/uploads/');
                  setCurrentImageUrl(fallbackUrl);
                } else {
                  // Show error state
                                     setImageError(true);
                 }
               }}
             />
            ) : (
              <div className={styles.imagePlaceholder}>
                <span>📷 תמונה לא זמינה</span>
              </div>
            )}
            {imageExpanded && (
              <div className={styles.imageOverlay} onClick={handleImageClick}>
                <img
                  src={imageUrl}
                  alt="תמונה מוגדלת"
                  className={styles.expandedImage}
                />
                <button className={styles.closeButton} onClick={handleImageClick}>
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* Audio Content */}
        {audioUrl && (
          <div className={styles.audioContent}>
            <button
              className={`${styles.audioButton} ${isPlaying ? styles.playing : ''}`}
              onClick={handleAudioPlay}
              title={isPlaying ? 'השהה השמעה' : 'השמע אודיו'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {isPlaying ? (
                  <rect x="6" y="4" width="4" height="16" />
                ) : (
                  <polygon points="5,3 19,12 5,21" />
                )}
                {isPlaying && <rect x="14" y="4" width="4" height="16" />}
              </svg>
            </button>
            
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              onError={(e) => {
                // Silently handle audio load errors
              }}
              preload="metadata"
            />
            
            <span className={styles.audioLabel}>
              {isPlaying ? 'מנגן...' : 'הודעה קולית'}
            </span>
          </div>
        )}

        {/* Action Buttons for Assistant Messages */}
        {role === 'assistant' && (text || imageUrl || audioUrl) && (
          <div className={styles.messageActions}>
            {/* Copy Text Button */}
            {text && (
              <button
                className={styles.actionButton}
                onClick={() => copyToClipboard(text)}
                title="העתק טקסט"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="m5 15-4-4v-4l4-4h4l4 4v4l-4 4z"/>
                </svg>
              </button>
            )}

            {/* Feedback Buttons */}
            {onFeedback && (
              <>
                <button
                  className={`${styles.actionButton} ${feedback === 'like' ? styles.active : ''}`}
                  onClick={handleLike}
                  title="אהבתי"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                </button>
                <button
                  className={`${styles.actionButton} ${feedback === 'dislike' ? styles.active : ''}`}
                  onClick={handleDislike}
                  title="לא אהבתי"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" transform="rotate(180)">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 