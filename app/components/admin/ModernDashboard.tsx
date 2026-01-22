"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Database, 
  Activity,
  Plus,
  BarChart3,
  Target,
  Award,
  Clock,
  CheckCircle
} from 'lucide-react';
import ModernStatsCard from './ModernStatsCard';
import ErrorBanner from './ErrorBanner';
import styles from './ModernDashboard.module.css';

interface ModernDashboardProps {
  users: any[];
  loading: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onNavigate: (tab: string) => void;
}


const ModernDashboard: React.FC<ModernDashboardProps> = ({
  users,
  loading,
  onSuccess,
  onError,
  onNavigate
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboardStats, setDashboardStats] = useState({
    activeUsers: 0
  });

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Calculate dashboard statistics
  useEffect(() => {
    const activeUsers = users.filter(user => 
      user.lastActivity && 
      new Date(user.lastActivity) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    setDashboardStats(prev => ({
      ...prev,
      activeUsers: activeUsers || users.length
    }));
  }, [users]);


  const formatTime = (date: Date) => {
    return date.toLocaleString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mock sparkline data for demonstration
  const generateSparklineData = (trend: 'up' | 'down' | 'stable') => {
    const baseData = [65, 68, 70, 73, 71, 76, 78, 82, 84, 86];
    switch (trend) {
      case 'up':
        return baseData.map((val, idx) => val + idx * 2);
      case 'down':
        return baseData.map((val, idx) => val - idx * 1.5);
      default:
        return baseData;
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Welcome Section */}
      <div className={styles.welcomeSection}>
        <div className={styles.welcomeContent}>
          <div className={styles.welcomeText}>
            <h1 className={styles.welcomeTitle}>
              ברוכים הבאים למערכת הניהול
            </h1>
            <p className={styles.welcomeSubtitle}>
              סקירה כוללת של המערכת, נתונים עדכניים ופעילות משתמשים
            </p>
            <div className={styles.lastUpdated}>
              עדכון אחרון: {formatTime(currentTime)}
            </div>
          </div>
          
          <div className={styles.welcomeActions}>
            <button 
              className={styles.actionButton}
              onClick={() => onNavigate('users')}
            >
              <Plus size={18} />
              <span> ניהול משתמשים </span>
            </button>
            
            <button 
              className={styles.actionButtonSecondary}
              onClick={() => onNavigate('settings')}
            >
              <BarChart3 size={18} />
              <span>דוחות מתקדמים</span>
            </button>
          </div>
        </div>
      </div>


    
  
      {/* System Tools Section */}
      <div className={styles.quickActionsSection}>
        <h3 className={styles.sectionTitle}>🔧 כלי מערכת</h3>
        <p className={styles.sectionDescription}>
          כלים מתקדמים לניהול המערכת, ניטור ביצועים ותחזוקה
        </p>
        
        <div className={styles.quickActionsGrid}>
          <div 
            className={styles.quickAction}
            onClick={() => onNavigate('users')}
          >
            <div className={styles.quickActionIcon}>
              <Users size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>👥 ניהול משתמשים</h4>
              <p>הוסף משתמשים, עדכן הרשאות וניהול מטבעות</p>
              <span className={styles.actionBadge}>חיוני</span>
            </div>
          </div>

          <div 
            className={styles.quickAction}
            onClick={() => onNavigate('settings')}
          >
            <div className={styles.quickActionIcon}>
              <Activity size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>⚙️ הגדרות מערכת</h4>
              <p>הגדרות מייקל AI, מטבעות וירטואליים וזמני בחינה</p>
              <span className={styles.actionBadge}>מערכת</span>
            </div>
          </div>

          <div 
            className={styles.quickAction}
            onClick={() => window.open('/admin/datasets', '_blank')}
          >
            <div className={styles.quickActionIcon}>
              <Database size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>📊 ניהול נתונים</h4>
              <p>הרחב מסדי נתונים, צור נתונים חדשים ובדוק תקינות</p>
              <span className={styles.actionBadge}>נתונים</span>
            </div>
          </div>

          <div 
            className={styles.quickAction}
            onClick={() => window.open('/admin/templates', '_blank')}
          >
            <div className={styles.quickActionIcon}>
              <BookOpen size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>📝 תבניות שאלות</h4>
              <p>צור שאלות דינמיות עם משתנים לכל תלמיד</p>
              <span className={styles.actionBadge}>חדש</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ModernDashboard;
