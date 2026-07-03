"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Coins, Send } from "lucide-react";

import styles from "./page.module.css";

type ChallengeStatus = "pending" | "active" | "completed" | "expired" | "cancelled";

type ChallengeQuestion = {
  queryId: string;
  practiceId: string;
  table?: string;
  difficulty?: string;
  question: string;
};

type ChallengeAttempt = {
  questionId: string;
  correct: boolean;
  similarity: number;
  submittedAt: string;
};

type Challenge = {
  id: string;
  status: ChallengeStatus;
  studentEmail: string;
  year: number;
  semester: number;
  questions: ChallengeQuestion[];
  attempts: ChallengeAttempt[];
  score?: {
    correctCount: number;
    totalQuestions: number;
    passingCorrectCount: number;
    passed: boolean;
  };
  coinLedgerTransactionId?: string;
};

function getStatusText(status: ChallengeStatus): string {
  switch (status) {
    case "pending":
    case "active":
      return "זמין להגשה";
    case "completed":
      return "הושלם";
    case "expired":
      return "פג תוקף";
    case "cancelled":
      return "בוטל";
    default:
      return status;
  }
}

export default function SqlCoinChallengePage() {
  const params = useParams<{ challengeId: string }>();
  const router = useRouter();
  const challengeId = params?.challengeId;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId) return;

    let cancelled = false;

    async function loadChallenge() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/coins/challenges/${encodeURIComponent(challengeId)}`, {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/");
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || "לא נמצא אתגר SQL פעיל.");
        }
        if (!cancelled) {
          setChallenge(payload.challenge);
        }
      } catch (loadError) {
        console.error("Failed to load SQL coin challenge:", loadError);
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "טעינת האתגר נכשלה.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadChallenge();

    return () => {
      cancelled = true;
    };
  }, [challengeId, router]);

  const canSubmit = useMemo(() => {
    if (!challenge || (challenge.status !== "active" && challenge.status !== "pending")) return false;
    return challenge.questions.every((question) => answers[question.queryId]?.trim());
  }, [answers, challenge]);

  const submitChallenge = async () => {
    if (!challenge || !canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/coins/challenges/${encodeURIComponent(challenge.id)}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: challenge.questions.map((question) => ({
            questionId: question.queryId,
            answer: answers[question.queryId] || "",
          })),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "שליחת האתגר נכשלה.");
      }

      setChallenge(payload.challenge);
    } catch (submitError) {
      console.error("Failed to submit SQL coin challenge:", submitError);
      setError(submitError instanceof Error ? submitError.message : "שליחת האתגר נכשלה.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.shell}>
        <Link className={styles.backLink} href="/landing">
          <ArrowRight size={16} />
          חזרה למסך הבית
        </Link>

        <section className={styles.header}>
          <div>
            <div className={styles.eyebrow}>אתגר SQL למטבע</div>
            <h1>פתרו 3 שאלות SQL</h1>
            <p>המטבע יינתן רק אחרי שכל התשובות נבדקות ונשמרות כהוכחת השלמה.</p>
          </div>
          <div className={styles.statusBadge}>
            <Coins size={18} />
            {challenge ? getStatusText(challenge.status) : "טוען"}
          </div>
        </section>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        {loading ? (
          <div className={styles.emptyState}>טוען אתגר...</div>
        ) : !challenge ? (
          <div className={styles.emptyState}>לא נמצא אתגר להצגה.</div>
        ) : challenge.status === "completed" ? (
          <section className={styles.completedState}>
            <BadgeCheck size={34} />
            <div>
              <h2>האתגר הושלם</h2>
              <p>
                {challenge.score
                  ? `${challenge.score.correctCount}/${challenge.score.totalQuestions} תשובות נכונות.`
                  : "ההשלמה נשמרה."}{" "}
                המטבע עודכן פעם אחת בלבד.
              </p>
            </div>
          </section>
        ) : challenge.status === "cancelled" || challenge.status === "expired" ? (
          <div className={styles.emptyState}>
            האתגר {challenge.status === "expired" ? "פג תוקף" : "בוטל"} ואינו פתוח להגשה.
          </div>
        ) : (
          <>
            <section className={styles.questions}>
              {challenge.questions.map((question, index) => {
                const attempt = challenge.attempts?.find((item) => item.questionId === question.queryId);
                return (
                  <article key={question.queryId} className={styles.questionCard}>
                    <div className={styles.questionHeader}>
                      <span>שאלה {index + 1}</span>
                      {attempt ? (
                        <strong className={attempt.correct ? styles.correct : styles.incorrect}>
                          {attempt.correct ? "נכון" : `לא מדויק (${attempt.similarity}%)`}
                        </strong>
                      ) : null}
                    </div>
                    <p className={styles.questionText}>{question.question}</p>
                    <label className={styles.answerField}>
                      <span>תשובת SQL</span>
                      <textarea
                        value={answers[question.queryId] || ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.queryId]: event.target.value,
                          }))
                        }
                        spellCheck={false}
                        placeholder="SELECT ..."
                      />
                    </label>
                  </article>
                );
              })}
            </section>

            <div className={styles.submitBar}>
              <div>
                <strong>תנאי השלמה</strong>
                <span>כל {challenge.questions.length} התשובות צריכות להיות נכונות כדי לקבל מטבע אחד.</span>
              </div>
              <button type="button" onClick={() => void submitChallenge()} disabled={!canSubmit || submitting}>
                <Send size={16} />
                {submitting ? "בודק..." : "שלח את האתגר"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
