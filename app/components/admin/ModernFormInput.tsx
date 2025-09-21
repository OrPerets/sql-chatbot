"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Search, X } from 'lucide-react';
import styles from './ModernFormInput.module.css';

interface ModernFormInputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  success?: boolean;
  helperText?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  clearable?: boolean;
  loading?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outlined' | 'filled' | 'underlined';
}

const ModernFormInput: React.FC<ModernFormInputProps> = ({
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  success = false,
  helperText,
  maxLength,
  minLength,
  pattern,
  autoComplete,
  autoFocus = false,
  clearable = false,
  loading = false,
  prefix,
  suffix,
  onFocus,
  onBlur,
  onClear,
  className = '',
  size = 'md',
  variant = 'outlined'
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update floating label state
  useEffect(() => {
    setIsFloating(value.length > 0 || isFocused);
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) return;
    onChange(newValue);
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
    inputRef.current?.focus();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getInputType = () => {
    if (type === 'password') {
      return showPassword ? 'text' : 'password';
    }
    return type;
  };

  const hasError = !!error;
  const hasValue = value.length > 0;
  const showClearButton = clearable && hasValue && !disabled;
  const showPasswordToggle = type === 'password' && !disabled;

  const inputClasses = [
    styles.input,
    styles[`input${size.charAt(0).toUpperCase() + size.slice(1)}`],
    styles[`input${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    isFocused && styles.inputFocused,
    hasError && styles.inputError,
    success && !hasError && styles.inputSuccess,
    disabled && styles.inputDisabled,
    loading && styles.inputLoading,
    (prefix || suffix || showPasswordToggle || showClearButton) && styles.inputWithAddons,
    className
  ].filter(Boolean).join(' ');

  const containerClasses = [
    styles.container,
    styles[`container${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    isFocused && styles.containerFocused,
    hasError && styles.containerError,
    success && !hasError && styles.containerSuccess,
    disabled && styles.containerDisabled
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.inputWrapper}>
        {/* Floating Label */}
        <label 
          className={`
            ${styles.label}
            ${isFloating ? styles.labelFloating : ''}
            ${isFocused ? styles.labelFocused : ''}
            ${hasError ? styles.labelError : ''}
            ${success && !hasError ? styles.labelSuccess : ''}
          `}
          htmlFor={`input-${label.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>

        {/* Input Field */}
        <div className={styles.inputContainer}>
          {/* Prefix */}
          {prefix && (
            <div className={styles.prefix}>
              {prefix}
            </div>
          )}

          <input
            ref={inputRef}
            id={`input-${label.replace(/\s+/g, '-').toLowerCase()}`}
            type={getInputType()}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={isFocused || !isFloating ? placeholder : ''}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            minLength={minLength}
            pattern={pattern}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            className={inputClasses}
            dir="rtl"
            aria-invalid={hasError}
            aria-describedby={
              (error || helperText) ? `${label.replace(/\s+/g, '-').toLowerCase()}-helper` : undefined
            }
          />

          {/* Suffix / Action Icons */}
          <div className={styles.suffix}>
            {/* Loading Spinner */}
            {loading && (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
              </div>
            )}

            {/* Clear Button */}
            {showClearButton && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={handleClear}
                title="נקה"
                tabIndex={-1}
              >
                <X size={16} />
              </button>
            )}

            {/* Password Toggle */}
            {showPasswordToggle && (
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={togglePasswordVisibility}
                title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}

            {/* Status Icons */}
            {!loading && hasError && (
              <div className={styles.statusIcon}>
                <AlertCircle size={16} />
              </div>
            )}

            {!loading && success && !hasError && (
              <div className={styles.statusIcon}>
                <CheckCircle size={16} />
              </div>
            )}

            {/* Custom Suffix */}
            {suffix && (
              <div className={styles.customSuffix}>
                {suffix}
              </div>
            )}
          </div>
        </div>

        {/* Character Count */}
        {maxLength && (
          <div className={styles.characterCount}>
            <span className={value.length > maxLength * 0.9 ? styles.characterCountWarning : ''}>
              {value.length}
            </span>
            /{maxLength}
          </div>
        )}
      </div>

      {/* Helper Text / Error Message */}
      {(error || helperText) && (
        <div 
          className={`${styles.helperText} ${hasError ? styles.helperTextError : ''}`}
          id={`${label.replace(/\s+/g, '-').toLowerCase()}-helper`}
        >
          {hasError && (
            <AlertCircle size={14} className={styles.helperIcon} />
          )}
          {success && !hasError && (
            <CheckCircle size={14} className={styles.helperIcon} />
          )}
          <span>{error || helperText}</span>
        </div>
      )}
    </div>
  );
};

export default ModernFormInput;
