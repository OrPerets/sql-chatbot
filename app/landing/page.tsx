"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpLeft,
  BookOpenCheck,
  Database,
  MessageCircle,
  Network,
  ShieldCheck,
} from "lucide-react";
import styles from "./page.module.css";

const LandingPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      setIsLoading(false);
      router.replace("/");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const adminEmails = [
        "liorbs89@gmail.com",
        "eyalh747@gmail.com",
        "orperets11@gmail.com",
        "roeizer@shenkar.ac.il",
        "r_admin@gmail.com",
      ];
      const normalizedEmail =
        typeof user?.email === "string" ? user.email.toLowerCase() : "";
      const normalizedRole =
        typeof user?.role === "string" ? user.role.toLowerCase() : "";
      const userIsAdmin =
        normalizedRole === "admin" || adminEmails.includes(normalizedEmail);
      setIsAdmin(userIsAdmin);
      setUserName(user.name || user.firstName || null);
    } catch (error) {
      console.error("Error parsing user data:", error);
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingOrb} aria-hidden="true" />
        <p className={styles.loadingText}>טוען...</p>
      </div>
    );
  }

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.backgroundLayer} aria-hidden="true" />

      <header className={styles.topBar}>
        <div className={styles.brand} aria-label="Michael SQL learning hub">
          <img className={styles.logoImage} src="/bot.png" alt="מייקל" />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Michael</span>
            <span className={styles.brandSubtitle}>SQL Learning Lab</span>
          </div>
        </div>

        <div className={styles.headerStatus} aria-hidden="true">
          <span>SQL</span>
          <span>JOIN</span>
        </div>
      </header>

      <main className={styles.shell}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <div className={styles.inlineSignal} aria-hidden="true">
              <span>SELECT</span>
              <span>WHERE</span>
              <span>תרגול</span>
            </div>

            <h1 id="landing-title" className={styles.title}>
              מרכז הלמידה שלך.
            </h1>
            <p className={styles.subtitle}>שיחה. תרגול. הגשה.</p>

            <nav className={styles.primaryActions} aria-label="פעולות מרכזיות">
              <Link className={styles.primaryAction} href="/entities/basic-chat">
                <MessageCircle aria-hidden="true" size={22} />
                <span>מייקל</span>
                <ArrowUpLeft aria-hidden="true" size={18} />
              </Link>
              <Link
                className={`${styles.primaryAction} ${styles.secondaryAction}`}
                href="/homework"
              >
                <BookOpenCheck aria-hidden="true" size={22} />
                <span>תרגילי בית</span>
                <ArrowUpLeft aria-hidden="true" size={18} />
              </Link>
            </nav>
          </div>

          <div className={styles.visualPanel} aria-label="Michael">
            <div className={styles.schemaRail} aria-hidden="true">
              <span>students</span>
              <span>grades</span>
              <span>queries</span>
            </div>
            <div className={styles.botFrame}>
              <img className={styles.botImage} src="/bot.png" alt="מייקל" />
            </div>
            <div className={styles.queryGlass} aria-hidden="true">
              <span className={styles.queryLineStrong}>SELECT *</span>
              <span>FROM practice</span>
              <span>WHERE ready = true;</span>
            </div>
          </div>
        </section>

        <section className={styles.workspaceSection} aria-labelledby="workspace-title">
          <div className={styles.sectionHeader}>
            <h2 id="workspace-title">בחרו סביבת עבודה</h2>
            <p>הפעולות המרכזיות בלבד</p>
          </div>

          <div className={styles.workspaceGrid}>
            <Link className={styles.workspaceCard} href="/entities/basic-chat">
              <span className={styles.cardIcon}>
                <MessageCircle aria-hidden="true" size={24} />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>מייקל</span>
                <span className={styles.cardDescription}>שיחה ופתרון</span>
              </span>
              <span className={styles.cardCta}>כניסה</span>
            </Link>

            <Link className={styles.workspaceCard} href="/homework">
              <span className={styles.cardIcon}>
                <Database aria-hidden="true" size={24} />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>תרגילי בית</span>
                <span className={styles.cardDescription}>תרגול והגשה</span>
              </span>
              <span className={styles.cardCta}>פתיחה</span>
            </Link>

            <button
              className={`${styles.workspaceCard} ${styles.disabledCard}`}
              type="button"
              disabled
            >
              <span className={styles.cardIcon}>
                <Network aria-hidden="true" size={24} />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>שאילתה ויזואלית</span>
                <span className={styles.cardDescription}>המחשת קשרים</span>
              </span>
              <span className={styles.cardCta}>לא פעיל</span>
              <span className={styles.comingSoon}>בקרוב</span>
            </button>
          </div>
        </section>

        {isAdmin && (
          <section className={styles.adminPanel} aria-label="ממשק ניהול">
            <div className={styles.adminIcon}>
              <ShieldCheck aria-hidden="true" size={24} />
            </div>
            <div className={styles.adminCopy}>
              <h2>ממשק ניהול</h2>
              <p>מוצג רק למנהלים{userName ? ` · ${userName}` : ""}</p>
            </div>
            <Link className={styles.adminLink} href="/admin">
              פתיחה
              <ArrowUpLeft aria-hidden="true" size={18} />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
};

export default LandingPage;
