"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Edit3, Eye, GraduationCap, CheckCircle, Clock, AlertCircle, Archive, Send } from "lucide-react";
import { useHomeworkSets } from "@/app/homework/hooks/useHomeworkSets";
import type { HomeworkStatusFilter, HomeworkSummary } from "@/app/homework/types";
import styles from "./dashboard.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";

const statusFilters: HomeworkStatusFilter[] = ["draft", "scheduled", "published", "archived"];

// Status icon mapping
const statusIcons = {
  draft: AlertCircle,
  scheduled: Clock,
  published: CheckCircle,
  archived: Archive,
};

// Calculate progress percentage
function calculateProgress(set: HomeworkSummary): number {
  const totalQuestions = 10; // Fixed as per requirements
  const completedQuestions = set.draftQuestionCount;
  return Math.min(Math.round((completedQuestions / totalQuestions) * 100), 100);
}

// Action configuration
const cardActions = [
  { key: "edit", icon: Edit3, isPrimary: true },
  { key: "preview", icon: Eye, isPrimary: false },
  { key: "publish", icon: Send, isPrimary: false },
  { key: "grade", icon: GraduationCap, isPrimary: false },
];

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
  const totalCount = useMemo(() => data?.items?.length ?? 0, [data?.items]);

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <div>
          <h2>{t("builder.dashboard.title")}</h2>
          <p>{t("builder.dashboard.subtitle")}</p>
        </div>
        <Link href="/homework/builder/create" className={styles.cta}>
          <Plus size={18} />
          {t("builder.dashboard.newSet")}
        </Link>
      </header>

      <div className={styles.filters}>
        <span className={styles.filtersLabel}>{t("builder.dashboard.filterBy")}</span>
        <button
          type="button"
          className={activeFilter === "all" ? `${styles.filter} ${styles.active}` : styles.filter}
          onClick={() => setActiveFilter("all")}
          aria-pressed={activeFilter === "all"}
        >
          {t("builder.dashboard.filter.all")}
          <span className={styles.count}>{formatNumber(totalCount)}</span>
        </button>
        {statusFilters.map((filter) => {
          const Icon = statusIcons[filter];
          const count = grouped[filter]?.length ?? 0;
          return (
            <button
              type="button"
              key={filter}
              className={activeFilter === filter ? `${styles.filter} ${styles.active}` : styles.filter}
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
              disabled={count === 0 && !isLoading}
            >
              <Icon size={14} />
              {t(`builder.dashboard.filter.${filter}`)}
              <span className={styles.count}>{formatNumber(count)}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <p>{t("builder.dashboard.loading")}</p>}
      {error && (
        <div className={styles.error} role="alert">
          <AlertCircle size={20} />
          {t("builder.dashboard.error")}
        </div>
      )}

      <div className={styles.grid}>
        {(data?.items ?? []).map((set) => {
          const progress = calculateProgress(set);
          const status = set.visibility === "draft" && set.published ? "scheduled" : set.visibility;
          const StatusIcon = statusIcons[status as keyof typeof statusIcons];

          return (
            <article key={set.id} className={styles.card}>
              {/* Progress Indicator */}
              <div 
                className={styles.progressIndicator} 
                style={{ width: `${progress}%` }}
                aria-hidden="true"
              />
              
              <header className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>{set.title}</h3>
                  <p className={styles.cardSubtitle}>{set.courseId}</p>
                </div>
                <span 
                  className={styles.status} 
                  data-status={status}
                  aria-label={t(`builder.dashboard.status.${status}`)}
                >
                  <StatusIcon size={12} />
                  {t(`builder.dashboard.filter.${status}`)}
                </span>
              </header>
            <dl className={styles.meta}>
              <div className={styles.metaItem}>
                <dt>{t("builder.dashboard.card.questions")}</dt>
                <dd>
                  {formatNumber(set.draftQuestionCount)}/10
                  {progress < 100 && (
                    <small> ({formatNumber(100 - progress)}% נותר)</small>
                  )}
                </dd>
              </div>
              <div className={styles.metaItem}>
                <dt>{t("builder.dashboard.card.submissions")}</dt>
                <dd>{formatNumber(set.submissionCount)}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>{t("builder.dashboard.card.average")}</dt>
                <dd>
                  {typeof set.averageScore === "number" 
                    ? `${formatNumber(set.averageScore)}%` 
                    : "—"
                  }
                </dd>
              </div>
            </dl>
              <footer className={styles.cardActions}>
                {cardActions.map(({ key, icon: Icon, isPrimary }) => (
                  <Link
                    key={key}
                    href={`/homework/builder/${set.id}/${key}`}
                    className={styles.cardAction}
                    data-primary={isPrimary}
                    aria-label={t(`builder.dashboard.card.${key}.aria`, { title: set.title })}
                  >
                    <Icon size={16} />
                    {t(`builder.dashboard.card.${key}`)}
                  </Link>
                ))}
              </footer>
            </article>
          );
        })}
      </div>

      {!isLoading && totalCount === 0 && (
        <div className={styles.emptyState} role="img" aria-label={t("builder.dashboard.empty.illustration")}>
          <div className={styles.emptyStateIcon}>
            <Plus size={40} />
          </div>
          <h3>{t("builder.dashboard.empty.title")}</h3>
          <p>{t("builder.dashboard.empty.message")}</p>
          <p>{t("builder.dashboard.empty.subtext")}</p>
          <Link href="/homework/builder/create" className={styles.emptyCta}>
            <Plus size={18} />
            {t("builder.dashboard.empty.cta")}
          </Link>
        </div>
      )}
    </div>
  );
}
