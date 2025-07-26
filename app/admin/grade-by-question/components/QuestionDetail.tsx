"use client";

import React, { memo, useCallback, useMemo } from 'react';
import { ArrowLeft, Users, CheckCircle, Clock, AlertTriangle, Database } from 'lucide-react';
import { useGradeByQuestion, StudentAnswer } from '../contexts/GradeByQuestionContext';
import { detectAITraps, createHighlightedText } from '../../../utils/trapDetector';
import styles from '../page.module.css';

// Database schema for validation (moved from main component)
const DATABASE_SCHEMA = [
  {
    name: 'AirBases',
    nameHe: 'בסיסי חיל האוויר',
    columns: [
      { name: 'base_id', type: 'מזהה ייחודי של הבסיס' },
      { name: 'base_name', type: 'שם הבסיס (רמת דוד, חצרים)' },
      { name: 'base_code', type: 'קוד הבסיס (3 אותיות)' },
      { name: 'location', type: 'אזור גיאוגרפי' },
      { name: 'established_year', type: 'שנת הקמה' },
      { name: 'runways_count', type: 'מספר מסלולי נחיתה' },
      { name: 'personnel_capacity', type: 'מספר מקסימלי של אנשי צוות' }
    ]
  },
  {
    name: 'Squadrons',
    nameHe: 'טייסות',
    columns: [
      { name: 'squadron_id', type: 'מזהה ייחודי של הטייסת' },
      { name: 'squadron_name', type: 'שם הטייסת' },
      { name: 'squadron_number', type: 'מספר הטייסת' },
      { name: 'base_id', type: 'בסיס הטייסת (מפתח זר)' },
      { name: 'aircraft_type', type: 'סוג המטוס העיקרי' },
      { name: 'established_date', type: 'תאריך הקמת הטייסת' },
      { name: 'active_status', type: 'האם הטייסת פעילה' }
    ]
  },
  {
    name: 'Pilots',
    nameHe: 'טייסים',
    columns: [
      { name: 'pilot_id', type: 'מזהה ייחודי של הטייס' },
      { name: 'first_name', type: 'שם פרטי' },
      { name: 'last_name', type: 'שם משפחה' },
      { name: 'rank', type: 'דרגה צבאית' },
      { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
      { name: 'flight_hours', type: 'שעות טיסה מצטברות' },
      { name: 'specialization', type: 'התמחות' },
      { name: 'service_start_date', type: 'תאריך תחילת שירות' }
    ]
  },
  {
    name: 'Aircraft',
    nameHe: 'כלי טיס',
    columns: [
      { name: 'aircraft_id', type: 'מזהה ייחודי של כלי הטיס' },
      { name: 'aircraft_type', type: 'סוג המטוס (F-16, F-35)' },
      { name: 'tail_number', type: 'מספר זנב' },
      { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
      { name: 'manufacture_year', type: 'שנת ייצור' },
      { name: 'last_maintenance', type: 'תאריך תחזוקה אחרונה' },
      { name: 'flight_hours_total', type: 'שעות טיסה מצטברות' },
      { name: 'operational_status', type: 'סטטוס תפעולי' }
    ]
  },
  {
    name: 'Weapons',
    nameHe: 'כלי נשק ותחמושת',
    columns: [
      { name: 'weapon_id', type: 'מזהה ייחודי של כלי הנשק' },
      { name: 'weapon_name', type: 'שם כלי הנשק' },
      { name: 'weapon_type', type: 'סוג (טיל, פצצה, תותח)' },
      { name: 'base_id', type: 'בסיס אחסון (מפתח זר)' },
      { name: 'quantity_available', type: 'כמות זמינה' },
      { name: 'unit_cost', type: 'עלות יחידה באלפי ש"ח' },
      { name: 'minimum_stock', type: 'מלאי מינימום' }
    ]
  },
  {
    name: 'Missions',
    nameHe: 'משימות ותפעול',
    columns: [
      { name: 'mission_id', type: 'מזהה ייחודי של המשימה' },
      { name: 'mission_name', type: 'שם המשימה' },
      { name: 'mission_date', type: 'תאריך המשימה' },
      { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
      { name: 'pilot_id', type: 'הטייס הראשי (מפתח זר)' },
      { name: 'aircraft_id', type: 'כלי הטיס (מפתח זר)' },
      { name: 'mission_duration', type: 'משך המשימה בשעות' },
      { name: 'mission_status', type: 'סטטוס (הושלמה, בביצוע, בוטלה)' }
    ]
  },
  {
    name: 'Maintenance',
    nameHe: 'תחזוקה',
    columns: [
      { name: 'maintenance_id', type: 'מזהה ייחודי של התחזוקה' },
      { name: 'aircraft_id', type: 'כלי הטיס (מפתח זר)' },
      { name: 'maintenance_type', type: 'סוג התחזוקה' },
      { name: 'start_date', type: 'תאריך התחלה' },
      { name: 'end_date', type: 'תאריך סיום התחזוקה' },
      { name: 'cost', type: 'עלות התחזוקה באלפי ש"ח' }
    ]
  }
];

// Utility functions
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty.toLowerCase()) {
    case 'easy': return '#48bb78';
    case 'medium': return '#ed8936';
    case 'hard': return '#e53e3e';
    case 'algebra': return '#8b5cf6';
    default: return '#718096';
  }
};

const getDifficultyText = (difficulty: string) => {
  switch (difficulty.toLowerCase()) {
    case 'easy': return 'קל';
    case 'medium': return 'בינוני';
    case 'hard': return 'קשה';
    case 'algebra': return 'אלגברה';
    default: return difficulty;
  }
};

// Schema validation function
const validateSchema = (answer: string) => {
  const upperAnswer = answer.toUpperCase();
  let hasInvalidTables = false;
  let hasInvalidColumns = false;
  const invalidItems: string[] = [];

  const validTableNames = new Set(DATABASE_SCHEMA.map(table => table.name.toUpperCase()));
  const tableColumnMap = new Map<string, Set<string>>();
  
  DATABASE_SCHEMA.forEach(table => {
    const columns = new Set(table.columns.map(col => col.name.toUpperCase()));
    tableColumnMap.set(table.name.toUpperCase(), columns);
  });

  const tableMatches = upperAnswer.match(/FROM\s+(\w+)|JOIN\s+(\w+)|UPDATE\s+(\w+)|INSERT\s+INTO\s+(\w+)|DELETE\s+FROM\s+(\w+)/gi);
  const referencedTables = new Set<string>();
  
  if (tableMatches) {
    tableMatches.forEach(match => {
      const tableNameMatch = match.match(/(?:FROM|JOIN|UPDATE|INTO)\s+(\w+)/i);
      if (tableNameMatch) {
        referencedTables.add(tableNameMatch[1].toUpperCase());
      }
    });
  }

  referencedTables.forEach(tableName => {
    // Allow "SQUARDRON" as a valid alternative to "SQUADRONS"
    if (!validTableNames.has(tableName) && tableName !== 'SQUARDRON') {
      hasInvalidTables = true;
      invalidItems.push(`טבלה לא קיימת: ${tableName}`);
    }
  });

  return { hasInvalidTables, hasInvalidColumns, invalidItems };
};

// Student Navigation Component
const StudentNavigation = memo(() => {
  const { state, dispatch } = useGradeByQuestion();
  
  if (!state.selectedQuestion) return null;

  const getUniqueAnswers = () => {
    return state.selectedQuestion!.answers.filter((answer, index, self) => {
      const firstOccurrence = self.findIndex(a => a.studentEmail === answer.studentEmail);
      return index === firstOccurrence;
    });
  };

  const uniqueAnswers = getUniqueAnswers();

  const handleAnswerSelect = useCallback((index: number) => {
    const answer = uniqueAnswers[index];
    dispatch({ type: 'SET_CURRENT_ANSWER_INDEX', payload: index });
    dispatch({ type: 'SET_CURRENT_GRADE', payload: answer.grade || (answer.isCorrect ? state.selectedQuestion!.question.points : 0) });
    dispatch({ type: 'SET_CURRENT_FEEDBACK', payload: answer.feedback || '' });
  }, [uniqueAnswers, state.selectedQuestion, dispatch]);

  return (
    <div className={styles.navigationSidebar}>
      <div className={styles.sidebarHeader}>
        <Users size={20} />
        <h3>ניווט תשובות</h3>
      </div>
      
      <div className={styles.navigationList}>
        {uniqueAnswers.map((answer, index) => {
          const answerId = `${answer.examId}-${answer.questionIndex}`;
          const isProcessed = state.processedAnswers.has(answerId);
          const isCurrent = index === state.currentAnswerIndex;
          
          return (
            <div
              key={answerId}
              className={`${styles.navigationItem} ${isCurrent ? styles.currentItem : ''} ${isProcessed ? styles.processedItem : ''}`}
              onClick={() => handleAnswerSelect(index)}
            >
              <div className={styles.navigationItemHeader}>
                <span className={styles.answerNumber}>#{index + 1}</span>
                {isProcessed && <CheckCircle size={14} className={styles.processedIcon} />}
              </div>
              <div className={styles.navigationItemInfo}>
                <div className={styles.studentNameNav}>
                  {answer.studentName || 'לא צוין'}
                </div>
                <div className={styles.studentEmailNav}>
                  {answer.studentEmail}
                </div>
                <div className={styles.answerTimeNav}>
                  {formatTime(answer.timeSpent)}
                </div>
              </div>
              {answer.grade !== undefined && (
                <div className={styles.gradeDisplay}>
                  {answer.grade}/{state.selectedQuestion!.question.points}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className={styles.navigationFooter}>
        <div className={styles.progressStats}>
          <div className={styles.progressItem}>
            <span>הושלמו:</span>
            <span>{state.processedAnswers.size}</span>
          </div>
          <div className={styles.progressItem}>
            <span>נותרו:</span>
            <span>{uniqueAnswers.length - state.processedAnswers.size}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

StudentNavigation.displayName = 'StudentNavigation';

// Current Answer Display Component
const CurrentAnswerDisplay = memo(() => {
  const { state, dispatch, saveGrade, resetToQuestionsList, showMessage } = useGradeByQuestion();
  
  if (!state.selectedQuestion) return null;

  const getUniqueAnswers = () => {
    return state.selectedQuestion!.answers.filter((answer, index, self) => {
      const firstOccurrence = self.findIndex(a => a.studentEmail === answer.studentEmail);
      return index === firstOccurrence;
    });
  };

  const uniqueAnswers = getUniqueAnswers();
  const currentAnswer = uniqueAnswers[state.currentAnswerIndex];

  const handleSaveGrade = useCallback(async () => {
    if (!currentAnswer) return;

    try {
      const aiAnalysis = detectAITraps(currentAnswer.studentAnswer);
      const schemaValidation = validateSchema(currentAnswer.studentAnswer);
      
      let finalGrade = state.currentGrade;
      let finalFeedback = state.currentFeedback;
      
      // Auto-apply schema validation penalties for AI-suspicious answers
      if (aiAnalysis.isAISuspicious && (schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns)) {
        finalGrade = 0;
        const schemaMessage = "יש שימוש בתשובה בעמודות / טבלאות שלא קיימות בבסיס הנתונים.";
        finalFeedback = finalFeedback ? `${finalFeedback}\n${schemaMessage}` : schemaMessage;
      }

      await saveGrade(currentAnswer.examId, currentAnswer.questionIndex, finalGrade, finalFeedback);

      // Auto-save to comment bank if feedback is provided
      if (finalFeedback && finalFeedback.trim()) {
        try {
          await fetch('/api/admin/comment-bank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: state.selectedQuestion!.question.id,
              questionText: state.selectedQuestion!.question.question,
              difficulty: state.selectedQuestion!.question.difficulty,
              score: finalGrade,
              maxScore: state.selectedQuestion!.question.points,
              feedback: finalFeedback,
              gradedBy: 'admin'
            }),
          });
        } catch (commentErr) {
          console.error('Error saving to comment bank:', commentErr);
        }
      }

      // Find next unprocessed answer
      const nextIndex = findNextUnprocessedAnswer();
      if (nextIndex !== -1) {
        dispatch({ type: 'SET_CURRENT_ANSWER_INDEX', payload: nextIndex });
        const nextAnswer = uniqueAnswers[nextIndex];
        dispatch({ type: 'SET_CURRENT_GRADE', payload: nextAnswer.grade || (nextAnswer.isCorrect ? state.selectedQuestion!.question.points : 0) });
        dispatch({ type: 'SET_CURRENT_FEEDBACK', payload: nextAnswer.feedback || '' });
      } else {
        showMessage('כל התשובות לשאלה זו נבדקו!', 'success');
        // Small delay to ensure the message is seen before returning
        setTimeout(() => {
          resetToQuestionsList();
        }, 1500);
      }
    } catch (err) {
      console.error('Error saving answer:', err);
    }
  }, [currentAnswer, state.currentGrade, state.currentFeedback, state.selectedQuestion, saveGrade, dispatch, showMessage, resetToQuestionsList]);

  const findNextUnprocessedAnswer = (): number => {
    for (let i = 0; i < uniqueAnswers.length; i++) {
      const answer = uniqueAnswers[i];
      const answerId = `${answer.examId}-${answer.questionIndex}`;
      if (!state.processedAnswers.has(answerId)) {
        return i;
      }
    }
    return -1;
  };

  if (!currentAnswer) {
    return (
      <div className={styles.noAnswers}>
        <Users size={48} />
        <h3>אין תשובות לשאלה זו</h3>
        <p>לא נמצאו תשובות סטודנטים לשאלה זו</p>
      </div>
    );
  }

  const aiAnalysis = detectAITraps(currentAnswer.studentAnswer);
  const schemaValidation = validateSchema(currentAnswer.studentAnswer);

  return (
    <div className={styles.currentAnswerSection}>
      <div className={styles.answerHeader}>
        <div className={styles.studentInfo}>
          <h3>תשובה {state.currentAnswerIndex + 1} מתוך {uniqueAnswers.length}</h3>
          <div className={styles.studentDetails}>
            <div className={styles.studentName}>
              {currentAnswer.studentName || 'לא צוין'}
            </div>
            <div className={styles.studentMeta}>
              <span>{currentAnswer.studentEmail}</span>
              {currentAnswer.studentId && <span>• ID: {currentAnswer.studentId}</span>}
              <span>• זמן: {formatTime(currentAnswer.timeSpent)}</span>
              <span>• {formatDate(currentAnswer.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Detection and Schema Validation */}
      {(aiAnalysis.isAISuspicious || schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && (
        <div className={styles.aiSuspicionBanner}>
          <div className={styles.aiSuspicionHeader}>
            <AlertTriangle size={20} />
            <span>⚠️ חשוד בשימוש ב-AI 
              {aiAnalysis.isAISuspicious && ` (ציון חשד: ${aiAnalysis.suspicionScore})`}
              {(schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && ' - שימוש בעמודות/טבלאות לא קיימות'}
            </span>
          </div>
          
          {(schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && (
            <div className={styles.aiSuspicionDetails}>
              <div className={styles.aiDetailsTitle}>שגיאות סכמה שנמצאו:</div>
              <ul className={styles.trapsList}>
                {schemaValidation.invalidItems.map((item, index) => (
                  <li key={index} className={`${styles.trapItem} ${styles.trapHigh}`}>
                    <div className={styles.trapDescription}>
                      <strong>{item}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Answer Content */}
      <div className={styles.answerContent}>
        <div className={styles.answerText}>
          <strong>תשובת הסטודנט:</strong>
          <pre className={styles.answerQuery}>
            {aiAnalysis.isAISuspicious && aiAnalysis.highlightedText ? (
              <div dangerouslySetInnerHTML={{ __html: aiAnalysis.highlightedText }} />
            ) : (
              currentAnswer.studentAnswer
            )}
          </pre>
        </div>
      </div>

      {/* Grading Section */}
      <div className={styles.gradingSection}>
        <div className={styles.gradeInputs}>
          <div className={styles.gradeInput}>
            <label>ציון:</label>
            <input
              type="number"
              min="0"
              max={state.selectedQuestion.question.points}
              step="0.1"
              value={state.currentGrade}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_GRADE', payload: Number(e.target.value) })}
              className={styles.gradeField}
            />
            <span>/ {state.selectedQuestion.question.points}</span>
          </div>
          
          <div className={styles.feedbackInput}>
            <label>הערות:</label>
            <textarea
              value={state.currentFeedback}
              onChange={(e) => dispatch({ type: 'SET_CURRENT_FEEDBACK', payload: e.target.value })}
              placeholder="הערות על התשובה..."
              className={styles.feedbackField}
              rows={3}
            />
          </div>
          
          <button
            onClick={handleSaveGrade}
            disabled={state.savingGrade}
            className={styles.doneButton}
          >
            {state.savingGrade ? 'שומר...' : 'סיים ושמור'}
          </button>
        </div>
      </div>
    </div>
  );
});

CurrentAnswerDisplay.displayName = 'CurrentAnswerDisplay';

// Main QuestionDetail Component
const QuestionDetail: React.FC = () => {
  const { state, resetToQuestionsList } = useGradeByQuestion();

  if (!state.selectedQuestion) return null;

  return (
    <div className={styles.gradingView}>
      {state.questionsLoading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100%',
          background: 'white',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 9999
        }}>
          <div className={styles.loadingSpinner}></div>
          <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea', marginTop: '1rem'}}>
            טוען תשובות השאלה...
          </div>
          <div style={{fontSize: '1.3rem', color: '#e53e3e', marginTop: '1rem', fontWeight: 'bold'}}>
            ⏰ אנא המתן...
          </div>
          <button 
            onClick={resetToQuestionsList}
            style={{
              marginTop: '2rem', 
              padding: '1rem 2rem', 
              backgroundColor: '#e53e3e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}
          >
            🚫 ביטול וחזרה לרשימת שאלות
          </button>
        </div>
      ) : (
        <>
          <StudentNavigation />
          
          <div className={styles.mainGradingContent}>
            {/* Question Details Header */}
            <div className={styles.questionDetailsHeader}>
              <button
                onClick={resetToQuestionsList}
                className={styles.backToQuestionsButton}
              >
                <ArrowLeft size={16} />
                חזרה לרשימת שאלות
              </button>
              
              <div className={styles.questionDetails}>
                <div className={styles.questionTitle}>
                  <span className={styles.questionIdLarge}>שאלה #{state.selectedQuestion.question.id}</span>
                  <div 
                    className={styles.difficultyBadgeLarge}
                    style={{ backgroundColor: getDifficultyColor(state.selectedQuestion.question.difficulty) }}
                  >
                    {getDifficultyText(state.selectedQuestion.question.difficulty)} ({state.selectedQuestion.question.points} נקודות)
                  </div>
                </div>
                
                <div className={styles.questionTextLarge}>
                  {state.selectedQuestion.question.question}
                </div>
                
                {/* Correct Answer Display */}
                {state.selectedQuestion.question.solution_example && (
                  <div className={styles.correctAnswerSection}>
                    <div className={styles.correctAnswerHeader}>
                      <strong>תשובה נכונה:</strong>
                    </div>
                    <pre className={styles.correctAnswerText}>
                      {state.selectedQuestion.question.solution_example}
                    </pre>
                  </div>
                )}
                
                <div className={styles.answerStats}>
                  <div className={styles.statItem}>
                    <Users size={16} />
                    <span>{state.selectedQuestion.answers.length} תשובות</span>
                  </div>
                  <div className={styles.statItem}>
                    <CheckCircle size={16} />
                    <span>{state.selectedQuestion.gradedAnswers} בודקו</span>
                  </div>
                  <div className={styles.statItem}>
                    <span>נותרו: {state.selectedQuestion.answers.length - state.processedAnswers.size}</span>
                  </div>
                </div>
              </div>
            </div>

            <CurrentAnswerDisplay />
          </div>
        </>
      )}
    </div>
  );
};

export default QuestionDetail; 