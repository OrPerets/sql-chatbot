"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useHomeworkSets } from "@/app/homework/hooks/useHomeworkSets";
import type { HomeworkStatusFilter, HomeworkSummary } from "@/app/homework/types";
import styles from "./dashboard.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";

const statusFilters: HomeworkStatusFilter[] = ["draft", "scheduled", "published", "archived"];

function groupByStatus(items: HomeworkSummary[]) {
  return items.reduce<Record<HomeworkStatusFilter, HomeworkSummary[]>>(
    (acc, item) => {
      const status = (item.visibility === "draft" && item.published ? "scheduled" : item.visibility) as HomeworkStatusFilter;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status]!.push(item);
      return acc;
    },
    {
      draft: [],
      scheduled: [],
      published: [],
      archived: [],
    },
  );
}

export default function BuilderDashboardPage() {
  const [activeFilter, setActiveFilter] = useState<HomeworkStatusFilter | "all">("all");
  const { data, isLoading, error } = useHomeworkSets(activeFilter === "all" ? undefined : { status: [activeFilter] });
  const { t, formatNumber, direction } = useHomeworkLocale();

  const grouped = useMemo(() => groupByStatus(data?.items ?? []), [data]);

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <div>
          <h2>{t("builder.dashboard.title")}</h2>
          <p>{t("builder.dashboard.subtitle")}</p>
        </div>
        <Link href="/homework/builder/create" className={styles.cta}>
          {t("builder.dashboard.newSet")}
        </Link>
      </header>

      <div className={styles.filters}>
        <button
          type="button"
          className={activeFilter === "all" ? `${styles.filter} ${styles.active}` : styles.filter}
          onClick={() => setActiveFilter("all")}
        >
          {t("builder.dashboard.filter.all")}
        </button>
        {statusFilters.map((filter) => (
          <button
            type="button"
            key={filter}
            className={activeFilter === filter ? `${styles.filter} ${styles.active}` : styles.filter}
            onClick={() => setActiveFilter(filter)}
          >
            {t(`builder.dashboard.filter.${filter}`)}
            <span className={styles.count}>{formatNumber(grouped[filter]?.length ?? 0)}</span>
          </button>
        ))}
      </div>

      {isLoading && <p>{t("builder.dashboard.loading")}</p>}
      {error && <p className={styles.error}>{t("builder.dashboard.error")}</p>}

      <div className={styles.grid}>
        {(data?.items ?? []).map((set) => (
          <article key={set.id} className={styles.card}>
            <header className={styles.cardHeader}>
              <div>
                <h3>{set.title}</h3>
                <p>{set.courseId}</p>
              </div>
              <span className={styles.status}>
                {t(`builder.dashboard.filter.${set.visibility === "draft" && set.published ? "scheduled" : set.visibility}`)}
              </span>
            </header>
            <dl className={styles.meta}>
              <div>
                <dt>{t("builder.dashboard.card.questions")}</dt>
                <dd>
                  {formatNumber(set.draftQuestionCount)}/10
                </dd>
              </div>
              <div>
                <dt>{t("builder.dashboard.card.submissions")}</dt>
                <dd>{formatNumber(set.submissionCount)}</dd>
              </div>
              <div>
                <dt>{t("builder.dashboard.card.average")}</dt>
                <dd>{typeof set.averageScore === "number" ? formatNumber(set.averageScore) : "—"}</dd>
              </div>
            </dl>
            <footer className={styles.cardFooter}>
              <Link href={`/homework/builder/${set.id}/edit`} className={styles.cardLink}>
                {t("builder.dashboard.card.edit")}
              </Link>
              <Link href={`/homework/builder/${set.id}/preview`} className={styles.cardLink}>
                {t("builder.dashboard.card.preview")}
              </Link>
              <Link href={`/homework/builder/${set.id}/grade`} className={styles.cardLink}>
                {t("builder.dashboard.card.grade")}
              </Link>
            </footer>
          </article>
        ))}
      </div>

      {!isLoading && (data?.items?.length ?? 0) === 0 && (
        <div className={styles.emptyState}>
          <h3>{t("builder.dashboard.empty.title")}</h3>
          <p>{t("builder.dashboard.empty.message")}</p>
          <Link href="/homework/builder/create" className={styles.emptyCta}>
            {t("builder.dashboard.empty.cta")}
          </Link>
        </div>
      )}
    </div>
  );
}
