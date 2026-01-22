"use client";

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  BarChart3,
  Settings,
  Users,
  FileText,
  Database,
  BookOpen,
  Brain,
  ChevronRight,
  ChevronLeft,
  Home,
  LogOut,
  User,
  Search,
  Bell,
  HelpCircle
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: string | null;
  onLogout: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
  type: 'tab' | 'route' | 'section';
  route?: string;
  badge?: string;
  children?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'דשבורד ראשי',
    icon: Home,
    type: 'tab'
  },
  {
    id: 'weekly-analytics',
    label: 'אנליטיקה שבועית',
    icon: BarChart3,
    type: 'route',
    route: '/admin/weekly-analytics'
  },
  {
    id: 'overview',
    label: 'סקירה כללית',
    icon: BarChart3,
    type: 'section',
    children: [
      {
        id: 'analytics',
        label: 'ניתוח נתונים',
        icon: BarChart3,
        type: 'tab'
      },
      {
        id: 'reports',
        label: 'דוחות',
        icon: FileText,
        type: 'tab'
      }
    ]
  },
  {
    id: 'users',
    label: 'ניהול משתמשים',
    icon: Users,
    type: 'tab',
  },
  {
    id: 'students',
    label: 'פרופילי סטודנטים',
    icon: Users,
    type: 'tab',
  },
  {
    id: 'analysis',
    label: 'ניתוחי AI',
    icon: Brain,
    type: 'tab',
  },
  {
    id: 'settings',
    label: 'הגדרות מערכת',
    icon: Settings,
    type: 'tab'
  },
  {
    id: 'content',
    label: 'ניהול תוכן',
    icon: BookOpen,
    type: 'section',
    children: [
      {
        id: 'questions',
        label: 'בנק שאלות',
        icon: FileText,
        type: 'route',
        route: '/homework/questions'
      },
      {
        id: 'templates',
        label: 'תבניות שאלות',
        icon: FileText,
        type: 'route',
        route: '/admin/templates'
      },
      {
        id: 'homework',
        label: 'מטלות ובחינות',
        icon: BookOpen,
        type: 'route',
        route: '/admin/homework'
      }
    ]
  },
  {
    id: 'system',
    label: 'כלי מערכת',
    icon: Database,
    type: 'section',
    children: [
      {
        id: 'databases',
        label: 'מסדי נתונים לתרגילים',
        icon: Database,
        type: 'route',
        route: '/admin/databases'
      },
      {
        id: 'mcp-michael',
        label: 'MCP מייקל',
        icon: Database,
        type: 'route',
        route: '/admin/mcp-michael'
      },
      {
        id: 'model-management',
        label: 'ניהול מודלי AI',
        icon: Brain,
        type: 'route',
        route: '/admin/model-management'
      }
    ]
  }
];

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onTabChange,
  currentUser,
  onLogout
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(['content', 'system', 'overview']);

  const handleItemClick = (item: NavigationItem) => {
    if (item.type === 'route' && item.route) {
      router.push(item.route);
    } else if (item.type === 'tab') {
      onTabChange(item.id);
    } else if (item.type === 'section') {
      toggleSection(item.id);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActiveItem = (item: NavigationItem): boolean => {
    if (item.type === 'tab') {
      return activeTab === item.id;
    }
    if (item.type === 'route' && item.route) {
      return pathname === item.route;
    }
    return false;
  };

  const renderNavigationItem = (item: NavigationItem, depth = 0) => {
    const Icon = item.icon;
    const isActive = isActiveItem(item);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections.includes(item.id);
    const isChild = depth > 0;

    return (
      <div key={item.id} className={styles.navItemContainer}>
        <button
          className={`
            ${styles.navItem} 
            ${isActive ? styles.navItemActive : ''} 
            ${isChild ? styles.navItemChild : ''}
            ${isCollapsed ? styles.navItemCollapsed : ''}
          `}
          onClick={() => handleItemClick(item)}
          title={isCollapsed ? item.label : undefined}
        >
          <div className={styles.navItemIcon}>
            {React.createElement(Icon, { size: isChild ? 18 : 20 })}
          </div>

          {!isCollapsed && (
            <>
              <span className={styles.navItemLabel}>{item.label}</span>
              
              {item.badge && (
                <span className={styles.navItemBadge}>
                  {item.badge}
                </span>
              )}
              
              {hasChildren && (
                <ChevronRight 
                  size={16} 
                  className={`${styles.navItemChevron} ${isExpanded ? styles.navItemChevronExpanded : ''}`}
                />
              )}
            </>
          )}

          {isActive && <div className={styles.activeIndicator} />}
        </button>

        {hasChildren && isExpanded && !isCollapsed && (
          <div className={styles.navChildren}>
            {item.children?.map(child => renderNavigationItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>
      {/* Sidebar Header */}
      <div className={styles.sidebarHeader}>
        {!isCollapsed && (
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <Database size={24} />
            </div>
            <div className={styles.logoText}>
              <h1 className={styles.logoTitle}>SQL Admin</h1>
              <p className={styles.logoSubtitle}>מערכת ניהול</p>
            </div>
          </div>
        )}
        
        <button
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          title={isCollapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Quick Search - Show only when expanded */}
      {!isCollapsed && (
        <div className={styles.quickSearch}>
          <div className={styles.searchInput}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="חיפוש מהיר..."
              className={styles.searchField}
            />
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className={styles.navigation}>
        <div className={styles.navList}>
          {navigationItems.map(item => renderNavigationItem(item))}
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className={styles.sidebarFooter}>
        {/* User Profile Section */}
        <div className={styles.userSection}>
          {!isCollapsed ? (
            <div className={styles.userProfile}>
              <div className={styles.userAvatar}>
                <User size={18} />
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{currentUser || 'מנהל מערכת'}</span>
                <span className={styles.userRole}>מנהל</span>
              </div>
            </div>
          ) : (
            <div className={styles.userAvatarCollapsed} title={currentUser || 'מנהל מערכת'}>
              <User size={18} />
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <button 
            className={styles.quickAction} 
            title="הודעות"
            onClick={() => console.log('Notifications')}
          >
            <Bell size={18} />
            {!isCollapsed && <span>הודעות</span>}
          </button>

          <button 
            className={styles.quickAction} 
            title="עזרה"
            onClick={() => console.log('Help')}
          >
            <HelpCircle size={18} />
            {!isCollapsed && <span>עזרה</span>}
          </button>

          <button 
            className={styles.quickAction} 
            title="יציאה"
            onClick={onLogout}
          >
            <LogOut size={18} />
            {!isCollapsed && <span>יציאה</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
