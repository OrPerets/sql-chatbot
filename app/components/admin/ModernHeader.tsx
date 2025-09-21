"use client";

import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Settings, 
  User,
  ChevronDown,
  Menu,
  Sun,
  Moon,
  HelpCircle,
  LogOut,
  UserCircle
} from 'lucide-react';
import styles from './ModernHeader.module.css';

interface ModernHeaderProps {
  currentUser?: string | null;
  onLogout: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  showMobileMenu?: boolean;
  onToggleMobileMenu?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
}

const mockNotifications: NotificationItem[] = [
  {
    id: '1',
    title: 'משתמש חדש נרשם',
    message: 'יוסי כהן הצטרף למערכת',
    time: '5 דקות',
    isRead: false,
    type: 'info'
  },
  {
    id: '2',
    title: 'מטלה חדשה נוצרה',
    message: 'מטלת SQL בסיסי פורסמה',
    time: '30 דקות',
    isRead: false,
    type: 'success'
  },
  {
    id: '3',
    title: 'שגיאה במערכת',
    message: 'בעיית חיבור למסד הנתונים',
    time: '1 שעה',
    isRead: true,
    type: 'error'
  }
];

const ModernHeader: React.FC<ModernHeaderProps> = ({
  currentUser,
  onLogout,
  isSidebarCollapsed,
  onToggleSidebar,
  showMobileMenu,
  onToggleMobileMenu
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    setShowUserMenu(false);
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
    setShowNotifications(false);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const clearAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(`.${styles.notificationDropdown}`) && 
          !target.closest(`.${styles.notificationButton}`)) {
        setShowNotifications(false);
      }
      if (!target.closest(`.${styles.userDropdown}`) && 
          !target.closest(`.${styles.userButton}`)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        {/* Left Section - Navigation */}
        <div className={styles.headerLeft}>
          {/* Mobile Menu Button */}
          <button
            className={styles.mobileMenuButton}
            onClick={onToggleMobileMenu}
            title="תפריט"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumbs */}
          <div className={styles.breadcrumbs}>
            <span className={styles.breadcrumbItem}>מערכת ניהול</span>
            <span className={styles.breadcrumbSeparator}>•</span>
            <span className={styles.breadcrumbCurrent}>דשבורד</span>
          </div>
        </div>

        {/* Center Section - Search */}
        <div className={styles.headerCenter}>
          <div className={styles.searchContainer}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="חיפוש משתמשים, מטלות, הגדרות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button 
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                title="נקה חיפוש"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Right Section - Actions & Profile */}
        <div className={styles.headerRight}>
          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <button 
              className={styles.actionButton}
              title="עזרה"
              onClick={() => console.log('Help')}
            >
              <HelpCircle size={18} />
            </button>

            {/* Notifications */}
            <div className={styles.notificationContainer}>
              <button 
                className={`${styles.actionButton} ${styles.notificationButton}`}
                onClick={handleNotificationClick}
                title="הודעות"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className={styles.notificationDropdown}>
                  <div className={styles.dropdownHeader}>
                    <h3>הודעות</h3>
                    {unreadCount > 0 && (
                      <button 
                        className={styles.clearAllButton}
                        onClick={clearAllNotifications}
                      >
                        סמן הכל כנקרא
                      </button>
                    )}
                  </div>
                  
                  <div className={styles.notificationList}>
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div 
                          key={notification.id}
                          className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
                          onClick={() => markNotificationAsRead(notification.id)}
                        >
                          <div className={styles.notificationIcon}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className={styles.notificationContent}>
                            <h4 className={styles.notificationTitle}>
                              {notification.title}
                            </h4>
                            <p className={styles.notificationMessage}>
                              {notification.message}
                            </p>
                            <span className={styles.notificationTime}>
                              לפני {notification.time}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.noNotifications}>
                        <Bell size={32} />
                        <p>אין הודעות חדשות</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Profile */}
          <div className={styles.userContainer}>
            <button 
              className={`${styles.userButton} ${showUserMenu ? styles.active : ''}`}
              onClick={handleUserMenuClick}
            >
              <div className={styles.userAvatar}>
                <User size={16} />
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {currentUser || 'מנהל מערכת'}
                </span>
                <span className={styles.userRole}>מנהל</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`${styles.userChevron} ${showUserMenu ? styles.rotated : ''}`}
              />
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className={styles.userDropdown}>
                <div className={styles.userDropdownHeader}>
                  <div className={styles.userAvatarLarge}>
                    <User size={24} />
                  </div>
                  <div>
                    <div className={styles.userDropdownName}>
                      {currentUser || 'מנהל מערכת'}
                    </div>
                    <div className={styles.userDropdownEmail}>
                      admin@example.com
                    </div>
                  </div>
                </div>

                <div className={styles.userMenuList}>
                  <button className={styles.userMenuItem}>
                    <UserCircle size={16} />
                    <span>פרופיל משתמש</span>
                  </button>
                  
                  <button className={styles.userMenuItem}>
                    <Settings size={16} />
                    <span>הגדרות חשבון</span>
                  </button>
                  
                  <button className={styles.userMenuItem}>
                    <HelpCircle size={16} />
                    <span>עזרה ותמיכה</span>
                  </button>
                  
                  <div className={styles.userMenuDivider}></div>
                  
                  <button 
                    className={`${styles.userMenuItem} ${styles.logoutItem}`}
                    onClick={onLogout}
                  >
                    <LogOut size={16} />
                    <span>יציאה</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ModernHeader;
