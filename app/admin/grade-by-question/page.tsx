"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Search, Eye, Users, CheckCircle, XCircle, Clock, Edit3, Filter, BarChart3 } from 'lucide-react';
import styles from './page.module.css';

interface Question {
  id: number;
  question: string;
  difficulty: string;
  points: number;
  approved: boolean;
  answerCount: number;
}

interface StudentAnswer {
  examId: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  questionIndex: number;
  studentAnswer: string;
  timeSpent: number;
  timestamp: string;
  isCorrect: boolean;
  grade?: number;
  feedback?: string;
  examStartTime: string;
}

interface QuestionWithAnswers {
  question: Question;
  answers: StudentAnswer[];
  totalAnswers: number;
  gradedAnswers: number;
  averageGrade: number;
}

const GradeByQuestionPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard' | 'algebra'>('all');
  const [showGradedOnly, setShowGradedOnly] = useState(false);
  const [grading, setGrading] = useState<{[answerId: string]: boolean}>({});
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
      const response = await fetch('/api/admin/questions-with-answers');
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      const data = await response.json();
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionAnswers = async (questionId: number) => {
    try {
      setQuestionsLoading(true);
      const response = await fetch(`/api/admin/question/${questionId}/answers`);
      if (!response.ok) {
        throw new Error('Failed to fetch question answers');
      }
      const data = await response.json();
      setSelectedQuestion(data);
    } catch (err) {
      console.error('Error fetching question answers:', err);
      setError('Failed to load question answers');
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleGradeAnswer = async (examId: string, questionIndex: number, grade: number, feedback: string) => {
    const answerId = `${examId}-${questionIndex}`;
    try {
      setGrading(prev => ({ ...prev, [answerId]: true }));
      
      const response = await fetch('/api/admin/grade-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examId,
          questionIndex,
          grade,
          feedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save grade');
      }

      // Refresh the current question answers
      if (selectedQuestion) {
        fetchQuestionAnswers(selectedQuestion.question.id);
      }
    } catch (err) {
      console.error('Error saving grade:', err);
      alert('שגיאה בשמירת הציון');
    } finally {
      setGrading(prev => ({ ...prev, [answerId]: false }));
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
      case 'algebra': return 'אלגברה';
      default: return difficulty;
    }
  };

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

  const filteredQuestions = questions
    .filter(question => {
      const matchesSearch = question.question.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDifficulty = difficultyFilter === 'all' || question.difficulty === difficultyFilter;
      return matchesSearch && matchesDifficulty;
    })
    .sort((a, b) => {
      // Sort by answer count (descending), then by question ID (ascending)
      if (b.answerCount !== a.answerCount) {
        return b.answerCount - a.answerCount;
      }
      return a.id - b.id;
    });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>טוען שאלות...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>{error}</div>
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
          חזרה לממשק ניהול
        </button>
        <div className={styles.headerTitle}>
          <BarChart3 size={24} />
          <h1>ציונים לפי שאלה</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.headerInfo}>
            <span>{filteredQuestions.length} שאלות זמינות</span>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        {!selectedQuestion ? (
          /* Questions List View */
          <div className={styles.questionsView}>
            {/* Filters */}
            <div className={styles.filters}>
              <div className={styles.searchContainer}>
                <Search size={20} />
                <input
                  type="text"
                  placeholder="חיפוש בתוכן השאלה..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.difficultyFilter}>
                <Filter size={16} />
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as any)}
                  className={styles.difficultySelect}
                >
                  <option value="all">כל הקשיים</option>
                  <option value="easy">קל</option>
                  <option value="medium">בינוני</option>
                  <option value="hard">קשה</option>
                  <option value="algebra">אלגברה</option>
                </select>
              </div>
            </div>

            {/* Questions Grid */}
            <div className={styles.questionsGrid}>
              {filteredQuestions.map((question) => (
                <div
                  key={question.id}
                  className={styles.questionCard}
                  onClick={() => fetchQuestionAnswers(question.id)}
                >
                  <div className={styles.questionHeader}>
                    <div className={styles.questionId}>
                      שאלה #{question.id}
                      {question.answerCount === 0 && <span className={styles.noAnswersBadge}>אין תשובות</span>}
                    </div>
                    <div 
                      className={styles.difficultyBadge}
                      style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                    >
                      {getDifficultyText(question.difficulty)}
                    </div>
                  </div>
                  
                  <div className={styles.questionContent}>
                    <p className={styles.questionText}>
                      {question.question.length > 150 
                        ? `${question.question.substring(0, 150)}...` 
                        : question.question}
                    </p>
                  </div>
                  
                  <div className={styles.questionFooter}>
                    <div className={styles.questionPoints}>
                      {question.points} נקודות
                    </div>
                    <div className={`${styles.answerCount} ${question.answerCount === 0 ? styles.noAnswers : ''}`}>
                      <Users size={16} />
                      {question.answerCount} תשובות
                    </div>
                    <div className={styles.viewAnswersButton}>
                      <Eye size={16} />
                      צפה בתשובות
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredQuestions.length === 0 && (
              <div className={styles.noQuestions}>
                <FileText size={48} />
                <h3>לא נמצאו שאלות</h3>
                <p>נסה לשנות את הפילטרים או המילות חיפוש</p>
              </div>
            )}
          </div>
        ) : (
          /* Question Answers View */
          <div className={styles.answersView}>
            {questionsLoading ? (
              <div className={styles.loading}>טוען תשובות...</div>
            ) : (
              <>
                {/* Question Details Header */}
                <div className={styles.questionDetailsHeader}>
                  <button
                    onClick={() => setSelectedQuestion(null)}
                    className={styles.backToQuestionsButton}
                  >
                    <ArrowLeft size={16} />
                    חזרה לרשימת שאלות
                  </button>
                  
                  <div className={styles.questionDetails}>
                    <div className={styles.questionTitle}>
                      <span className={styles.questionIdLarge}>שאלה #{selectedQuestion.question.id}</span>
                      <div 
                        className={styles.difficultyBadgeLarge}
                        style={{ backgroundColor: getDifficultyColor(selectedQuestion.question.difficulty) }}
                      >
                        {getDifficultyText(selectedQuestion.question.difficulty)} ({selectedQuestion.question.points} נקודות)
                      </div>
                    </div>
                    
                    <div className={styles.questionTextLarge}>
                      {selectedQuestion.question.question}
                    </div>
                    
                    <div className={styles.answerStats}>
                      <div className={styles.statItem}>
                        <Users size={16} />
                        <span>{selectedQuestion.totalAnswers} תשובות</span>
                      </div>
                      <div className={styles.statItem}>
                        <CheckCircle size={16} />
                        <span>{selectedQuestion.gradedAnswers} בודקו</span>
                      </div>
                      {selectedQuestion.averageGrade > 0 && (
                        <div className={styles.statItem}>
                          <BarChart3 size={16} />
                          <span>ממוצע: {selectedQuestion.averageGrade.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Answers List */}
                <div className={styles.answersContainer}>
                  {selectedQuestion.answers.map((answer, index) => {
                    const answerId = `${answer.examId}-${answer.questionIndex}`;
                    const isGrading = grading[answerId] || false;
                    
                    return (
                      <div key={answerId} className={styles.answerCard}>
                        <div className={styles.answerHeader}>
                          <div className={styles.studentInfo}>
                            <div className={styles.studentName}>
                              {answer.studentName || 'לא צוין'}
                            </div>
                            <div className={styles.studentDetails}>
                              <span>{answer.studentEmail}</span>
                              {answer.studentId && <span>• ID: {answer.studentId}</span>}
                            </div>
                          </div>
                          
                          <div className={styles.answerMeta}>
                            <div className={styles.timeInfo}>
                              <Clock size={14} />
                              <span>זמן: {formatTime(answer.timeSpent)}</span>
                            </div>
                            <div className={styles.dateInfo}>
                              {formatDate(answer.timestamp)}
                            </div>
                            <div className={`${styles.correctnessIndicator} ${answer.isCorrect ? styles.correct : styles.incorrect}`}>
                              {answer.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                              {answer.isCorrect ? 'נכון' : 'שגוי'}
                            </div>
                          </div>
                        </div>
                        
                        <div className={styles.answerContent}>
                          <div className={styles.answerText}>
                            <strong>תשובת הסטודנט:</strong>
                            <pre className={styles.answerQuery}>{answer.studentAnswer}</pre>
                          </div>
                        </div>
                        
                        <div className={styles.gradingSection}>
                          <div className={styles.gradeInputs}>
                            <div className={styles.gradeInput}>
                              <label>ציון:</label>
                              <input
                                type="number"
                                min="0"
                                max={selectedQuestion.question.points}
                                step="0.1"
                                defaultValue={answer.grade || (answer.isCorrect ? selectedQuestion.question.points : 0)}
                                className={styles.gradeField}
                                id={`grade-${answerId}`}
                              />
                              <span>/ {selectedQuestion.question.points}</span>
                            </div>
                            
                            <div className={styles.feedbackInput}>
                              <label>הערות:</label>
                              <textarea
                                defaultValue={answer.feedback || ''}
                                placeholder="הערות על התשובה..."
                                className={styles.feedbackField}
                                rows={2}
                                id={`feedback-${answerId}`}
                              />
                            </div>
                            
                            <button
                              onClick={() => {
                                const gradeInput = document.getElementById(`grade-${answerId}`) as HTMLInputElement;
                                const feedbackInput = document.getElementById(`feedback-${answerId}`) as HTMLTextAreaElement;
                                handleGradeAnswer(
                                  answer.examId,
                                  answer.questionIndex,
                                  parseFloat(gradeInput.value) || 0,
                                  feedbackInput.value
                                );
                              }}
                              disabled={isGrading}
                              className={styles.saveGradeButton}
                            >
                              {isGrading ? 'שומר...' : 'שמור ציון'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedQuestion.answers.length === 0 && (
                  <div className={styles.noAnswers}>
                    <Users size={48} />
                    <h3>אין תשובות לשאלה זו</h3>
                    <p>לא נמצאו תשובות סטודנטים לשאלה זו</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeByQuestionPage; 