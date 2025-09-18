"use client";

import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: string | null;
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  currentUser,
  onLogout
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      
      // Auto-collapse on tablet/desktop for better space usage
      if (!mobile && window.innerWidth <= 1280) {
        setSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when tab changes
  useEffect(() => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  }, [activeTab, isMobile]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobile, mobileMenuOpen]);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      {isMobile && (
        <div className={styles.mobileHeader}>
          <button
            onClick={toggleMobileMenu}
            className={styles.mobileMenuButton}
            aria-label={mobileMenuOpen ? 'סגור תפריט' : 'פתח תפריט'}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className={styles.mobileTitle}>
            <h1>ממשק ניהול - Michael AI</h1>
          </div>
          
          {currentUser && (
            <div className={styles.mobileUser}>
              היי {currentUser}
            </div>
          )}
        </div>
      )}

      {/* Sidebar */}
      <div 
        className={`
          ${styles.sidebarContainer} 
          ${isMobile && mobileMenuOpen ? styles.mobileMenuOpen : ''}
        `}
      >
        <Sidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          currentUser={currentUser}
          onLogout={onLogout}
          collapsed={!isMobile && sidebarCollapsed}
          onToggleCollapse={!isMobile ? toggleSidebarCollapse : undefined}
        />
      </div>

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className={styles.mobileOverlay}
          onClick={toggleMobileMenu}
        />
      )}

      {/* Main Content */}
      <main 
        className={`
          ${styles.mainContent} 
          ${!isMobile && sidebarCollapsed ? styles.sidebarCollapsed : ''}
        `}
      >
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
