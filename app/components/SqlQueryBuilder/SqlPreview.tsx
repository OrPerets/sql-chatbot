"use client";

import React, { useState } from 'react';
import styles from './SqlQueryBuilder.module.css';

interface SqlPreviewProps {
  query: string;
  onConfirm: () => void;
  onBack: () => void;
  onEdit: () => void;
}

const SqlPreview: React.FC<SqlPreviewProps> = ({
  query,
  onConfirm,
  onBack,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatSql = (sql: string) => {
    // Basic SQL formatting for better readability
    return sql
      .replace(/\bCREATE\s+TABLE\b/gi, 'CREATE TABLE')
      .replace(/\bINSERT\s+INTO\b/gi, 'INSERT INTO')
      .replace(/\bVALUES\b/gi, 'VALUES')
      .replace(/\bPRIMARY\s+KEY\b/gi, 'PRIMARY KEY')
      .replace(/\bNOT\s+NULL\b/gi, 'NOT NULL')
      .replace(/\bAUTO_INCREMENT\b/gi, 'AUTO_INCREMENT')
      .replace(/\bUNIQUE\b/gi, 'UNIQUE')
      .replace(/\bDEFAULT\b/gi, 'DEFAULT')
      .replace(/\bBEGIN\s+TRANSACTION\b/gi, 'BEGIN TRANSACTION')
      .replace(/\bCOMMIT\b/gi, 'COMMIT');
  };

  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label className={styles.label}>השאילתה שנוצרה:</label>
        <div style={{ position: 'relative' }}>
          <textarea
            className={styles.textarea}
            value={formatSql(query)}
            readOnly
            style={{
              minHeight: '200px',
              backgroundColor: '#f8fafc',
              border: '2px solid #e2e8f0',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            className={styles.button}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              background: copied ? '#10b981' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {copied ? 'הועתק!' : 'העתק'}
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '14px' }}>
          💡 טיפים לשימוש:
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#0369a1' }}>
          <li>השאילתה תתווסף לשדה הטקסט בצ'אט</li>
          <li>תוכל לערוך אותה לפני השליחה</li>
          <li>השתמש בכפתור "העתק" כדי להעתיק לזיכרון</li>
          <li>לחץ "ערוך" כדי לחזור ולשנות את הפרטים</li>
        </ul>
      </div>

      <div className={styles.buttonGroup}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onBack}
        >
          חזור
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onEdit}
        >
          ערוך
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSuccess}`}
          onClick={onConfirm}
        >
          הוסף לצ'אט
        </button>
      </div>
    </div>
  );
};

export default SqlPreview;
