"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, AlertTriangle, BookOpen, Edit3, Save, XCircle, List, Trash2, Sparkles, Plus } from 'lucide-react';
import styles from './page.module.css';
import config from '../../config';

const SERVER_BASE = config.serverUrl;

interface Question {
  id: number;
  question: string;
  expected_keywords: string[];
  difficulty: string;
  solution_example: string;
  points: number;
  approved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

interface EditingState {
  questionId: number;
  difficulty: string;
  question: string;
  solution_example: string;
}

const QuestionApprovalPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [editingQuestion, setEditingQuestion] = useState<EditingState | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isGeneratingWithMichael, setIsGeneratingWithMichael] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(storedUser);
    const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"];
    const isAdmin = adminEmails.includes(user.email);
    
    if (!isAdmin) {
      setError('אין לך הרשאת גישה לעמוד זה');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      return;
    }

    fetchQuestions();
  }, [router]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_BASE}/api/questions`);
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      const data = await response.json();
      console.log('Fetched questions data:', data);
      console.log('Questions with approval status:', data.map(q => ({ id: q.id, approved: q.approved, approvedAt: q.approvedAt })));
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('שגיאה בטעינת השאלות');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (question: Question) => {
    setEditingQuestion({
      questionId: question.id,
      difficulty: question.difficulty,
      question: question.question,
      solution_example: question.solution_example
    });
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
  };

  const handleGenerateWithMichael = async () => {
    if (!editingQuestion) return;

    setIsGeneratingWithMichael(true);
    try {
      // Create prompt for Michael to generate a better solution
      const prompt = `אני רוצה שתיצור פתרון SQL מדויק ומפורט לשאלה הזאת:

שאלה: "${editingQuestion.question}"
רמת קושי: ${getDifficultyText(editingQuestion.difficulty)}

אנא ספק פתרון SQL שהוא:
1. מדויק ונכון תחבירית
2. מותאם לרמת הקושי שצוינה
3. כולל הסברים בהערות אם נדרש
4. עוקב אחר best practices של SQL

אנא החזר רק את קוד ה-SQL ללא הסברים נוספים.`;

      // Send message to Michael using the generate-response API
      const response = await fetch('/api/assistants/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: prompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate response');
      }

      const responseData = await response.json();
      
      if (responseData.error) {
        throw new Error(responseData.error);
      }
      
      // Extract the solution
      const solution = responseData.response || '';
      
      if (solution) {
        // Clean up the solution to extract only SQL code
        const cleanedSolution = solution
          .replace(/```sql/gi, '')
          .replace(/```/g, '')
          .trim();

        setEditingQuestion({
          ...editingQuestion,
          solution_example: cleanedSolution
        });

        setSuccessMessage('מייקל יצר פתרון חדש בהצלחה!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('No solution generated');
      }

    } catch (err) {
      console.error('Error generating with Michael:', err);
      setError('שגיאה ביצירת פתרון עם מייקל. נסה שוב.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsGeneratingWithMichael(false);
    }
  };

  const handleGenerateQuestions = async (difficulty: string) => {
    setIsGeneratingQuestions(true);
    setShowGenerateDialog(false);
    
    try {
      // Get current user info
      const storedUser = localStorage.getItem("currentUser");
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const approverEmail = currentUser?.email || 'Unknown';

      // Create prompt for Michael to generate 5 unique questions
      const difficultyText = getDifficultyText(difficulty);
      const prompt = `אני רוצה שתיצור 5 שאלות SQL חדשות ומקוריות ברמת קושי: ${difficultyText}

הנחיות חשובות:
1. כל שאלה צריכה להיות שונה ומקורית
2. השאלות צריכות להיות מתאימות לרמת הקושי שנבחרה
3. כל שאלה צריכה לכלול פתרון SQL מדויק
4. השאלות צריכות להיות על מסדי נתונים ו-SQL בלבד
5. הימנע משאלות שכבר קיימות במערכת

עבור כל שאלה, ספק בפורמט הבא:
---
שאלה: [נוסח השאלה בעברית]
פתרון: [קוד SQL מדויק]
מילות מפתח: [רשימת מילות מפתח מופרדות בפסיק]
נקודות: [מספר נקודות מתאים לרמת הקושי - קל: 5-10, בינוני: 10-15, קשה: 15-25]
---

אנא יצור בדיוק 5 שאלות בפורמט זה.`;

      // Send message to Michael using the generate-response API
      const response = await fetch('/api/assistants/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: prompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate questions');
      }

      const responseData = await response.json();
      
      if (responseData.error) {
        throw new Error(responseData.error);
      }
      
      const generatedContent = responseData.response || '';
      
      if (generatedContent) {
        // Parse the generated questions
        const questionBlocks = generatedContent.split('---').filter(block => block.trim());
        const newQuestions = [];

        for (const block of questionBlocks) {
          const lines = block.trim().split('\n').filter(line => line.trim());
          let question = '';
          let solution = '';
          let keywords = [];
          let points = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 8 : 10;

          for (const line of lines) {
            if (line.startsWith('שאלה:')) {
              question = line.replace('שאלה:', '').trim();
            } else if (line.startsWith('פתרון:')) {
              solution = line.replace('פתרון:', '').trim();
            } else if (line.startsWith('מילות מפתח:')) {
              keywords = line.replace('מילות מפתח:', '').split(',').map(k => k.trim());
            } else if (line.startsWith('נקודות:')) {
              points = parseInt(line.replace('נקודות:', '').trim()) || points;
            }
          }

          if (question && solution) {
            newQuestions.push({
              question,
              solution_example: solution,
              expected_keywords: keywords,
              difficulty,
              points
            });
          }
        }

        // Send the new questions to the backend
        let addedCount = 0;
        for (const newQuestion of newQuestions) {
          try {
            const addResponse = await fetch(`${SERVER_BASE}/api/questions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(newQuestion)
            });

            if (addResponse.ok) {
              addedCount++;
            }
          } catch (err) {
            console.error('Error adding question:', err);
          }
        }

        // Refresh the questions list
        await fetchQuestions();

        if (addedCount > 0) {
          setSuccessMessage(`מייקל יצר ${addedCount} שאלות חדשות ברמת קושי ${difficultyText}!`);
        } else {
          setError('לא הצלחנו להוסיף שאלות חדשות. נסה שוב.');
        }
      } else {
        throw new Error('No questions generated');
      }

    } catch (err) {
      console.error('Error generating questions:', err);
      setError('שגיאה ביצירת שאלות חדשות עם מייקל. נסה שוב.');
    } finally {
      setIsGeneratingQuestions(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 5000);
    }
  };

  const removeTableDetails = (questionText: string): string => {
    // Remove various patterns of table references in Hebrew
    return questionText
      .replace(/מתוך טבלת\s+\w+/gi, '')
      .replace(/מטבלת\s+\w+/gi, '')
      .replace(/מהטבלה\s+\w+/gi, '')
      .replace(/מטבלה\s+\w+/gi, '')
      .replace(/מן הטבלה\s+\w+/gi, '')
      .replace(/מן טבלת\s+\w+/gi, '')
      .replace(/בטבלת\s+\w+/gi, '')
      .replace(/בטבלה\s+\w+/gi, '')
      .replace(/טבלת\s+\w+/gi, '')
      .replace(/הטבלה\s+\w+/gi, '')
      .replace(/\s+,\s*/gi, ', ') // Clean up multiple commas
      .replace(/\s+\.\s*/gi, '. ') // Clean up multiple periods
      .replace(/\s+/gi, ' ') // Clean up multiple spaces
      .trim();
  };

  const handleFixPoints = async () => {
    if (!confirm('האם אתה בטוח שברצונך לתקן את הנקודות של כל השאלות? (קל=6, בינוני=8, קשה=10)')) {
      return;
    }

    setIsCleaningUp(true);
    let updatedCount = 0;
    let errorCount = 0;

    try {
      for (const question of questions) {
        const correctPoints = question.difficulty === 'easy' ? 6 : 
                             question.difficulty === 'medium' ? 8 : 10;
        
        // Only update if points are incorrect
        if (question.points !== correctPoints) {
          try {
            const response = await fetch(`${SERVER_BASE}/api/questions/${question.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                question: question.question,
                difficulty: question.difficulty,
                solution_example: question.solution_example,
                points: correctPoints
              }),
            });

            if (response.ok) {
              updatedCount++;
            } else {
              errorCount++;
              console.error(`Failed to update question ${question.id}`);
            }
          } catch (err) {
            errorCount++;
            console.error(`Error updating question ${question.id}:`, err);
          }
        }
      }

      // Refresh the questions list
      await fetchQuestions();
      
      if (updatedCount > 0) {
        setSuccessMessage(`עודכנו ${updatedCount} שאלות עם נקודות נכונות${errorCount > 0 ? ` (${errorCount} שאלות נכשלו)` : ''}`);
      } else {
        setSuccessMessage('כל השאלות כבר עם נקודות נכונות');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (err) {
      console.error('Error during points fix:', err);
      setError('שגיאה בתיקון הנקודות');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleCleanupQuestions = async () => {
    if (!confirm('האם אתה בטוח שברצונך להסיר פרטי טבלאות מכל השאלות? פעולה זו תשנה את כל השאלות במערכת.')) {
      return;
    }

    setIsCleaningUp(true);
    let updatedCount = 0;
    let errorCount = 0;

    try {
      for (const question of questions) {
        const cleanedQuestion = removeTableDetails(question.question);
        
        // Only update if the question actually changed
        if (cleanedQuestion !== question.question && cleanedQuestion.length > 10) {
          try {
            const response = await fetch(`${SERVER_BASE}/api/questions/${question.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                question: cleanedQuestion,
                difficulty: question.difficulty,
                solution_example: question.solution_example
              }),
            });

            if (response.ok) {
              updatedCount++;
            } else {
              errorCount++;
              console.error(`Failed to update question ${question.id}`);
            }
          } catch (err) {
            errorCount++;
            console.error(`Error updating question ${question.id}:`, err);
          }
        }
      }

      // Refresh the questions list
      await fetchQuestions();
      
      if (updatedCount > 0) {
        setSuccessMessage(`עודכנו ${updatedCount} שאלות בהצלחה${errorCount > 0 ? ` (${errorCount} שאלות נכשלו)` : ''}`);
      } else {
        setSuccessMessage('לא נמצאו שאלות הדורשות עדכון');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (err) {
      console.error('Error during cleanup:', err);
      setError('שגיאה בתהליך הניקוי');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;

    setProcessingIds(prev => new Set(prev).add(editingQuestion.questionId));
    try {
      const response = await fetch(`${SERVER_BASE}/api/questions/${editingQuestion.questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          difficulty: editingQuestion.difficulty,
          question: editingQuestion.question,
          solution_example: editingQuestion.solution_example
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      // Update the local state
      setQuestions(prev => prev.map(q => 
        q.id === editingQuestion.questionId 
          ? { 
              ...q, 
              difficulty: editingQuestion.difficulty,
              question: editingQuestion.question,
              solution_example: editingQuestion.solution_example
            }
          : q
      ));

      setEditingQuestion(null);
      setSuccessMessage(`שאלה ${editingQuestion.questionId} עודכנה בהצלחה`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err) {
      console.error('Error updating question:', err);
      setError('שגיאה בעדכון השאלה');
      setTimeout(() => setError(''), 3000);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(editingQuestion.questionId);
        return newSet;
      });
    }
  };

  const handleApprove = async (questionId: number) => {
    setProcessingIds(prev => new Set(prev).add(questionId));
    try {
      // Get current user info
      const storedUser = localStorage.getItem("currentUser");
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const approverEmail = currentUser?.email || 'Unknown';

      const response = await fetch(`${SERVER_BASE}/api/questions/${questionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedBy: approverEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve question');
      }

      // Refresh the questions from the server to get the updated approval status
      await fetchQuestions();

      setSuccessMessage(`שאלה ${questionId} אושרה בהצלחה על ידי ${approverEmail}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err) {
      console.error('Error approving question:', err);
      setError('שגיאה באישור השאלה');
      setTimeout(() => setError(''), 3000);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
    }
  };

  const handleReject = async (questionId: number) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את שאלה ${questionId}? פעולה זו לא ניתנת לביטול.`)) {
      return;
    }

    setProcessingIds(prev => new Set(prev).add(questionId));
    try {
      const response = await fetch(`${SERVER_BASE}/api/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reject question');
      }

      // Remove the question from the list
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      setSuccessMessage(`שאלה ${questionId} נמחקה בהצלחה`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err) {
      console.error('Error rejecting question:', err);
      setError('שגיאה במחיקת השאלה');
      setTimeout(() => setError(''), 3000);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
    }
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
      case 'algebra': return 'אלגברה יחסית';
      default: return difficulty;
    }
  };

  const formatSqlSolution = (solution: string) => {
    // Format SQL by putting main keywords on separate lines
    return solution
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
      .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
      .replace(/\bON\b/gi, '\nON')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bAND\b/gi, '\n  AND')
      .replace(/\bOR\b/gi, '\n  OR')
      .trim();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>טוען שאלות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          onClick={() => router.push('/admin')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          חזרה לפאנל הניהול
        </button>
        <div className={styles.headerTitle}>
          <BookOpen size={24} />
          <h1>אישור שאלות בחינה</h1>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={() => setShowGenerateDialog(true)}
            disabled={isGeneratingQuestions}
            className={styles.generateButton}
          >
            <Plus size={20} />
            {isGeneratingQuestions ? 'מייקל יצירת שאלות...' : 'יצירת שאלות עם מייקל'}
          </button>
          <button 
            onClick={handleFixPoints}
            disabled={isCleaningUp || questions.length === 0}
            className={styles.cleanupButton}
          >
            <Sparkles size={20} />
            {isCleaningUp ? 'מתקן...' : 'תקן נקודות'}
          </button>
          <button 
            onClick={handleCleanupQuestions}
            disabled={isCleaningUp || questions.length === 0}
            className={styles.cleanupButton}
          >
            <Trash2 size={20} />
            {isCleaningUp ? 'מנקה...' : 'הסר פרטי טבלאות'}
          </button>
          <button 
            onClick={() => router.push('/admin/questions/approved')}
            className={styles.approvedQuestionsButton}
          >
            <List size={20} />
            שאלות מאושרות
          </button>
          <div className={styles.headerInfo}>
            <span>
              {questions.filter(q => !q.approved).length} שאלות מחכות לאישור • {questions.filter(q => q.approved).length} אושרו
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

      {/* Generate Questions Dialog */}
      {showGenerateDialog && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialog}>
            <h3>יצירת שאלות חדשות עם מייקל</h3>
            <p>בחר את רמת הקושי לשאלות החדשות:</p>
            <div className={styles.difficultyOptions}>
              <button
                onClick={() => handleGenerateQuestions('easy')}
                className={`${styles.difficultyButton} ${styles.easyButton}`}
              >
                קל (5 שאלות)
              </button>
              <button
                onClick={() => handleGenerateQuestions('medium')}
                className={`${styles.difficultyButton} ${styles.mediumButton}`}
              >
                בינוני (5 שאלות)
              </button>
              <button
                onClick={() => handleGenerateQuestions('hard')}
                className={`${styles.difficultyButton} ${styles.hardButton}`}
              >
                קשה (5 שאלות)
              </button>
            </div>
            <div className={styles.dialogActions}>
              <button
                onClick={() => setShowGenerateDialog(false)}
                className={styles.cancelDialogButton}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className={styles.questionsContainer}>
        {questions.filter(q => !q.approved).length === 0 ? (
          <div className={styles.noQuestions}>
            <AlertTriangle size={48} />
            <h2>אין שאלות להצגה</h2>
            <p>כל השאלות אושרו או שלא קיימות שאלות במערכת</p>
          </div>
        ) : (
          questions.filter(question => !question.approved).map((question) => (
            <div key={question.id} className={`${styles.questionCard} ${question.approved ? styles.approvedCard : ''}`}>
              <div className={styles.questionHeader}>
                <div className={styles.questionNumber}>
                  שאלה #{question.id}
                  {question.approved && (
                    <div className={styles.approvedBadge}>
                      <Check size={16} />
                      אושר
                    </div>
                  )}
                </div>
                <div className={styles.badgeGroup}>
                  {editingQuestion?.questionId === question.id ? (
                    <select
                      value={editingQuestion.difficulty}
                      onChange={(e) => setEditingQuestion({
                        ...editingQuestion,
                        difficulty: e.target.value
                      })}
                      className={styles.difficultySelect}
                    >
                      <option value="easy">קל</option>
                      <option value="medium">בינוני</option>
                      <option value="hard">קשה</option>
                    </select>
                  ) : (
                    <div 
                      className={styles.difficultyBadge}
                      style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                    >
                      {getDifficultyText(question.difficulty)} • {question.points} נקודות
                    </div>
                  )}
                  {question.approved && question.approvedAt && (
                    <div className={styles.approvalInfo}>
                      <div className={styles.approvalTimestamp}>
                        אושר: {new Date(question.approvedAt).toLocaleDateString('he-IL')}
                      </div>
                      {question.approvedBy && (
                        <div className={styles.approverInfo}>
                          על ידי: {question.approvedBy}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.questionContent}>
                <div className={styles.questionText}>
                  <h3>השאלה:</h3>
                  {editingQuestion?.questionId === question.id ? (
                    <textarea
                      value={editingQuestion.question}
                      onChange={(e) => setEditingQuestion({
                        ...editingQuestion,
                        question: e.target.value
                      })}
                      className={styles.editTextarea}
                      rows={4}
                    />
                  ) : (
                    <p>{question.question}</p>
                  )}
                </div>

                <div className={styles.questionDetails}>
                  <div className={styles.solution}>
                    <div className={styles.solutionHeader}>
                      <h4>פתרון לדוגמה:</h4>
                      {editingQuestion?.questionId === question.id && (
                        <button
                          onClick={handleGenerateWithMichael}
                          disabled={isGeneratingWithMichael}
                          className={styles.michaelGenerateButton}
                        >
                          <Sparkles size={16} />
                          {isGeneratingWithMichael ? 'מייקל יוצר פתרון...' : 'צור עם מייקל'}
                        </button>
                      )}
                    </div>
                    {editingQuestion?.questionId === question.id ? (
                      <textarea
                        value={editingQuestion.solution_example}
                        onChange={(e) => setEditingQuestion({
                          ...editingQuestion,
                          solution_example: e.target.value
                        })}
                        className={styles.editSolutionTextarea}
                        rows={6}
                      />
                    ) : (
                      <pre className={styles.solutionCode}>
                        {formatSqlSolution(question.solution_example)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.questionActions}>
                {editingQuestion?.questionId === question.id ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className={`${styles.actionButton} ${styles.cancelButton}`}
                    >
                      <XCircle size={18} />
                      ביטול
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={processingIds.has(question.id)}
                      className={`${styles.actionButton} ${styles.saveButton}`}
                    >
                      <Save size={18} />
                      {processingIds.has(question.id) ? 'שומר...' : 'שמור'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(question)}
                      className={`${styles.actionButton} ${styles.editButton}`}
                    >
                      <Edit3 size={18} />
                      עריכה
                    </button>
                    <button
                      onClick={() => handleReject(question.id)}
                      disabled={processingIds.has(question.id)}
                      className={`${styles.actionButton} ${styles.rejectButton}`}
                    >
                      <X size={18} />
                      {processingIds.has(question.id) ? 'מוחק...' : 'דחה'}
                    </button>
                    {question.approved ? (
                      <button
                        disabled
                        className={`${styles.actionButton} ${styles.alreadyApprovedButton}`}
                      >
                        <Check size={18} />
                        כבר אושר
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(question.id)}
                        disabled={processingIds.has(question.id)}
                        className={`${styles.actionButton} ${styles.approveButton}`}
                      >
                        <Check size={18} />
                        {processingIds.has(question.id) ? 'מאשר...' : 'אשר'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuestionApprovalPage; 