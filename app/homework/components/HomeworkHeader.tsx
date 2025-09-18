"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useHomeworkLocale } from "../context/HomeworkLocaleProvider";
import styles from "../module.module.css";

export function HomeworkHeader() {
  const { t } = useHomeworkLocale();

  return (
    <div className={styles.stickyNav}>
      <div className={styles.navContent}>
        <div className={styles.navLeft}>
          <Link href="/admin" className={styles.backButton}>
            <ArrowRight size={20} />
            {t("admin.homework.back")}
          </Link>
        </div>
        <div className={styles.navCenter}>
          <BookOpen size={24} />
          <div>
            <h1 className={styles.navTitle}>{t("admin.homework.title")}</h1>
            <p className={styles.navSubtitle}>{t("admin.homework.subtitle")}</p>
          </div>
        </div>
        <div className={styles.navRight}>
          {/* Space for future controls */}
        </div>
      </div>
    </div>
  );
}
