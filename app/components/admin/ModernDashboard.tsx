"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Database, 
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Calendar,
  BarChart3,
  Target,
  Award,
  Zap
} from 'lucide-react';
import ModernStatsCard from './ModernStatsCard';
import MissingAnswersAudit from './MissingAnswersAudit';
import ErrorBanner from './ErrorBanner';
import styles from './ModernDashboard.module.css';

interface ModernDashboardProps {
  users: any[];
  loading: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onNavigate: (tab: string) => void;
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

const mockSystemAlerts: SystemAlert[] = [
  {
    id: '1',
    type: 'success',
    title: 'ממשק אדמין חדש',
    message: '',
    timestamp: '10:30',
    isRead: false
  },
];

const ModernDashboard: React.FC<ModernDashboardProps> = ({
  users,
  loading,
  onSuccess,
  onError,
  onNavigate
}) => {
  const [systemAlerts, setSystemAlerts] = useState(mockSystemAlerts);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboardStats, setDashboardStats] = useState({
    activeUsers: 0,
    completedExercises: 0,
    systemUptime: '99.9%',
    avgResponseTime: '1.2s'
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

  const dismissAlert = (alertId: string) => {
    setSystemAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  };

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
              <span>הוסף משתמש</span>
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

      {/* System Alerts */}
      {systemAlerts.filter(alert => !alert.isRead).length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsHeader}>
            <h3>התראות מערכת</h3>
            <span className={styles.alertsCount}>
              {systemAlerts.filter(alert => !alert.isRead).length} חדשות
            </span>
          </div>
          
          <div className={styles.alertsList}>
            {systemAlerts.filter(alert => !alert.isRead).map(alert => (
              <div key={alert.id} className={`${styles.alert} ${styles[`alert${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}`]}`}>
                <div className={styles.alertIcon}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className={styles.alertContent}>
                  <h4 className={styles.alertTitle}>{alert.title}</h4>
                  <p className={styles.alertMessage}>{alert.message}</p>
                </div>
                <div className={styles.alertMeta}>
                  <span className={styles.alertTime}>{alert.timestamp}</span>
                  <button 
                    className={styles.alertDismiss}
                    onClick={() => dismissAlert(alert.id)}
                    title="הסתר התראה"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main KPI Cards */}
      <div className={styles.statsGrid}>
        <ModernStatsCard
          icon={Users}
          title="משתמשים פעילים"
          value={dashboardStats.activeUsers}
          description="משתמשים פעילים ב-24 שעות האחרונות"
          trend={{
            value: 12,
            label: "השבוע האחרון",
            direction: "up"
          }}
          color="primary"
          onClick={() => onNavigate('users')}
          loading={loading}
          sparklineData={generateSparklineData('up')}
        />

        <ModernStatsCard
          icon={BookOpen}
          title="תרגילים הושלמו"
          value={dashboardStats.completedExercises}
          description="תרגילי SQL שהושלמו היום"
          trend={{
            value: 8,
            label: "מאתמול",
            direction: "up"
          }}
          color="success"
          onClick={() => console.log('Navigate to exercises')}
          loading={loading}
          sparklineData={generateSparklineData('up')}
        />

        <ModernStatsCard
          icon={Activity}
          title="זמינות המערכת"
          value={dashboardStats.systemUptime}
          description="זמינות השרת ב-30 הימים האחרונים"
          trend={{
            value: 0.1,
            label: "מהחודש הקודם",
            direction: "up"
          }}
          color="info"
          loading={loading}
          sparklineData={generateSparklineData('stable')}
        />

        <ModernStatsCard
          icon={Zap}
          title="זמן תגובה"
          value={dashboardStats.avgResponseTime}
          description="זמן תגובה ממוצע של השרת"
          trend={{
            value: 5,
            label: "מהשבוע הקודם",
            direction: "down"
          }}
          color="warning"
          loading={loading}
          sparklineData={generateSparklineData('down')}
          badge="!חשוב"
        />
      </div>

      {/* Secondary Stats */}
      <div className={styles.secondaryStats}>
        <div className={styles.statItem}>
          <Target size={20} className={styles.statIcon} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>94%</span>
            <span className={styles.statLabel}>שביעות רצון</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <Award size={20} className={styles.statIcon} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>156</span>
            <span className={styles.statLabel}>תעודות הוענקו</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <Clock size={20} className={styles.statIcon} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>2.3h</span>
            <span className={styles.statLabel}>זמן ממוצע בפלטפורמה</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <CheckCircle size={20} className={styles.statIcon} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>89%</span>
            <span className={styles.statLabel}>שיעור הצלחה</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className={styles.quickActionsSection}>
        <h3 className={styles.sectionTitle}>פעולות מהירות</h3>
        
        <div className={styles.quickActionsGrid}>
          <div 
            className={styles.quickAction}
            onClick={() => onNavigate('users')}
          >
            <div className={styles.quickActionIcon}>
              <Users size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>ניהול משתמשים</h4>
              <p>הוסף, ערוך או הסר משתמשים</p>
            </div>
          </div>

          <div 
            className={styles.quickAction}
            onClick={() => window.open('/admin/homework', '_blank')}
          >
            <div className={styles.quickActionIcon}>
              <BookOpen size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>מטלות ובחינות</h4>
              <p>צור ונהל מטלות חדשות</p>
            </div>
          </div>

          <div 
            className={styles.quickAction}
            onClick={() => window.open('/admin/databases', '_blank')}
          >
            <div className={styles.quickActionIcon}>
              <Database size={24} />
            </div>
            <div className={styles.quickActionContent}>
              <h4>מסדי נתונים</h4>
              <p>צור מסדי נתונים חדשים</p>
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
              <h4>הגדרות מערכת</h4>
              <p>קנה הגדרות ותצורות</p>
            </div>
          </div>
        </div>
      </div>

      {/* Missing Answers Audit Component */}
      <div className={styles.auditSection}>
        <MissingAnswersAudit
          onSuccess={onSuccess}
          onError={onError}
        />
      </div>
    </div>
  );
};

export default ModernDashboard;
