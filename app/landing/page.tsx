"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Database, BookOpen } from 'lucide-react';
import styles from './page.module.css';

const LandingPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/');
      return;
    }
    setIsLoading(false);
  }, [router]);

  const handleNavigation = (route: string) => {
    if (route) {
      router.push(route);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>טוען...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>ברוכים הבאים</h1>
        <p className={styles.subtitle}>בחרו את הסביבה הרצויה</p>
      </div>

      <div className={styles.optionsGrid}>
        {/* מייקל - The Chat */}
        <div 
          className={styles.optionCard}
          onClick={() => handleNavigation('/entities/basic-chat')}
        >
          <div className={styles.cardIcon}>
            <MessageCircle size={48} />
          </div>
          <h2 className={styles.cardTitle}>מייקל</h2>
          <p className={styles.cardDescription}>
            עוזר AI חכם ללמידת SQL
          </p>
        </div>

        {/* המחשה ויזואלית של SQL */}
        <div 
          className={styles.optionCard}
          onClick={() => handleNavigation('/visualizer')}
        >
          <div className={styles.cardIcon}>
            <Database size={48} />
          </div>
          <h2 className={styles.cardTitle}>המחשה ויזואלית של SQL</h2>
          <p className={styles.cardDescription}>
            כלי ויזואלי להבנת שאילתות SQL
          </p>
        </div>

        {/* סביבת למידה אינטרנטיקית */}
        <div 
          className={`${styles.optionCard} ${styles.optionCardDisabled}`}
          onClick={() => {
            // Placeholder - does nothing for now
          }}
        >
          <div className={styles.cardIcon}>
            <BookOpen size={48} />
          </div>
          <h2 className={styles.cardTitle}>סביבת למידה אינטרנטיקית</h2>
          <p className={styles.cardDescription}>
            יגיע בהמשך
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
