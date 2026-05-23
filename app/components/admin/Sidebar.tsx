"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, PanelRightClose, User } from "lucide-react";

import {
  ADMIN_BUCKETS,
  getAdminRouteMatch,
  getRoutesForBucket,
} from "./adminRoutes";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  currentUser?: string | null;
  onLogout: () => void;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onNavigate,
  currentUser,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const activeRoute = getAdminRouteMatch(pathname);

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""}`}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target.closest("a[href]")) {
          onNavigate?.();
        }
      }}
    >
      <div className={styles.sidebarHeader}>
        {!isCollapsed ? (
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <PanelRightClose size={18} />
            </div>
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>Admin</div>
            </div>
          </div>
        ) : (
          <div className={styles.brandIcon}>
            <PanelRightClose size={18} />
          </div>
        )}

        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          title={isCollapsed ? "הרחב תפריט" : "כווץ תפריט"}
          aria-label={isCollapsed ? "הרחב תפריט" : "כווץ תפריט"}
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className={styles.navigation} aria-label="ניווט אדמין">
        {ADMIN_BUCKETS.map((bucket) => {
          const routes = getRoutesForBucket(bucket.id);
          return (
            <section key={bucket.id} className={styles.navigationSection}>
              {!isCollapsed ? <div className={styles.sectionLabel}>{bucket.label}</div> : null}

              <div className={styles.routeList}>
                {routes.map((route) => {
                  const Icon = route.icon;
                  const isActive = activeRoute?.id === route.id;

                  return (
                    <Link
                      key={route.id}
                      href={route.href}
                      onClick={onNavigate}
                      className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""} ${
                        isCollapsed ? styles.navLinkCollapsed : ""
                      }`}
                      title={`${route.label}: ${route.description}`}
                    >
                      <span className={styles.navLinkIcon}>
                        <Icon size={18} />
                      </span>
                      {!isCollapsed ? (
                        <span className={styles.navLinkBody}>
                          <span className={styles.navLinkLabel}>{route.label}</span>
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>
            <User size={16} />
          </div>
          {!isCollapsed ? (
            <div className={styles.profileBody}>
              <div className={styles.profileName}>{currentUser || "מנהל מערכת"}</div>
              <div className={styles.profileRole}>Admin</div>
            </div>
          ) : null}
        </div>

        <button type="button" className={styles.footerButton} onClick={onLogout}>
          <LogOut size={16} />
          {!isCollapsed ? <span>יציאה</span> : null}
        </button>
      </div>
    </aside>
  );
}
