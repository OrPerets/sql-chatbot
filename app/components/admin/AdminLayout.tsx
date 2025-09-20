"use client";

import React from 'react';
import AdminDashboard from './AdminDashboard';
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
  // If we're on the main dashboard, show the dashboard layout
  if (activeTab === 'dashboard' || !activeTab || activeTab === '') {
    return (
      <AdminDashboard
        currentUser={currentUser}
        onLogout={onLogout}
        onTabChange={onTabChange}
      />
    );
  }

  // For other tabs, show content in a simple layout
  return (
    <div className={styles.simpleLayout}>
      <div className={styles.simpleHeader}>
        <button 
          onClick={() => onTabChange('dashboard')} 
          className={styles.backButton}
        >
          ← חזור לדשבורד
        </button>
        <button onClick={onLogout} className={styles.logoutButton}>
          יציאה
        </button>
      </div>
      <div className={styles.simpleContent}>
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
