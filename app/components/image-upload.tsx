"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import styles from "./image-upload.module.css";
import { isValidImageFile } from "../utils/parseImage";

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  selectedImage: File | null;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelect,
  selectedImage,
  disabled = false
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const handleFileSelect = (file: File) => {
    setError("");

    if (!isValidImageFile(file)) {
      setError("Please select a valid image file (PNG, JPG, GIF, WebP) under 20MB");
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageSelect(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  };

  const removeImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    onImageSelect(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.container}>
      {selectedImage && previewUrl ? (
        // Image preview
        <div className={styles.preview}>
          <img 
            src={previewUrl} 
            alt="Uploaded preview" 
            className={styles.previewImage}
          />
          <button
            type="button"
            onClick={removeImage}
            className={styles.removeButton}
            disabled={disabled}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        // Upload area
        <div
          className={`${styles.uploadArea} ${dragOver ? styles.dragOver : ""} ${disabled ? styles.disabled : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openFileDialog}
        >
          <div className={styles.uploadContent}>
            <ImageIcon size={24} className={styles.uploadIcon} />
            <span className={styles.uploadText}>
              Click or drag an image to upload
            </span>
            <span className={styles.uploadHint}>
              PNG, JPG, GIF, WebP • Max 20MB
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className={styles.hiddenInput}
        disabled={disabled}
      />

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUpload; 