"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Save, Check, AlertCircle, Settings, RefreshCw } from 'lucide-react';
import styles from './McpMichaelPage.module.css';

interface WeeklyContent {
  week: number;
  content: string;
  dateRange: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface SemesterConfig {
  startDate: string;
}

const McpMichaelPage: React.FC = () => {
  const [weeklyContent, setWeeklyContent] = useState<WeeklyContent[]>([]);
  const [semesterStart, setSemesterStart] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<{ [week: number]: boolean }>({});
  const [saveStatus, setSaveStatus] = useState<{ [week: number]: 'success' | 'error' | null }>({});
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Initialize 14 weeks of content
  const initializeWeeklyContent = () => {
    const weeks: WeeklyContent[] = [];
    for (let i = 1; i <= 14; i++) {
      weeks.push({
        week: i,
        content: '',
        dateRange: '',
        updatedAt: '',
        updatedBy: ''
      });
    }
    return weeks;
  };

  // Calculate date range for a given week
  const calculateDateRange = (week: number, startDate: string): string => {
    if (!startDate) return '';
    
    const start = new Date(startDate);
    const weekStart = new Date(start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    return `${weekStart.toLocaleDateString('he-IL')} - ${weekEnd.toLocaleDateString('he-IL')}`;
  };

  // Calculate current week based on semester start date
  const calculateCurrentWeek = (startDate: string): number => {
    if (!startDate) return 1;
    
    const start = new Date(startDate);
    const now = new Date();
    const weekNumber = Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    return Math.max(1, Math.min(14, weekNumber));
  };

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Update date ranges when semester start date changes
  useEffect(() => {
    if (semesterStart) {
      const updatedContent = weeklyContent.map(week => ({
        ...week,
        dateRange: calculateDateRange(week.week, semesterStart)
      }));
      setWeeklyContent(updatedContent);
      setCurrentWeek(calculateCurrentWeek(semesterStart));
    }
  }, [semesterStart]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load semester start date
      const semesterResponse = await fetch('/api/mcp-michael/semester-start');
      if (semesterResponse.ok) {
        const semesterData = await semesterResponse.json();
        if (semesterData.startDate) {
          setSemesterStart(semesterData.startDate);
        } else {
          // Set default semester start (8 weeks ago)
          const defaultStart = new Date();
          defaultStart.setDate(defaultStart.getDate() - (8 * 7));
          setSemesterStart(defaultStart.toISOString().split('T')[0]);
        }
      }

      // Load weekly content
      const contentResponse = await fetch('/api/mcp-michael');
      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        
        // Initialize with empty weeks if no data exists
        const initializedContent = initializeWeeklyContent();
        
        // Merge with existing data
        contentData.forEach((existingWeek: WeeklyContent) => {
          const index = existingWeek.week - 1;
          if (index >= 0 && index < 14) {
            initializedContent[index] = existingWeek;
          }
        });
        
        setWeeklyContent(initializedContent);
      } else {
        // Initialize with empty content if API fails
        setWeeklyContent(initializeWeeklyContent());
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('שגיאה בטעינת הנתונים');
      setWeeklyContent(initializeWeeklyContent());
    } finally {
      setLoading(false);
    }
  };

  const saveSemesterStart = async (newStartDate: string) => {
    try {
      const response = await fetch('/api/mcp-michael/semester-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startDate: newStartDate }),
      });

      if (response.ok) {
        setSemesterStart(newStartDate);
        setSuccessMessage('תאריך התחלת הסמסטר נשמר בהצלחה');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('Failed to save semester start date');
      }
    } catch (err) {
      console.error('Error saving semester start date:', err);
      setError('שגיאה בשמירת תאריך התחלת הסמסטר');
    }
  };

  const saveWeeklyContent = async (week: number, content: string) => {
    try {
      setSaving(prev => ({ ...prev, [week]: true }));
      setSaveStatus(prev => ({ ...prev, [week]: null }));

      const weekData = {
        week,
        content,
        dateRange: calculateDateRange(week, semesterStart),
        updatedBy: 'admin'
      };

      const response = await fetch('/api/mcp-michael', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(weekData),
      });

      if (response.ok) {
        // Update local state
        setWeeklyContent(prev => prev.map(w => 
          w.week === week 
            ? { ...w, content, updatedAt: new Date().toISOString(), updatedBy: 'admin' }
            : w
        ));
        
        setSaveStatus(prev => ({ ...prev, [week]: 'success' }));
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [week]: null }));
        }, 2000);
      } else {
        throw new Error('Failed to save weekly content');
      }
    } catch (err) {
      console.error('Error saving weekly content:', err);
      setSaveStatus(prev => ({ ...prev, [week]: 'error' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [week]: null }));
      }, 3000);
    } finally {
      setSaving(prev => ({ ...prev, [week]: false }));
    }
  };

  const handleContentChange = (week: number, content: string) => {
    setWeeklyContent(prev => prev.map(w => 
      w.week === week ? { ...w, content } : w
    ));
  };

  const handleSemesterStartChange = (newStartDate: string) => {
    setSemesterStart(newStartDate);
    saveSemesterStart(newStartDate);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.spinner} />
        <p>טוען נתונים...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>ניהול תוכן שבועי - MCP מייקל</h1>
        <p className={styles.subtitle}>הגדרת תוכן לפי שבועות לשיפור תגובות המערכת</p>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          <Check size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className={styles.semesterSection}>
        <div className={styles.semesterHeader}>
          <Settings size={20} />
          <h3>הגדרות סמסטר</h3>
        </div>
        <div className={styles.semesterControls}>
          <label htmlFor="semesterStart" className={styles.label}>
            תאריך התחלת הסמסטר:
          </label>
          <input
            id="semesterStart"
            type="date"
            value={semesterStart}
            onChange={(e) => handleSemesterStartChange(e.target.value)}
            className={styles.dateInput}
          />
          <span className={styles.currentWeekIndicator}>
            שבוע נוכחי: {currentWeek}
          </span>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.weeklyTable}>
          <thead>
            <tr>
              <th>שבוע</th>
              <th>תאריכים</th>
              <th>תוכן</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {weeklyContent.map((week) => (
              <tr 
                key={week.week} 
                className={`${styles.tableRow} ${week.week === currentWeek ? styles.currentWeek : ''}`}
              >
                <td className={styles.weekCell}>
                  <span className={styles.weekNumber}>{week.week}</span>
                  {week.week === currentWeek && (
                    <span className={styles.currentBadge}>נוכחי</span>
                  )}
                </td>
                <td className={styles.dateCell}>
                  <div className={styles.dateRange}>
                    <Calendar size={16} />
                    <span>{week.dateRange || 'לא זמין'}</span>
                  </div>
                </td>
                <td className={styles.contentCell}>
                  <textarea
                    value={week.content}
                    onChange={(e) => handleContentChange(week.week, e.target.value)}
                    placeholder={`תוכן לשבוע ${week.week}...`}
                    className={styles.contentTextarea}
                    rows={3}
                  />
                </td>
                <td className={styles.actionsCell}>
                  <button
                    onClick={() => saveWeeklyContent(week.week, week.content)}
                    disabled={saving[week.week]}
                    className={styles.saveButton}
                  >
                    {saving[week.week] ? (
                      <RefreshCw size={16} className={styles.spinner} />
                    ) : (
                      <Save size={16} />
                    )}
                    {saving[week.week] ? 'שומר...' : 'שמור'}
                  </button>
                  
                  {saveStatus[week.week] === 'success' && (
                    <div className={styles.successIndicator}>
                      <Check size={16} />
                    </div>
                  )}
                  
                  {saveStatus[week.week] === 'error' && (
                    <div className={styles.errorIndicator}>
                      <AlertCircle size={16} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          המערכת תשתמש בתוכן השבוע הנוכחי כדי לשפר את התגובות של המייקל
        </p>
      </div>
    </div>
  );
};

export default McpMichaelPage;
