"use client";

import { useMemo } from "react";
import { Edit3, BookOpen } from "lucide-react";
import { HomeworkWizard } from "../../components/HomeworkWizard";
import { useHomeworkDraft } from "@/app/homework/hooks/useHomeworkDraft";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./edit.module.css";

interface EditHomeworkClientProps {
  setId: string;
}

export function EditHomeworkClient({ setId }: EditHomeworkClientProps) {
  const { draft, isLoading, error } = useHomeworkDraft(setId);
  const { t, direction } = useHomeworkLocale();
  const heading = useMemo(() => (draft ? draft.metadata.title : ""), [draft]);

  if (isLoading) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>{t("builder.edit.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>{t("builder.edit.error.title")}</h2>
          <p className={styles.errorMessage}>{t("builder.edit.error.message")}</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.notFoundContainer}>
          <h2 className={styles.notFoundTitle}>{t("builder.edit.notFound.title")}</h2>
          <p className={styles.notFoundMessage}>{t("builder.edit.notFound.message")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleIcon}>
            <Edit3 size={32} />
          </div>
          <div>
            <h2 className={styles.title}>{t("builder.edit.title")} — {heading}</h2>
            <p className={styles.subtitle}>{t("builder.edit.subtitle")}</p>
          </div>
        </div>
      </header>
      
      <div className={styles.wizardContainer}>
        <HomeworkWizard initialState={draft} existingSetId={setId} initialStep="questions" />
      </div>
    </div>
  );
}
