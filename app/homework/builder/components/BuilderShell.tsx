"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { Bot, BookOpen, LayoutDashboard, PlusSquare } from "lucide-react";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./BuilderShell.module.css";

type BuilderShellProps = PropsWithChildren<{ activePath?: string }>;

const navLinks = [
  { href: "/homework/builder", labelKey: "builder.nav.dashboard", icon: LayoutDashboard },
  { href: "/homework/builder/create", labelKey: "builder.nav.create", icon: PlusSquare },
  { href: "/homework", labelKey: "builder.nav.home", icon: BookOpen },
];

export function BuilderShell({ children, activePath }: BuilderShellProps) {
  const pathname = usePathname();
  const { t, direction } = useHomeworkLocale();
  const currentPath = activePath ?? pathname;

  // Hide sidebar on grade pages
  const isGradePage = currentPath?.includes("/grade");

  const isLinkActive = (href: string) => {
    if (!currentPath) return false;
    if (href === "/homework") return currentPath === href;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <div className={styles.container} dir={direction} data-hide-sidebar={isGradePage}>
      {!isGradePage && (
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.brandBadge}>
              <BookOpen size={20} />
            </div>
            <div>
              <div className={styles.brandEyebrow}>{t("builder.logo")}</div>
              <div className={styles.brandTitle}>{t("builder.shell.title")}</div>
              <p className={styles.brandSubtitle}>{t("builder.shell.subtitle")}</p>
            </div>
          </div>
          <nav className={styles.nav}>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
                >
                  <Icon size={18} />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className={styles.assistantCard}>
            <div className={styles.assistantIcon}>
              <Bot size={18} />
            </div>
            <div>
              <strong>{t("builder.shell.assistant.title")}</strong>
              <p>{t("builder.shell.assistant.body")}</p>
            </div>
            <Link href="/homework/builder/create" className={styles.assistantCta}>
              {t("builder.shell.assistant.cta")}
            </Link>
          </div>
        </aside>
      )}
      <section className={styles.content}>{children}</section>
    </div>
  );
}
