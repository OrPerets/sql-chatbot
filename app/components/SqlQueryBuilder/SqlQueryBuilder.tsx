"use client";

import React, { useState, useEffect } from 'react';
import styles from './SqlQueryBuilder.module.css';
import { SqlQueryBuilderProps, QueryType } from './types';
import OperationSelection from './OperationSelection';
import CreateTableForm from './CreateTableForm';
import InsertDataForm from './InsertDataForm';
import SqlPreview from './SqlPreview';

type Step = 'operation' | 'form' | 'preview';

const SqlQueryBuilder: React.FC<SqlQueryBuilderProps> = ({
  isOpen,
  onClose,
  onQueryGenerated,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('operation');
  const [selectedOperation, setSelectedOperation] = useState<QueryType | null>(null);
  const [generatedQuery, setGeneratedQuery] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('operation');
      setSelectedOperation(null);
      setGeneratedQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleOperationSelect = (operation: QueryType) => {
    setSelectedOperation(operation);
    setCurrentStep('form');
  };

  const handleBackToOperation = () => {
    setCurrentStep('operation');
    setSelectedOperation(null);
    setGeneratedQuery('');
  };

  const handleQueryGenerated = (query: string) => {
    setGeneratedQuery(query);
    setCurrentStep('preview');
  };

  const handleBackToForm = () => {
    setCurrentStep('form');
  };

  const handleConfirmQuery = () => {
    onQueryGenerated(generatedQuery);
    onClose();
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'operation':
        return 'בחר סוג פעולה';
      case 'form':
        return selectedOperation === 'create' ? 'צור טבלה חדשה' : 'הכנס נתונים';
      case 'preview':
        return 'בדוק את השאילתה';
      default:
        return 'בנה שאילתת SQL';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{getStepTitle()}</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            aria-label="סגור"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {/* Progress Steps */}
          <div className={styles.progressSteps}>
            <div className={`${styles.step} ${currentStep === 'operation' ? styles.active : currentStep !== 'operation' ? styles.completed : ''}`}>
              <div className={styles.stepNumber}>1</div>
              <span>בחר פעולה</span>
            </div>
            <div className={`${styles.stepConnector} ${currentStep !== 'operation' ? styles.completed : ''}`} />
            <div className={`${styles.step} ${currentStep === 'form' ? styles.active : currentStep === 'preview' ? styles.completed : ''}`}>
              <div className={styles.stepNumber}>2</div>
              <span>מלא פרטים</span>
            </div>
            <div className={`${styles.stepConnector} ${currentStep === 'preview' ? styles.completed : ''}`} />
            <div className={`${styles.step} ${currentStep === 'preview' ? styles.active : ''}`}>
              <div className={styles.stepNumber}>3</div>
              <span>אשר שאילתה</span>
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 'operation' && (
            <OperationSelection onSelect={handleOperationSelect} />
          )}

          {currentStep === 'form' && selectedOperation && (
            <>
              {selectedOperation === 'create' ? (
                <CreateTableForm
                  onQueryGenerated={handleQueryGenerated}
                  onBack={handleBackToOperation}
                />
              ) : (
                <InsertDataForm
                  onQueryGenerated={handleQueryGenerated}
                  onBack={handleBackToOperation}
                />
              )}
            </>
          )}

          {currentStep === 'preview' && (
            <SqlPreview
              query={generatedQuery}
              onConfirm={handleConfirmQuery}
              onBack={handleBackToForm}
              onEdit={() => setCurrentStep('form')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlQueryBuilder;
