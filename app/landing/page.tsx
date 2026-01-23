"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Database, BookOpen, Shield } from 'lucide-react';
import styles from './page.module.css';

const LandingPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/');
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"];
      const userIsAdmin = adminEmails.includes(user.email);
      setIsAdmin(userIsAdmin);
      setUserName(user.name || user.firstName || null);
    } catch (error) {
      console.error('Error parsing user data:', error);
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
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <img className={styles.logoImage} src="/logo.png" alt="Michael logo" />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>MICHAEL</span>
            <span className={styles.brandSubtitle}>SQL AI Assistant</span>
          </div>
        </div>
      </header>

      <main className={styles.content}>
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

          {/* ממשק ניהול - Admin Interface */}
          {isAdmin && (
            <div
              className={styles.optionCard}
              onClick={() => handleNavigation('/admin')}
            >
              <div className={styles.cardIcon}>
                <Shield size={48} />
              </div>
              <h2 className={styles.cardTitle}>ממשק ניהול</h2>
              <p className={styles.cardDescription}>
                ניהול המערכת והמשתמשים
              </p>
              {userName && (
                <p className={styles.adminName}>{userName}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
