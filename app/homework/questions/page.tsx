"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Filter, BookOpen, Edit3, Trash2, Copy, AlertCircle, X, Database } from "lucide-react";
import { useHomeworkLocale } from "../context/HomeworkLocaleProvider";
import styles from "./questions.module.css";

interface Question {
  id: string;
  prompt: string;
  instructions: string;
  starterSql?: string;
  expectedResultSchema: Array<{ column: string; type: string }>;
  gradingRubric: any[];
  datasetId?: string;
  maxAttempts: number;
  points: number;
  evaluationMode?: "auto" | "manual" | "custom";
  createdAt?: string;
  updatedAt?: string;
}

interface Dataset {
  id: string;
  name: string;
  description: string;
}

interface CreateQuestionForm {
  prompt: string;
  instructions: string;
  starterSql: string;
  expectedAnswer: string;
  points: number;
  maxAttempts: number;
  evaluationMode: "auto" | "manual" | "custom";
  datasetId: string;
}

const difficulties = ["הכל", "קל", "בינוני", "מתקדם"];
const categories = ["הכל", "בחירה בסיסית", "פונקציות צבירה", "JOIN", "תת-שאילתות", "פונקציות חלון"];

export default function QuestionsPage() {
  const { t, direction } = useHomeworkLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("הכל");
  const [selectedCategory, setSelectedCategory] = useState("הכל");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([]);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [createForm, setCreateForm] = useState<CreateQuestionForm>({
    prompt: '',
    instructions: '',
    starterSql: '',
    expectedAnswer: '',
    points: 10,
    maxAttempts: 3,
    evaluationMode: 'auto',
    datasetId: ''
  });

  // Load questions from database
  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get all homework sets first
        const homeworkResponse = await fetch('/api/homework');
        if (!homeworkResponse.ok) {
          throw new Error('Failed to load homework sets');
        }
        const homeworkData = await homeworkResponse.json();
        
        // Get questions from all homework sets
        const allQuestions: Question[] = [];
        for (const homeworkSet of homeworkData.items || []) {
          try {
            const questionsResponse = await fetch(`/api/homework/${homeworkSet.id}/questions`);
            if (questionsResponse.ok) {
              const questionsData = await questionsResponse.json();
              allQuestions.push(...questionsData);
            }
          } catch (error) {
            console.error(`Error loading questions for homework set ${homeworkSet.id}:`, error);
          }
        }
        
        setQuestions(allQuestions);
      } catch (error) {
        console.error('Error loading questions:', error);
        setError('שגיאה בטעינת השאלות');
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את השאלה?')) {
      return;
    }

    try {
      // Find which homework set this question belongs to
      let homeworkSetId = null;
      for (const homeworkSet of questions) {
        // We need to find the homework set ID for this question
        // For now, we'll try to delete from all homework sets
        // This is not ideal, but we need to modify the API to support question deletion by ID
      }
      
      // For now, show an alert that this feature needs to be implemented properly
      alert('פונקציונליות מחיקת שאלות תהיה זמינה בקרוב. נדרש שיפור במבנה הנתונים.');
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('שגיאה במחיקת השאלה');
    }
  };

  const handleEditQuestion = (questionId: string) => {
    // For now, just show an alert - you can implement edit functionality later
    alert('פונקציונליות עריכת שאלות תהיה זמינה בקרוב');
  };

  const handleCopyQuestion = (questionId: string) => {
    // For now, just show an alert - you can implement copy functionality later
    alert('פונקציונליות העתקת שאלות תהיה זמינה בקרוב');
  };

  const handleCreateQuestionClick = async () => {
    setShowCreateModal(true);
    setIsLoadingDatasets(true);
    
    try {
      const response = await fetch('/api/datasets');
      if (response.ok) {
        const data = await response.json();
        setAvailableDatasets(data.items || []);
      } else {
        console.error('Failed to load datasets');
        setAvailableDatasets([]);
      }
    } catch (error) {
      console.error('Error loading datasets:', error);
      setAvailableDatasets([]);
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingQuestion(true);

    try {
      // First, create a new homework set for this question
      const homeworkResponse = await fetch('/api/homework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `שאלה חדשה - ${createForm.prompt.substring(0, 50)}...`,
          description: 'שאלה שנוצרה מבנק השאלות',
          courseId: 'general',
          published: false,
          datasetPolicy: 'shared',
          questionOrder: [],
          visibility: 'draft',
          createdBy: 'admin',
          overview: 'שאלה שנוצרה מבנק השאלות'
        }),
      });

      if (!homeworkResponse.ok) {
        throw new Error('Failed to create homework set');
      }

      const homeworkSet = await homeworkResponse.json();

      // Then create the question in this homework set
      const questionResponse = await fetch(`/api/homework/${homeworkSet.id}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: createForm.prompt,
          instructions: createForm.instructions,
          starterSql: createForm.starterSql,
          expectedResultSchema: [], // We'll store the expected answer in instructions for now
          gradingRubric: [],
          datasetId: createForm.datasetId,
          maxAttempts: createForm.maxAttempts,
          points: createForm.points,
          evaluationMode: createForm.evaluationMode
        }),
      });

      if (!questionResponse.ok) {
        throw new Error('Failed to create question');
      }

      alert('השאלה נוצרה בהצלחה!');
      setShowCreateModal(false);
      setCreateForm({
        prompt: '',
        instructions: '',
        starterSql: '',
        expectedAnswer: '',
        points: 10,
        maxAttempts: 3,
        evaluationMode: 'auto',
        datasetId: ''
      });
      
      // Reload questions
      window.location.reload();
    } catch (error) {
      console.error('Error creating question:', error);
      alert('שגיאה ביצירת השאלה');
    } finally {
      setIsCreatingQuestion(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setCreateForm({
      prompt: '',
      instructions: '',
      starterSql: '',
      expectedAnswer: '',
      points: 10,
      maxAttempts: 3,
      evaluationMode: 'auto',
      datasetId: ''
    });
  };

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.instructions.toLowerCase().includes(searchTerm.toLowerCase());
    
    // For now, we'll show all questions since we don't have difficulty/category fields in the database
    // You can add these fields later if needed
    return matchesSearch;
  });

  return (
    <div className={styles.container} dir={direction}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleIcon}>
            <BookOpen size={32} />
          </div>
          <div>
            <h1 className={styles.title}>{t("layout.questions.title")}</h1>
            <p className={styles.subtitle}>{t("layout.questions.description")}</p>
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <button 
            className={styles.createButton}
            onClick={handleCreateQuestionClick}
          >
            <Plus size={20} />
            יצירת שאלה חדשה
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{questions.length}</div>
          <div className={styles.statLabel}>סה״כ שאלות</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {questions.reduce((sum, q) => sum + q.usageCount, 0)}
          </div>
          <div className={styles.statLabel}>שימושים במטלות</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{categories.length - 1}</div>
          <div className={styles.statLabel}>קטגוריות</div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <Search size={20} />
          <input
            type="text"
            placeholder="חיפוש שאלות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <span>רמת קושי:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className={styles.filterSelect}
            >
              {difficulties.map(diff => (
                <option key={diff} value={diff}>{diff}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <span>קטגוריה:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.filterSelect}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>טוען שאלות...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.errorState}>
          <AlertCircle size={48} />
          <h3>שגיאה בטעינת השאלות</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Questions List */}
      {!isLoading && !error && (
        <div className={styles.questionsGrid}>
          {filteredQuestions.map((question) => (
            <div key={question.id} className={styles.questionCard}>
              <div className={styles.questionHeader}>
                <div className={styles.questionMeta}>
                  <span className={`${styles.difficultyBadge} ${styles[question.evaluationMode || 'auto']}`}>
                    {question.evaluationMode === 'auto' ? 'אוטומטי' : 
                     question.evaluationMode === 'manual' ? 'ידני' : 'מותאם אישית'}
                  </span>
                  <span className={styles.categoryBadge}>{question.points} נקודות</span>
                </div>
                <div className={styles.questionActions}>
                  <button 
                    className={styles.actionButton} 
                    title="עריכה"
                    onClick={() => handleEditQuestion(question.id)}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    className={styles.actionButton} 
                    title="שכפול"
                    onClick={() => handleCopyQuestion(question.id)}
                  >
                    <Copy size={16} />
                  </button>
                  <button 
                    className={styles.actionButton} 
                    title="מחיקה"
                    onClick={() => handleDeleteQuestion(question.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className={styles.questionPrompt}>{question.prompt}</h3>
              <p className={styles.questionInstructions}>{question.instructions}</p>

              {question.starterSql && (
                <div className={styles.sqlPreview}>
                  <div className={styles.sqlLabel}>קוד SQL התחלתי:</div>
                  <pre className={styles.sqlCode}>{question.starterSql}</pre>
                </div>
              )}

              <div className={styles.questionFooter}>
                <div className={styles.tags}>
                  <span className={styles.tag}>מקסימום ניסיונות: {question.maxAttempts}</span>
                  {question.datasetId && (
                    <span className={styles.tag}>מסד נתונים: {question.datasetId}</span>
                  )}
                </div>
                <div className={styles.usageInfo}>
                  {question.createdAt && (
                    <span>נוצר: {new Date(question.createdAt).toLocaleDateString('he-IL')}</span>
                  )}
                  {question.updatedAt && (
                    <span>עודכן: {new Date(question.updatedAt).toLocaleDateString('he-IL')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredQuestions.length === 0 && (
        <div className={styles.emptyState}>
          <BookOpen size={48} />
          <h3>לא נמצאו שאלות</h3>
          <p>נסו לשנות את מסנני החיפוש או ליצור שאלה חדשה</p>
          <button 
            className={styles.createButton}
            onClick={handleCreateQuestionClick}
          >
            <Plus size={20} />
            יצירת שאלה ראשונה
          </button>
        </div>
      )}

      {/* Create Question Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>יצירת שאלה חדשה</h2>
              <button 
                className={styles.closeButton}
                onClick={handleCloseModal}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label htmlFor="datasetId">בחר מסד נתונים *</label>
                {isLoadingDatasets ? (
                  <div className={styles.loadingMessage}>טוען מסדי נתונים...</div>
                ) : (
                  <select
                    id="datasetId"
                    value={createForm.datasetId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, datasetId: e.target.value }))}
                    required
                    className={styles.formSelect}
                  >
                    <option value="">בחר מסד נתונים</option>
                    {availableDatasets.map(dataset => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name} - {dataset.description}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="prompt">שאלה *</label>
                <textarea
                  id="prompt"
                  value={createForm.prompt}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="כתבו את השאלה כאן..."
                  required
                  rows={3}
                  className={styles.formTextarea}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="instructions">הוראות לסטודנט</label>
                <textarea
                  id="instructions"
                  value={createForm.instructions}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="הוראות נוספות לסטודנט..."
                  rows={2}
                  className={styles.formTextarea}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="starterSql">קוד SQL התחלתי</label>
                <textarea
                  id="starterSql"
                  value={createForm.starterSql}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, starterSql: e.target.value }))}
                  placeholder="SELECT * FROM ..."
                  rows={3}
                  className={styles.formTextarea}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="expectedAnswer">תשובה נכונה *</label>
                <textarea
                  id="expectedAnswer"
                  value={createForm.expectedAnswer}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, expectedAnswer: e.target.value }))}
                  placeholder="הקוד SQL הנכון..."
                  required
                  rows={3}
                  className={styles.formTextarea}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="points">נקודות *</label>
                  <input
                    id="points"
                    type="number"
                    min="1"
                    max="100"
                    value={createForm.points}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, points: parseInt(e.target.value) || 10 }))}
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="maxAttempts">מקסימום ניסיונות</label>
                  <input
                    id="maxAttempts"
                    type="number"
                    min="1"
                    max="10"
                    value={createForm.maxAttempts}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 3 }))}
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="evaluationMode">מצב הערכה</label>
                <select
                  id="evaluationMode"
                  value={createForm.evaluationMode}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, evaluationMode: e.target.value as "auto" | "manual" | "custom" }))}
                  className={styles.formSelect}
                >
                  <option value="auto">אוטומטי</option>
                  <option value="manual">ידני</option>
                  <option value="custom">מותאם אישית</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles.cancelButton}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuestion || !createForm.datasetId || !createForm.prompt || !createForm.expectedAnswer}
                  className={styles.submitButton}
                >
                  {isCreatingQuestion ? 'יוצר...' : 'צור שאלה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
