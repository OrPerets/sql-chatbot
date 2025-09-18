"use client";

import React from 'react';
import styles from './SqlQueryBuilder.module.css';
import { QueryType } from './types';

interface OperationSelectionProps {
  onSelect: (operation: QueryType) => void;
}

const OperationSelection: React.FC<OperationSelectionProps> = ({ onSelect }) => {
  return (
    <div className={styles.operationSelection}>
      <div
        className={styles.operationCard}
        onClick={() => onSelect('create')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('create');
          }
        }}
      >
        <div className={styles.operationIcon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1h18z" />
            <path d="M21 16c.552 0 1-.448 1-1v-2c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v2c0 .552.448 1 1 1h18z" />
            <path d="M21 20c.552 0 1-.448 1-1v-2c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v2c0 .552.448 1 1 1h18z" />
          </svg>
        </div>
        <h3 className={styles.operationTitle}>צור טבלה חדשה</h3>
        <p className={styles.operationDescription}>
          צור טבלה חדשה עם עמודות, סוגי נתונים ואילוצים
        </p>
      </div>

      <div
        className={styles.operationCard}
        onClick={() => onSelect('insert')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('insert');
          }
        }}
      >
        <div className={styles.operationIcon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <h3 className={styles.operationTitle}>הכנס נתונים</h3>
        <p className={styles.operationDescription}>
          הכנס נתונים חדשים לטבלה קיימת עם אפשרויות מתקדמות
        </p>
      </div>
    </div>
  );
};

export default OperationSelection;
