"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./BuilderShell.module.css";

type BuilderShellProps = PropsWithChildren<{ activePath?: string }>;

const navLinks = [
  { href: "/homework/builder", labelKey: "builder.nav.dashboard" },
  { href: "/homework/builder/create", labelKey: "builder.nav.create" },
  { href: "/homework", labelKey: "builder.nav.home" },
];

export function BuilderShell({ children, activePath }: BuilderShellProps) {
  const pathname = usePathname();
  const { t, direction } = useHomeworkLocale();
  const currentPath = activePath ?? pathname;
  
  // Hide sidebar on grade pages
  const isGradePage = currentPath?.includes('/grade');

  return (
    <div className={styles.container} dir={direction} data-hide-sidebar={isGradePage}>
      {!isGradePage && (
        <aside className={styles.sidebar}>
          <div className={styles.logo}>{t("builder.logo")}</div>
          <nav className={styles.nav}>
            {navLinks.map((link) => {
              const isActive = currentPath === link.href || currentPath.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}
      <section className={styles.content}>{children}</section>
    </div>
  );
}
