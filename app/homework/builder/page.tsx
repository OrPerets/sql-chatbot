"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit3,
  Eye,
  GraduationCap,
  CheckCircle,
  Clock,
  AlertCircle,
  Archive,
  Send,
  Copy,
  ExternalLink,
  Wand2,
  FileText,
  BarChart3,
  CalendarRange,
  Users,
} from "lucide-react";
import { useHomeworkSets } from "@/app/homework/hooks/useHomeworkSets";
import type { HomeworkAvailabilityInfo, HomeworkSummary } from "@/app/homework/types";
import styles from "./dashboard.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import { resolveBuilderDashboardStatus, type BuilderDashboardStatus } from "./components/wizard/validation";

type BuilderHomeworkSummary = HomeworkSummary & Partial<HomeworkAvailabilityInfo>;

const statusFilters: BuilderDashboardStatus[] = ["draft", "upcoming", "open", "closed", "archived"];

const statusIcons = {
  draft: AlertCircle,
  upcoming: Clock,
  open: CheckCircle,
  closed: Clock,
  archived: Archive,
};

const cardActions = [
  { key: "edit", icon: Edit3, isPrimary: true },
  { key: "solution", icon: Eye, isPrimary: false },
  { key: "publish", icon: Send, isPrimary: false },
  { key: "grade", icon: GraduationCap, isPrimary: false },
];

function groupByStatus(items: BuilderHomeworkSummary[]) {
  return items.reduce<Record<BuilderDashboardStatus, BuilderHomeworkSummary[]>>(
    (acc, item) => {
      const status = resolveBuilderDashboardStatus(item);
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status]!.push(item);
      return acc;
    },
    {
      draft: [],
      upcoming: [],
      open: [],
      closed: [],
      archived: [],
    },
  );
}

export default function BuilderDashboardPage() {
  const [activeFilter, setActiveFilter] = useState<BuilderDashboardStatus | "all">("all");
  const [copiedSetId, setCopiedSetId] = useState<string | null>(null);
  const [aiBusySetId, setAiBusySetId] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useHomeworkSets({ role: "builder" });
  const { t, formatNumber, formatDateTime, direction } = useHomeworkLocale();

  const allItems = useMemo(() => (data?.items ?? []) as BuilderHomeworkSummary[], [data?.items]);
  const grouped = useMemo(() => groupByStatus(allItems), [allItems]);
  const filteredItems = useMemo(
    () => (activeFilter === "all" ? allItems : grouped[activeFilter] ?? []),
    [activeFilter, allItems, grouped],
  );
  const totalCount = allItems.length;
  const totalSubmissions = useMemo(
    () => allItems.reduce((sum, set) => sum + set.submissionCount, 0),
    [allItems],
  );
  const openCount = grouped.open.length;
  const avgScoreAcrossSets = useMemo(() => {
    const scored = allItems.filter((set) => typeof set.averageScore === "number");
    if (scored.length === 0) return null;
    const average = scored.reduce((sum, set) => sum + (set.averageScore ?? 0), 0) / scored.length;
    return Math.round(average);
  }, [allItems]);

  const handleCopyLink = async (setId: string) => {
    const entryUrl = `${window.location.origin}/homework/start/${setId}`;
    await navigator.clipboard.writeText(entryUrl);
    setCopiedSetId(setId);
    window.setTimeout(() => {
      setCopiedSetId((current) => (current === setId ? null : current));
    }, 1800);
  };

  const handleGenerateSolutions = async (setId: string) => {
    setAiBusySetId(setId);
    setAiFeedback((current) => ({ ...current, [setId]: t("builder.dashboard.ai.generating") }));
    try {
      const response = await fetch(`/api/homework/${setId}/ai-generate-solutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: false }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || "Failed to generate solutions");
      }

      const message =
        result.totalGenerated > 0
          ? t("builder.dashboard.ai.success", { count: String(result.totalSaved ?? result.totalGenerated) })
          : result.message || t("builder.dashboard.ai.noop");
      setAiFeedback((current) => ({ ...current, [setId]: message }));
    } catch (err) {
      setAiFeedback((current) => ({
        ...current,
        [setId]: err instanceof Error ? err.message : t("builder.dashboard.ai.error"),
      }));
    } finally {
      setAiBusySetId(null);
    }
  };

  return (
    <div className={styles.container} dir={direction}>
      {/* Page header */}
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>{t("builder.dashboard.title")}</h1>
          <p>{t("builder.dashboard.subtitle")}</p>
        </div>
        <Link href="/homework/builder/create" className={styles.createButton}>
          <Plus size={18} />
          {t("builder.dashboard.newSet")}
        </Link>
      </header>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statIcon}>
            <FileText size={18} />
          </div>
          <div>
            <span className={styles.statValue}>{formatNumber(totalCount)}</span>
            <span className={styles.statLabel}>{t("builder.dashboard.stats.total")}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={`${styles.statIcon} ${styles.statIconOpen}`}>
            <CheckCircle size={18} />
          </div>
          <div>
            <span className={styles.statValue}>{formatNumber(openCount)}</span>
            <span className={styles.statLabel}>{t("builder.dashboard.stats.open")}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={`${styles.statIcon} ${styles.statIconSubmissions}`}>
            <Users size={18} />
          </div>
          <div>
            <span className={styles.statValue}>{formatNumber(totalSubmissions)}</span>
            <span className={styles.statLabel}>{t("builder.dashboard.stats.submissions")}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={`${styles.statIcon} ${styles.statIconAvg}`}>
            <BarChart3 size={18} />
          </div>
          <div>
            <span className={styles.statValue}>
              {avgScoreAcrossSets === null ? "—" : `${formatNumber(avgScoreAcrossSets)}%`}
            </span>
            <span className={styles.statLabel}>{t("builder.dashboard.stats.average")}</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <button
          type="button"
          className={activeFilter === "all" ? `${styles.filterChip} ${styles.filterActive}` : styles.filterChip}
          onClick={() => setActiveFilter("all")}
          aria-pressed={activeFilter === "all"}
        >
          {t("builder.dashboard.filter.all")}
          <span className={styles.filterCount}>{formatNumber(totalCount)}</span>
        </button>
        {statusFilters.map((filter) => {
          const Icon = statusIcons[filter];
          const count = grouped[filter]?.length ?? 0;
          return (
            <button
              type="button"
              key={filter}
              className={activeFilter === filter ? `${styles.filterChip} ${styles.filterActive}` : styles.filterChip}
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
              disabled={count === 0 && !isLoading}
            >
              <Icon size={14} />
              {t(`builder.dashboard.filter.${filter}`, undefined, filter)}
              <span className={styles.filterCount}>{formatNumber(count)}</span>
            </button>
          );
        })}
      </div>

      {/* Loading / error states */}
      {isLoading && <p className={styles.loadingText}>{t("builder.dashboard.loading")}</p>}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          {t("builder.dashboard.error")}
        </div>
      )}

      {/* Card grid */}
      <div className={styles.grid}>
        {filteredItems.map((set) => {
          const status = resolveBuilderDashboardStatus(set);
          const StatusIcon = statusIcons[status as keyof typeof statusIcons];
          const isGenerating = aiBusySetId === set.id;

          return (
            <article key={set.id} className={styles.card} data-status={status}>
              {/* Card header: title + status */}
              <div className={styles.cardTop}>
                <div className={styles.cardTitleGroup}>
                  <h3 className={styles.cardTitle}>{set.title}</h3>
                  <span className={styles.cardCourse}>{set.courseId}</span>
                </div>
                <span className={styles.statusBadge} data-status={status}>
                  <StatusIcon size={12} />
                  {t(`builder.dashboard.filter.${status}`, undefined, status)}
                </span>
              </div>

              {/* Key metrics */}
              <div className={styles.cardMeta}>
                <div className={styles.metaCell}>
                  <dt>{t("builder.dashboard.card.questions")}</dt>
                  <dd>{formatNumber(set.draftQuestionCount)}</dd>
                </div>
                <div className={styles.metaCell}>
                  <dt>{t("builder.dashboard.card.submissions")}</dt>
                  <dd>{formatNumber(set.submissionCount)}</dd>
                </div>
                <div className={styles.metaCell}>
                  <dt>{t("builder.dashboard.card.average")}</dt>
                  <dd>{typeof set.averageScore === "number" ? `${formatNumber(set.averageScore)}%` : "—"}</dd>
                </div>
              </div>

              {/* Dates */}
              <div className={styles.cardDates}>
                <CalendarRange size={14} />
                <span>
                  {set.availableFrom
                    ? formatDateTime(set.availableFrom, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
                <span className={styles.dateSeparator}>→</span>
                <span>
                  {set.availableUntil
                    ? formatDateTime(set.availableUntil, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>

              {/* Student link + copy */}
              <div className={styles.cardLinkRow}>
                <Link href={`/homework/start/${set.id}`} className={styles.studentLink}>
                  <ExternalLink size={13} />
                  {t("builder.dashboard.card.studentLink")}
                </Link>
                <button type="button" className={styles.copyBtn} onClick={() => handleCopyLink(set.id)}>
                  <Copy size={13} />
                  {copiedSetId === set.id ? t("builder.dashboard.card.copied") : t("builder.dashboard.card.copy")}
                </button>
              </div>

              {/* AI row */}
              {set.draftQuestionCount > 0 && (
                <div className={styles.cardAi}>
                  <button
                    type="button"
                    className={styles.aiBtn}
                    onClick={() => handleGenerateSolutions(set.id)}
                    disabled={isGenerating}
                  >
                    <Wand2 size={14} />
                    {isGenerating ? t("builder.dashboard.ai.generating") : t("builder.dashboard.card.aiCta")}
                  </button>
                  {aiFeedback[set.id] && (
                    <span className={styles.aiFeedback}>{aiFeedback[set.id]}</span>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className={styles.cardActions}>
                {cardActions.map(({ key, icon: Icon, isPrimary }) => (
                  <Link
                    key={key}
                    href={`/homework/builder/${set.id}/${key}`}
                    className={isPrimary ? `${styles.actionBtn} ${styles.actionPrimary}` : styles.actionBtn}
                    aria-label={t(`builder.dashboard.card.${key}.aria`, { title: set.title })}
                  >
                    <Icon size={15} />
                    {t(`builder.dashboard.card.${key}`)}
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {/* Empty state */}
      {!isLoading && totalCount === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Plus size={28} />
          </div>
          <h3>{t("builder.dashboard.empty.title")}</h3>
          <p>{t("builder.dashboard.empty.message")}</p>
          <Link href="/homework/builder/create" className={styles.emptyCta}>
            <Plus size={16} />
            {t("builder.dashboard.empty.cta")}
          </Link>
        </div>
      )}
    </div>
  );
}
