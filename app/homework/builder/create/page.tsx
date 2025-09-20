"use client";

import { Plus, BookOpen } from "lucide-react";
import { HomeworkWizard } from "../components/HomeworkWizard";
import { useHomeworkLocale } from "../../context/HomeworkLocaleProvider";
import styles from "./create.module.css";

export default function CreateHomeworkPage() {
  const { t, direction } = useHomeworkLocale();

  return (
    <div className={`${styles.container} ${styles.fullWidthPage}`} dir={direction}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleIcon}>
            <Plus size={32} />
          </div>
          <div>
            <h2 className={styles.title}>{t("builder.create.title")}</h2>
            <p className={styles.subtitle}>{t("builder.create.subtitle")}</p>
          </div>
        </div>
      </header>
      
      <div className={styles.wizardContainer}>
        <HomeworkWizard />
      </div>
    </div>
  );
}
