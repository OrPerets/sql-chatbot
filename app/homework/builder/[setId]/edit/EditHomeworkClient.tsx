"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, Edit3 } from "lucide-react";
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
        <div className={styles.stateCard}>
          <div className={styles.loadingSpinner} />
          <p className={styles.stateText}>{t("builder.edit.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={`${styles.stateCard} ${styles.stateError}`}>
          <h2 className={styles.stateTitle}>{t("builder.edit.error.title")}</h2>
          <p className={styles.stateText}>{t("builder.edit.error.message")}</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={`${styles.stateCard} ${styles.stateWarning}`}>
          <h2 className={styles.stateTitle}>{t("builder.edit.notFound.title")}</h2>
          <p className={styles.stateText}>{t("builder.edit.notFound.message")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <Link href="/homework/builder" className={styles.breadcrumb}>
          <ChevronLeft size={16} />
          {t("builder.nav.dashboard")}
        </Link>
        <div className={styles.headerMeta}>
          <div className={styles.headerIcon}>
            <Edit3 size={18} />
          </div>
          <div className={styles.headerText}>
            <h1 className={styles.headerTitle}>{heading}</h1>
            <p className={styles.headerSubtitle}>{t("builder.edit.subtitle")}</p>
          </div>
        </div>
      </header>

      <HomeworkWizard initialState={draft} existingSetId={setId} initialStep="questions" />
    </div>
  );
}
