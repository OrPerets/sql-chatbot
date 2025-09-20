"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Settings, 
  Users, 
  FileText, 
  Database, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: string | null;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navigationItems = [
  {
    id: 'dashboard',
    label: 'דשבורד',
    icon: BarChart3,
    description: 'סקירה כללית ונתונים'
  },
  {
    id: 'settings',
    label: 'הגדרות',
    icon: Settings,
    description: 'הגדרות מערכת וקונפיגורציה'
  },
  {
    id: 'users',
    label: 'ניהול משתמשים',
    icon: Users,
    description: 'עריכת משתמשים ומטבעות'
  }
];

const externalItems = [
  {
    id: 'questions',
    label: 'בנק שאלות',
    icon: FileText,
    route: '/homework/questions',
    description: 'ניהול ועריכת שאלות'
  },
  {
    id: 'databases',
    label: 'יצירת מסד נתונים',
    icon: Database,
    route: '/admin/databases',
    description: 'יצירה וניהול מאגרי נתונים'
  },
  {
    id: 'homework',
    label: 'ניהול שיעורי בית',
    icon: BookOpen,
    route: '/admin/homework',
    description: 'ניהול מטלות ובחינות'
  },
  {
    id: 'mcp-michael',
    label: 'MCP מייקל',
    icon: Database,
    route: '/admin/mcp-michael',
    description: 'ניהול מסד נתונים'
  }
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  collapsed = false,
  onToggleCollapse
}) => {
  const router = useRouter();

  const handleExternalNavigation = (route: string) => {
    router.push(route);
  };

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.branding}>
          <div className={styles.brandIcon}>
            <BarChart3 size={collapsed ? 20 : 24} />
          </div>
          {!collapsed && (
            <div className={styles.brandText}>
              <h2 className={styles.brandTitle}>ממשק ניהול</h2>
              <p className={styles.brandSubtitle}>Michael AI</p>
            </div>
          )}
        </div>
        
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={styles.collapseButton}
            title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* User Info */}
      {currentUser && (
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            <Users size={collapsed ? 16 : 18} />
          </div>
          {!collapsed && (
            <div className={styles.userText}>
              <span className={styles.userGreeting}>היי</span>
              <span className={styles.userName}>{currentUser}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className={styles.navigation}>
        <div className={styles.navSection}>
          {!collapsed && <div className={styles.sectionTitle}>ניהול ראשי</div>}
          
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <div className={styles.navIcon}>
                  <Icon size={20} />
                </div>
                {!collapsed && (
                  <div className={styles.navContent}>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.navDescription}>{item.description}</span>
                  </div>
                )}
                {isActive && <div className={styles.activeIndicator} />}
              </button>
            );
          })}
        </div>

        <div className={styles.navSection}>
          {!collapsed && <div className={styles.sectionTitle}>כלים נוספים</div>}
          
          {externalItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleExternalNavigation(item.route)}
                className={styles.navItem}
                title={collapsed ? item.label : undefined}
              >
                <div className={styles.navIcon}>
                  <Icon size={20} />
                </div>
                {!collapsed && (
                  <div className={styles.navContent}>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.navDescription}>{item.description}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          onClick={onLogout}
          className={styles.logoutButton}
          title={collapsed ? 'יציאה' : undefined}
        >
          <div className={styles.navIcon}>
            <LogOut size={20} />
          </div>
          {!collapsed && (
            <span className={styles.navLabel}>יציאה</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
