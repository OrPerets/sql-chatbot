"use client";

import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Wrench, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ErrorBanner from './ErrorBanner';
import styles from './MissingAnswersAudit.module.css';

interface MissingAnswersData {
  totalQuestions: number;
  questionsWithoutSolution: number;
  fixedCount?: number;
  missingAnswers?: Array<{
    id: string;
    question: string;
    difficulty: string;
  }>;
}

interface MissingAnswersAuditProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const MissingAnswersAudit: React.FC<MissingAnswersAuditProps> = ({
  onSuccess,
  onError
}) => {
  const [data, setData] = useState<MissingAnswersData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'initial' | 'scanned' | 'fixed'>('initial');

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/check-missing-answers');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'שגיאה בבדיקת תשובות');
      }
      
      setData(result);
      setStep('scanned');
      
      const message = result.questionsWithoutSolution > 0
        ? `נמצאו ${result.questionsWithoutSolution} שאלות ללא תשובות נכונות`
        : 'כל השאלות מכילות תשובות נכונות!';
      
      onSuccess?.(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בבדיקת תשובות';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setScanning(false);
    }
  };

  const handleFix = async () => {
    if (!data || data.questionsWithoutSolution === 0) return;
    
    setFixing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/check-missing-answers', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'שגיאה בתיקון תשובות');
      }
      
      setData(result);
      setStep('fixed');
      
      const message = result.fixedCount > 0
        ? `תוקנו ${result.fixedCount} שאלות בהצלחה!`
        : 'לא נמצאו שאלות לתיקון';
      
      onSuccess?.(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בתיקון תשובות';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setFixing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setData(null);
    setStep('initial');
  };

  const renderInitialState = () => (
    <div className={styles.initialState}>
      <div className={styles.stateIcon}>
        <Search size={48} />
      </div>
      <div className={styles.stateContent}>
        <h3>בדיקת תשובות נכונות</h3>
        <p>בדוק את מסד הנתונים עבור שאלות שחסרות להן תשובות נכונות</p>
        <button
          onClick={handleScan}
          disabled={scanning}
          className={styles.primaryButton}
        >
          {scanning ? (
            <>
              <LoadingSpinner size="small" />
              בודק...
            </>
          ) : (
            <>
              <Search size={16} />
              התחל בדיקה
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderScanResults = () => {
    if (!data) return null;

    return (
      <div className={styles.scanResults}>
        {/* Summary */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <FileText size={20} />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>{data.totalQuestions}</div>
              <div className={styles.summaryLabel}>סה&quot;כ שאלות</div>
            </div>
          </div>
          
          <div className={`${styles.summaryCard} ${data.questionsWithoutSolution > 0 ? styles.warning : styles.success}`}>
            <div className={styles.summaryIcon}>
              {data.questionsWithoutSolution > 0 ? 
                <AlertTriangle size={20} /> : 
                <CheckCircle size={20} />
              }
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>{data.questionsWithoutSolution}</div>
              <div className={styles.summaryLabel}>שאלות ללא תשובות</div>
            </div>
          </div>
          
          {data.fixedCount !== undefined && (
            <div className={`${styles.summaryCard} ${styles.success}`}>
              <div className={styles.summaryIcon}>
                <Wrench size={20} />
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryValue}>{data.fixedCount}</div>
                <div className={styles.summaryLabel}>תוקנו</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actionButtons}>
          <button
            onClick={handleScan}
            disabled={scanning}
            className={styles.secondaryButton}
          >
            {scanning ? (
              <LoadingSpinner size="small" />
            ) : (
              <RefreshCw size={16} />
            )}
            בדיקה מחדש
          </button>
          
          {data.questionsWithoutSolution > 0 && step !== 'fixed' && (
            <button
              onClick={handleFix}
              disabled={fixing}
              className={styles.dangerButton}
            >
              {fixing ? (
                <>
                  <LoadingSpinner size="small" />
                  מתקן...
                </>
              ) : (
                <>
                  <Wrench size={16} />
                  תקן {data.questionsWithoutSolution} שאלות
                </>
              )}
            </button>
          )}
        </div>

        {/* Detailed Results */}
        {data.missingAnswers && data.missingAnswers.length > 0 && (
          <div className={styles.detailedResults}>
            <div className={styles.resultsHeader}>
              <h4>שאלות שדורשות תיקון:</h4>
              <span className={styles.resultsBadge}>
                {data.missingAnswers.length} שאלות
              </span>
            </div>
            
            <div className={styles.questionsList}>
              {data.missingAnswers.map((question) => (
                <div key={question.id} className={styles.questionItem}>
                  <div className={styles.questionInfo}>
                    <div className={styles.questionId}>שאלה #{question.id}</div>
                    <div className={styles.questionText}>{question.question}</div>
                    <div className={styles.questionMeta}>
                      <span className={styles.difficulty}>
                        רמת קושי: {question.difficulty}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      // Navigate to question editor
                      window.open(`/homework/questions?id=${question.id}`, '_blank');
                    }}
                    className={styles.editButton}
                    title="ערוך שאלה"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success State */}
        {data.questionsWithoutSolution === 0 && (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <CheckCircle size={32} />
            </div>
            <div className={styles.successMessage}>
              כל השאלות מכילות תשובות נכונות!
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <FileText size={20} />
        </div>
        <div className={styles.headerContent}>
          <h3>בדיקת תשובות נכונות</h3>
          <p>וודא שכל השאלות במסד הנתונים מכילות תשובות נכונות</p>
        </div>
      </div>

      {error && (
        <ErrorBanner
          message="שגיאה בעיבוד הבקשה"
          details={error}
          type="error"
          retryable
          dismissible
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
        />
      )}

      <div className={styles.content}>
        {step === 'initial' && renderInitialState()}
        {(step === 'scanned' || step === 'fixed') && renderScanResults()}
      </div>
    </div>
  );
};

export default MissingAnswersAudit;
