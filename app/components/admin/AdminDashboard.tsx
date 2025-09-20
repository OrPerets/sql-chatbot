"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Settings, 
  Users, 
  FileText, 
  Database, 
  BookOpen,
  Bell,
  Mail,
  CheckCircle,
  ArrowUp,
  LogOut,
  User
} from 'lucide-react';
import styles from './AdminDashboard.module.css';

interface AdminDashboardProps {
  currentUser?: string | null;
  onLogout: () => void;
  onTabChange: (tab: string) => void;
}

const dashboardCards = [
  {
    id: 'users',
    title: 'ניהול משתמשים',
    description: 'עריכת משתמשים ומטבעות',
    icon: Users,
    color: 'blue',
    action: 'tab'
  },
  {
    id: 'settings',
    title: 'הגדרות',
    description: 'הגדרות מערכת וקונפיגורציה',
    icon: Settings,
    color: 'purple',
    action: 'tab'
  },
  {
    id: 'dashboard',
    title: 'דשבורד',
    description: 'סקירה כללית ונתונים',
    icon: BarChart3,
    color: 'green',
    action: 'tab'
  }
];

const externalCards = [
  {
    id: 'questions',
    title: 'בנק שאלות',
    description: 'ניהול ועריכת שאלות',
    icon: FileText,
    route: '/homework/questions',
    color: 'orange',
    action: 'route'
  },
  {
    id: 'homework',
    title: 'ניהול שיעורי בית',
    description: 'ניהול מטלות ובחינות',
    icon: BookOpen,
    route: '/admin/homework',
    color: 'red',
    action: 'route'
  },
  {
    id: 'databases',
    title: 'יצירת מסד נתונים',
    description: 'יצירה וניהול מאגרי נתונים',
    icon: Database,
    route: '/admin/databases',
    color: 'cyan',
    action: 'route'
  },
  {
    id: 'mcp-michael',
    title: 'MCP מייקל',
    description: 'ניהול מסד נתונים',
    icon: Database,
    route: '/admin/mcp-michael',
    color: 'indigo',
    action: 'route'
  }
];

const notificationCards = [
  {
    id: 'notifications',
    title: 'התראות',
    description: 'הצגת התראות למצבים',
    icon: Bell,
    color: 'blue',
    badge: '2',
    action: 'tab'
  },
  {
    id: 'messages',
    title: 'שליחת הודעה',
    description: 'שליחת הודעה למצבים',
    icon: Mail,
    color: 'orange',
    action: 'tab'
  }
];

const systemCards = [
  {
    id: 'approvals',
    title: 'אישור צמים',
    description: 'אישור טפסי צמים למצבים',
    icon: CheckCircle,
    color: 'green',
    action: 'tab'
  },
  {
    id: 'grades',
    title: 'טבלת קורסים',
    description: 'סקירה ועריכת ציון התמחות/סטז קורסי',
    icon: ArrowUp,
    color: 'red',
    action: 'tab'
  },
  {
    id: 'course-management',
    title: 'ניהול מרצים וקורסים',
    description: 'ניהול מרצים והוספת קורסים',
    icon: Settings,
    color: 'purple',
    action: 'tab'
  }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onLogout,
  onTabChange
}) => {
  const router = useRouter();

  const handleCardClick = (card: any) => {
    if (card.action === 'route' && card.route) {
      router.push(card.route);
    } else if (card.action === 'tab') {
      onTabChange(card.id);
    }
  };

  const renderCard = (card: any, index: number) => {
    const Icon = card.icon;
    
    return (
      <div
        key={card.id}
        className={`${styles.card} ${styles[`card${card.color}`]}`}
        onClick={() => handleCardClick(card)}
      >
        {card.badge && (
          <div className={styles.badge}>
            {card.badge}
          </div>
        )}
        
        <div className={styles.cardIcon}>
          <Icon size={24} />
        </div>
        
        <div className={styles.cardContent}>
          <h3 className={styles.cardTitle}>{card.title}</h3>
          <p className={styles.cardDescription}>{card.description}</p>
        </div>
        
        <div className={styles.cardAction}>
          <span className={styles.actionText}>לחץ לפתיחה</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.userInfo}>
              <div className={styles.userIcon}>
                <User size={20} />
              </div>
              <div className={styles.userText}>
                <span className={styles.greeting}>שלום, {currentUser || 'אור כהן'}</span>
                <span className={styles.subtitle}>כלי ניהול מרכזיים למערכת הטלמטריה</span>
              </div>
            </div>
          </div>
          
          <div className={styles.headerRight}>
            <div className={styles.dateTime}>
              <div className={styles.date}>20 בספטמבר 2025</div>
              <div className={styles.time}>13:24</div>
            </div>
            <button onClick={onLogout} className={styles.logoutButton}>
              <LogOut size={18} />
              ניתוק
            </button>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className={styles.titleSection}>
        <h1 className={styles.mainTitle}>אזור ניהול</h1>
      </div>

      {/* Main Dashboard Cards */}
      <div className={styles.section}>
        <div className={styles.cardsGrid}>
          {dashboardCards.map((card, index) => renderCard(card, index))}
        </div>
      </div>

      {/* Communications Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>תקשורת</h2>
          <span className={styles.sectionSubtitle}>ניהול שליחת הודעות למצבים במערכת</span>
        </div>
        <div className={styles.cardsGrid}>
          {notificationCards.map((card, index) => renderCard(card, index))}
        </div>
      </div>

      {/* System Management Section */}
      {/* <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>ניהול מערכת</h2>
          <span className={styles.sectionSubtitle}>ניהול שליחת הודעות למצבים במערכת</span>
        </div>
        <div className={styles.cardsGrid}>
          {systemCards.map((card, index) => renderCard(card, index))}
        </div>
      </div> */}

      {/* External Tools Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>כלים נוספים</h2>
          <span className={styles.sectionSubtitle}>כלי ניהול מרכזיים למערכת הטלמטריה</span>
        </div>
        <div className={styles.cardsGrid}>
          {externalCards.map((card, index) => renderCard(card, index))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
