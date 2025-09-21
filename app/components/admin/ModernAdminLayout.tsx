"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ModernHeader from './ModernHeader';
import styles from './ModernAdminLayout.module.css';

interface ModernAdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: string | null;
  onLogout: () => void;
}

const ModernAdminLayout: React.FC<ModernAdminLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  currentUser,
  onLogout
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // Auto-collapse sidebar on tablet
      if (window.innerWidth < 1200 && window.innerWidth >= 1024) {
        setIsSidebarCollapsed(true);
      }
      
      // Close mobile menu when switching to desktop
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMobileMenuOpen && !target.closest(`.${styles.sidebar}`) && !target.closest(`.${styles.mobileMenuButton}`)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobile && isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobile, isMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isMobileMenuOpen]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    // Close mobile menu when navigating
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className={styles.layout} dir="rtl">
      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className={styles.mobileOverlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${styles.sidebarContainer} 
        ${isMobile && isMobileMenuOpen ? styles.mobileMenuOpen : ''}
      `}>
        <Sidebar
          isCollapsed={!isMobile && isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          currentUser={currentUser}
          onLogout={onLogout}
        />
      </div>

      {/* Main Content Area */}
      <div className={`
        ${styles.mainContent} 
        ${!isMobile && isSidebarCollapsed ? styles.sidebarCollapsed : ''}
      `}>
        {/* Header */}
        <ModernHeader
          currentUser={currentUser}
          onLogout={onLogout}
          isSidebarCollapsed={!isMobile && isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          showMobileMenu={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Content Wrapper */}
        <main className={styles.contentWrapper}>
          {/* Page Content */}
          <div className={styles.pageContent}>
            {children}
          </div>

          {/* Footer */}
          <footer className={styles.footer}>
            <div className={styles.footerContent}>
              <div className={styles.footerLeft}>
                <p className={styles.footerText}>
                  © 2025 מערכת SQL Learning Platform. כל הזכויות שמורות.
                </p>
              </div>
              <div className={styles.footerRight}>
                <span className={styles.version}>גרסה 2.1.0</span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Loading Overlay (can be used for global loading states) */}
      {/* <div className={styles.loadingOverlay}>
        <div className={styles.loadingSpinner}></div>
      </div> */}
    </div>
  );
};

export default ModernAdminLayout;
