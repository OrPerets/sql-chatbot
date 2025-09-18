"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, BookOpen, Edit3, Trash2, Copy } from "lucide-react";
import { useHomeworkLocale } from "../context/HomeworkLocaleProvider";
import styles from "./questions.module.css";

// Mock data for demonstration
const mockQuestions = [
  {
    id: "q1",
    prompt: "כתבו שאילתה לבחירת כל הלקוחות מטבלת customers",
    instructions: "השתמשו ב-SELECT * FROM customers",
    difficulty: "קל",
    category: "בחירה בסיסית",
    starterSql: "SELECT * FROM customers;",
    tags: ["SELECT", "בסיסי"],
    createdAt: "2024-01-15",
    usageCount: 12,
  },
  {
    id: "q2", 
    prompt: "מצאו את ממוצע המחירים של כל המוצרים",
    instructions: "השתמשו בפונקציית AVG",
    difficulty: "בינוני",
    category: "פונקציות צבירה",
    starterSql: "SELECT AVG(price) FROM products;",
    tags: ["AVG", "פונקציות צבירה"],
    createdAt: "2024-01-20",
    usageCount: 8,
  },
  {
    id: "q3",
    prompt: "צרו שאילתה עם JOIN בין לקוחות והזמנות",
    instructions: "חברו בין טבלת customers ו-orders",
    difficulty: "מתקדם",
    category: "JOIN",
    starterSql: "SELECT c.name, o.order_date FROM customers c JOIN orders o ON c.id = o.customer_id;",
    tags: ["JOIN", "מתקדם"],
    createdAt: "2024-01-25",
    usageCount: 15,
  },
];

const difficulties = ["הכל", "קל", "בינוני", "מתקדם"];
const categories = ["הכל", "בחירה בסיסית", "פונקציות צבירה", "JOIN", "תת-שאילתות", "פונקציות חלון"];

export default function QuestionsPage() {
  const { t, direction } = useHomeworkLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("הכל");
  const [selectedCategory, setSelectedCategory] = useState("הכל");
  const [questions] = useState(mockQuestions);

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.instructions.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty = selectedDifficulty === "הכל" || question.difficulty === selectedDifficulty;
    const matchesCategory = selectedCategory === "הכל" || question.category === selectedCategory;
    
    return matchesSearch && matchesDifficulty && matchesCategory;
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
          <button className={styles.createButton}>
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

      {/* Questions List */}
      <div className={styles.questionsGrid}>
        {filteredQuestions.map((question) => (
          <div key={question.id} className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <div className={styles.questionMeta}>
                <span className={`${styles.difficultyBadge} ${styles[question.difficulty.toLowerCase()]}`}>
                  {question.difficulty}
                </span>
                <span className={styles.categoryBadge}>{question.category}</span>
              </div>
              <div className={styles.questionActions}>
                <button className={styles.actionButton} title="עריכה">
                  <Edit3 size={16} />
                </button>
                <button className={styles.actionButton} title="שכפול">
                  <Copy size={16} />
                </button>
                <button className={styles.actionButton} title="מחיקה">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className={styles.questionPrompt}>{question.prompt}</h3>
            <p className={styles.questionInstructions}>{question.instructions}</p>

            <div className={styles.sqlPreview}>
              <div className={styles.sqlLabel}>קוד SQL התחלתי:</div>
              <pre className={styles.sqlCode}>{question.starterSql}</pre>
            </div>

            <div className={styles.questionFooter}>
              <div className={styles.tags}>
                {question.tags.map(tag => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
              <div className={styles.usageInfo}>
                <span>נוצר: {question.createdAt}</span>
                <span>שימושים: {question.usageCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className={styles.emptyState}>
          <BookOpen size={48} />
          <h3>לא נמצאו שאלות</h3>
          <p>נסו לשנות את מסנני החיפוש או ליצור שאלה חדשה</p>
          <button className={styles.createButton}>
            <Plus size={20} />
            יצירת שאלה ראשונה
          </button>
        </div>
      )}
    </div>
  );
}
