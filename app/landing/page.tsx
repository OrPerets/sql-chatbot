"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpLeft,
  Bell,
  BookOpenCheck,
  Clapperboard,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import FigureMichaelAvatar from "../components/FigureMichaelAvatar";
import styles from "./page.module.css";

type ChallengeSummary = {
  id: string;
  status: "pending" | "active" | "completed" | "expired" | "cancelled";
  questions: Array<{ queryId: string; question: string }>;
  score?: {
    correctCount: number;
    totalQuestions: number;
    passed: boolean;
  };
  completedAt?: string;
};

const LandingPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeSummary | null>(null);

  useEffect(() => {
    const loadLanding = async () => {
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
      } catch (error) {
        console.error("Error parsing user data:", error);
      }

      try {
        const response = await fetch("/api/coins/challenges/me", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { challenge?: ChallengeSummary | null };
          setChallenge(payload.challenge ?? null);
        } else {
          setChallenge(null);
        }
      } catch (error) {
        console.error("Error loading SQL coin challenge:", error);
        setChallenge(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadLanding();
  }, [router]);

  const activeChallenge = Boolean(challenge && (challenge.status === "active" || challenge.status === "pending"));

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

        {(activeChallenge && challenge) || isAdmin ? (
          <div className={styles.topActions}>
            {activeChallenge && challenge ? (
              <Link
                className={styles.challengeNotification}
                href={`/coins/challenge/${challenge.id}`}
                aria-label={`אתגר SQL זמין - ${challenge.questions.length || 3} שאלות`}
                title="אתגר SQL זמין"
              >
                <Bell aria-hidden="true" size={20} />
                <span className={styles.notificationBadge}>1</span>
                <span className={styles.notificationText}>אתגר SQL</span>
              </Link>
            ) : null}

            {isAdmin && (
              <Link className={styles.headerAdminLink} href="/admin">
                <ShieldCheck aria-hidden="true" size={18} />
                ממשק ניהול
              </Link>
            )}
          </div>
        ) : null}
      </header>

      <main className={styles.shell}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <h1 id="landing-title" className={styles.title}>
              מייקל - העוזר האישי שלך
            </h1>

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
              <Link
                className={`${styles.primaryAction} ${styles.learningAction}`}
                href="/virtual-learning"
              >
                <Clapperboard aria-hidden="true" size={22} />
                <span>סביבת למידה וירטואלית</span>
                <ArrowUpLeft aria-hidden="true" size={18} />
              </Link>
            </nav>
          </div>

          <div className={styles.visualPanel} aria-label="Michael">
            <div className={styles.avatarStage} aria-hidden="true">
              <div className={styles.avatarHalo} />
              <div className={styles.avatarViewport}>
                <FigureMichaelAvatar className={styles.avatarCanvas} />
              </div>
              <div className={styles.avatarBase} />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
