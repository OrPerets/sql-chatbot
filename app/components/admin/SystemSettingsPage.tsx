"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Bot, Coins, FileUp, RefreshCw, Settings2 } from "lucide-react";

import { useAdminShell } from "./AdminShell";
import styles from "./SystemSettingsPage.module.css";

type AdminOverview = {
  generatedAt: string;
  statuses: {
    michaelEnabled: boolean;
    coinsVisible: boolean;
    runtimeModel: string;
    totalUsers: number;
    extraTimeUploads: number;
  };
};

type UploadResult = {
  message: string;
  summary?: {
    totalRecords: number;
    inserted: number;
    updated: number;
    errors: number;
  };
};

export default function SystemSettingsPage() {
  const { currentAdminEmail } = useAdminShell();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const getAdminHeaders = (baseHeaders: Record<string, string> = {}) => ({
    ...baseHeaders,
    ...(currentAdminEmail ? { "x-user-email": currentAdminEmail } : {}),
  });

  const loadOverview = async () => {
    if (!currentAdminEmail) return;
    try {
      const response = await fetch("/api/admin/overview", {
        headers: getAdminHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`טעינת ההגדרות נכשלה (${response.status})`);
      }
      const data = (await response.json()) as AdminOverview;
      setOverview(data);
    } catch (loadError) {
      console.error("Failed to load admin overview:", loadError);
      setError(loadError instanceof Error ? loadError.message : "טעינת מסך ההגדרות נכשלה.");
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [currentAdminEmail]);

  const toggleMichael = async () => {
    if (!overview) return;
    setError(null);
    await fetch("/api/admin/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify({ newStatus: overview.statuses.michaelEnabled ? "OFF" : "ON" }),
    });
    await loadOverview();
  };

  const toggleCoinsVisibility = async () => {
    if (!overview) return;
    setError(null);
    await fetch("/api/users/coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify({ newStatus: overview.statuses.coinsVisible ? "OFF" : "ON" }),
    });
    await loadOverview();
  };

  const handleUploadExtraTime = async () => {
    if (!selectedFile) {
      setError("יש לבחור קובץ לפני העלאה.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/admin/uploadExtraTime", {
        method: "POST",
        headers: getAdminHeaders(),
        body: formData,
      });

      const result = (await response.json()) as UploadResult & { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "העלאת הקובץ נכשלה.");
      }

      setUploadResult(result);
      setSelectedFile(null);
      await loadOverview();
    } catch (uploadError) {
      console.error("Failed to upload extra time file:", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "העלאת הקובץ נכשלה.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>הגדרות מערכת</h1>
          <p className={styles.description}>
            שליטה תפעולית על זמינות המערכת, נראות מטבעות, קיצורי דרך להגדרות פיננסיות והעלאת
            התאמות זמן לבחינה.
          </p>
        </div>

        <div className={styles.actionRow}>
          <button className={styles.secondaryButton} onClick={() => void loadOverview()}>
            <RefreshCw size={16} />
            רענן
          </button>
          <Link href="/admin/model-management" className={styles.linkButton}>
            <ArrowUpRight size={16} />
            ניהול מודלים
          </Link>
        </div>
      </div>

      {error ? <div className={styles.errorState}>{error}</div> : null}

      <div className={styles.overviewGrid}>
        <div className={styles.overviewCard}>
          <p className={styles.overviewLabel}>מצב Michael</p>
          <p className={styles.overviewValue}>{overview?.statuses.michaelEnabled ? "פעיל" : "כבוי"}</p>
        </div>
        <div className={styles.overviewCard}>
          <p className={styles.overviewLabel}>נראות מטבעות</p>
          <p className={styles.overviewValue}>{overview?.statuses.coinsVisible ? "מוצג" : "מוסתר"}</p>
        </div>
        <div className={styles.overviewCard}>
          <p className={styles.overviewLabel}>Runtime פעיל</p>
          <p className={styles.overviewValue}>{overview?.statuses.runtimeModel || "—"}</p>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>זמינות ותפעול מיידי</h2>
            <p className={styles.sectionCaption}>
              קודם רואים מה המצב, ורק אחר כך משנים. כל כפתור מסביר מה ההשפעה שלו.
            </p>
          </div>
        </div>

        <div className={styles.toggleGrid}>
          <div className={styles.toggleCard}>
            <div className={styles.toggleHeader}>
              <div>
                <h3 className={styles.toggleTitle}>Michael לסטודנטים</h3>
                <p className={styles.toggleDescription}>
                  שליטה בזמינות עוזר ה-AI במסלולי הלמידה.
                </p>
              </div>
              <span className={styles.statusPill}>
                {overview?.statuses.michaelEnabled ? "פעיל" : "כבוי"}
              </span>
            </div>
            <p className={styles.toggleMeta}>
              כש-Michael כבוי, סטודנטים מאבדים גישה לעזרה המיידית. כדאי להשתמש בזה רק במצבי
              תחזוקה או בדיקות.
            </p>
            <div className={styles.toggleActions}>
              <button className={styles.primaryButton} onClick={toggleMichael}>
                <Bot size={16} />
                {overview?.statuses.michaelEnabled ? "כבה Michael" : "הפעל Michael"}
              </button>
            </div>
          </div>

          <div className={styles.toggleCard}>
            <div className={styles.toggleHeader}>
              <div>
                <h3 className={styles.toggleTitle}>נראות מטבעות</h3>
                <p className={styles.toggleDescription}>
                  האם היתרות מוצגות כרגע למשתמשי הקצה.
                </p>
              </div>
              <span className={styles.statusPill}>
                {overview?.statuses.coinsVisible ? "מוצג" : "מוסתר"}
              </span>
            </div>
            <p className={styles.toggleMeta}>
              השינוי משפיע מיידית על ה-UI של המשתמשים. ניהול העלויות עצמו נשאר במסך מטבעות
              נפרד.
            </p>
            <div className={styles.toggleActions}>
              <button className={styles.primaryButton} onClick={toggleCoinsVisibility}>
                <Coins size={16} />
                {overview?.statuses.coinsVisible ? "הסתר מטבעות" : "הצג מטבעות"}
              </button>
              <Link href="/admin/coins" className={styles.linkButton}>
                <ArrowUpRight size={16} />
                ניהול חיובים
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="extra-time">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>התאמות זמן לבחינה</h2>
            <p className={styles.sectionCaption}>
              העלאת קובץ מרוכז ושמירה במסד ייעודי כדי שהפעולה תהיה חלק מממשק הניהול ולא UI
              שבור.
            </p>
          </div>
          <span className={styles.statusPill}>{overview?.statuses.extraTimeUploads ?? 0} רשומות פעילות</span>
        </div>

        <div className={styles.uploadGrid}>
          <div>
            <ul className={styles.uploadChecklist}>
              <li>הקובץ חייב להכיל עמודות בשם `ID` ו-`PERCENTAGE`.</li>
              <li>אחוז ההתאמה חייב להיות בין 0 ל-100.</li>
              <li>אם אותה זהות מופיעה פעמיים, הרשומה האחרונה תעדכן את הקודמת.</li>
              <li>נתמכים קבצי `.xlsx` וגם `.csv`.</li>
            </ul>
          </div>

          <div className={styles.uploadPanel}>
            <p className={styles.uploadHint}>בחר קובץ והעלה אותו ישירות למסד ההתאמות.</p>
            <input
              className={styles.fileInput}
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
            {selectedFile ? <div className={styles.uploadHint}>נבחר: {selectedFile.name}</div> : null}
            <button className={styles.primaryButton} onClick={handleUploadExtraTime} disabled={uploading || !selectedFile}>
              <FileUp size={16} />
              {uploading ? "מעלה..." : "העלה קובץ התאמות"}
            </button>
            {uploadResult ? (
              <div className={styles.uploadResult}>
                <div>{uploadResult.message}</div>
                {uploadResult.summary ? (
                  <div>
                    {`סה"כ ${uploadResult.summary.totalRecords} רשומות | נוספו ${uploadResult.summary.inserted} | עודכנו ${uploadResult.summary.updated} | שגיאות ${uploadResult.summary.errors}`}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>קישורים קשורים</h2>
            <p className={styles.sectionCaption}>
              מסכים צמודים שכדאי לפתוח מההגדרות, בלי ללכת לאיבוד בניווט.
            </p>
          </div>
        </div>

        <div className={styles.relatedGrid}>
          <div className={styles.relatedCard}>
            <h3 className={styles.toggleTitle}>מטבעות וחיובים</h3>
            <p className={styles.relatedDescription}>תמחור, מודולי חיוב, יתרות ושימושים לפי משתמש.</p>
            <div className={styles.relatedActions}>
              <Link href="/admin/coins" className={styles.linkButton}>
                <ArrowUpRight size={16} />
                פתח מטבעות
              </Link>
            </div>
          </div>

          <div className={styles.relatedCard}>
            <h3 className={styles.toggleTitle}>ניהול מודלים</h3>
            <p className={styles.relatedDescription}>בדיקת runtime, rollback, פיצ׳רים וכלי בדיקת Responses.</p>
            <div className={styles.relatedActions}>
              <Link href="/admin/model-management" className={styles.linkButton}>
                <ArrowUpRight size={16} />
                פתח ניהול מודלים
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
