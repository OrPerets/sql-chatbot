"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpLeft,
  BadgeCheck,
  BookOpenCheck,
  Clock,
  Coins,
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
  const [challengeLoading, setChallengeLoading] = useState(false);

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

      setChallengeLoading(true);
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
        setChallengeLoading(false);
        setIsLoading(false);
      }
    };

    void loadLanding();
  }, [router]);

  const activeChallenge = Boolean(challenge && (challenge.status === "active" || challenge.status === "pending"));
  const completedChallenge = challenge?.status === "completed";
  const inactiveChallenge = challenge?.status === "expired" || challenge?.status === "cancelled";

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

        {isAdmin && (
          <Link className={styles.headerAdminLink} href="/admin">
            <ShieldCheck aria-hidden="true" size={18} />
            ממשק ניהול
          </Link>
        )}
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
            </nav>

            <section className={styles.challengeCard} aria-label="אתגר SQL למטבע">
              {challengeLoading ? (
                <>
                  <Clock aria-hidden="true" size={20} />
                  <div>
                    <span className={styles.challengeTitle}>בודק אתגר SQL</span>
                    <span className={styles.challengeText}>טוען מצב אישי...</span>
                  </div>
                </>
              ) : activeChallenge ? (
                <>
                  <Coins aria-hidden="true" size={22} />
                  <div>
                    <span className={styles.challengeTitle}>אתגר SQL זמין</span>
                    <span className={styles.challengeText}>
                      {challenge?.questions.length || 3} שאלות. השלמה מוצלחת מעניקה מטבע אחד.
                    </span>
                  </div>
                  <Link className={styles.challengeLink} href={challenge ? `/coins/challenge/${challenge.id}` : "/landing"}>
                    לפתיחה
                    <ArrowUpLeft aria-hidden="true" size={16} />
                  </Link>
                </>
              ) : completedChallenge ? (
                <>
                  <BadgeCheck aria-hidden="true" size={22} />
                  <div>
                    <span className={styles.challengeTitle}>אתגר SQL הושלם</span>
                    <span className={styles.challengeText}>
                      {challenge?.score ? `${challenge.score.correctCount}/${challenge.score.totalQuestions} תשובות נכונות` : "המטבע עודכן במערכת."}
                    </span>
                  </div>
                </>
              ) : inactiveChallenge ? (
                <>
                  <Clock aria-hidden="true" size={22} />
                  <div>
                    <span className={styles.challengeTitle}>אין אתגר פעיל</span>
                    <span className={styles.challengeText}>
                      האתגר האחרון {challenge?.status === "expired" ? "פג תוקף" : "בוטל"}.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Coins aria-hidden="true" size={22} />
                  <div>
                    <span className={styles.challengeTitle}>אין אתגר מטבע כרגע</span>
                    <span className={styles.challengeText}>אם המרצה יפתח אתגר אישי, הוא יופיע כאן.</span>
                  </div>
                </>
              )}
            </section>
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
