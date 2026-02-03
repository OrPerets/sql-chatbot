"use client";

import { useMemo, useState } from "react";
import { AlertCircle, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import ReactMarkdown from "react-markdown";
import styles from "./page.module.css";

interface GenerationResponse {
  success: boolean;
  exam?: string;
  error?: string;
}

function normalizeExamMarkdown(markdown: string): string {
  if (!markdown) {
    return "";
  }

  let normalized = markdown.replace(/\r\n/g, "\n").trim();

  // Remove a single outer markdown/code fence if model wrapped the entire output.
  const fencedMatch = normalized.match(
    /^```(?:markdown|md|text)?\n([\s\S]*?)\n```$/i
  );
  if (fencedMatch?.[1]) {
    normalized = fencedMatch[1].trim();
  }

  const lines = normalized.split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const minIndent = nonEmpty.reduce((min, line) => {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    return Math.min(min, indent);
  }, Number.POSITIVE_INFINITY);

  if (Number.isFinite(minIndent) && minIndent > 0) {
    normalized = lines
      .map((line) => (line.trim().length > 0 ? line.slice(minIndent) : line))
      .join("\n");
  }

  return normalized;
}

export default function AdminExamGeneratorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedExam, setGeneratedExam] = useState<string>("");

  const hasFiles = files.length > 0;
  const filesSummary = useMemo(() => {
    if (files.length === 0) {
      return "לא נבחרו קבצים";
    }
    if (files.length === 1) {
      return files[0].name;
    }
    return `${files.length} קבצים נבחרו`;
  }, [files]);
  const normalizedExam = useMemo(
    () => normalizeExamMarkdown(generatedExam),
    [generatedExam]
  );

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = Array.from(event.target.files || []);
    const onlyPdf = pickedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".pdf")
    );

    setFiles(onlyPdf);
    setError(
      onlyPdf.length !== pickedFiles.length
        ? "אפשר להעלות רק קבצי PDF."
        : null
    );
  };

  const handleGenerate = async () => {
    if (!hasFiles) {
      setError("יש להעלות לפחות קובץ PDF אחד.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedExam("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/admin/exam-generator", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as GenerationResponse;
      if (!response.ok || !data.success || !data.exam) {
        throw new Error(data.error || "יצירת המבחן נכשלה.");
      }

      setGeneratedExam(data.exam);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "שגיאה לא צפויה ביצירת המבחן.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.header}>
        <h1>יצירת מבחן</h1>
        <p>
          העלאת מבחנים קודמים (PDF), ניתוח עם Michael ויצירת מבחן חדש באותו מבנה:
          תרחיש, הגדרות טבלאות ו-10 שאלות (9 SQL + 1 אלגברה יחסית).
        </p>
      </div>

      <div className={styles.card}>
        <label className={styles.uploadArea} htmlFor="pdf-upload">
          <Upload size={22} />
          <span>העלה מבחנים קודמים בפורמט PDF</span>
          <small>{filesSummary}</small>
        </label>
        <input
          id="pdf-upload"
          className={styles.fileInput}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFilesChange}
        />

        <button
          className={styles.createButton}
          onClick={handleGenerate}
          disabled={!hasFiles || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className={styles.spinning} />
              יוצר מבחן...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Create
            </>
          )}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {generatedExam && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <FileText size={18} />
            <h2>מבחן מוצע</h2>
          </div>
          <div className={styles.resultContent}>
            <div className={styles.examPaper}>
              <div className={styles.markdownContent}>
                <ReactMarkdown
                  components={{
                    pre: ({ children }) => (
                      <pre className={styles.sqlBlock}>{children}</pre>
                    ),
                    code: ({ inline, children, ...props }: any) =>
                      inline ? (
                        <code {...props}>{children}</code>
                      ) : (
                        <code dir="ltr" {...props}>
                          {children}
                        </code>
                      ),
                    hr: () => <hr className={styles.sectionDivider} />,
                  }}
                >
                  {normalizedExam}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
