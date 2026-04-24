"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Settings2,
  User,
  UserCircle,
} from "lucide-react";

import {
  getAdminBreadcrumbs,
  getAdminCommandItems,
  getAdminRouteMatch,
} from "./adminRoutes";
import styles from "./ModernHeader.module.css";

interface ModernHeaderProps {
  currentUser?: string | null;
  onLogout: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  showMobileMenu?: boolean;
  onToggleMobileMenu?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  type: "info" | "warning" | "success" | "error" | "system";
}

function formatTimeAgo(createdAt: string) {
  const now = new Date();
  const notificationDate = new Date(createdAt);
  const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "עכשיו";
  if (diffInMinutes < 60) return `${diffInMinutes} דק׳`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} ש׳`;
  return `${Math.floor(diffInMinutes / 1440)} ימים`;
}

export default function ModernHeader({
  currentUser,
  onLogout,
  isSidebarCollapsed,
  onToggleSidebar,
  onToggleMobileMenu,
}: ModernHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const route = useMemo(() => getAdminRouteMatch(pathname), [pathname]);
  const breadcrumbs = useMemo(() => getAdminBreadcrumbs(pathname), [pathname]);
  const commandItems = useMemo(() => getAdminCommandItems(), []);

  const filteredCommands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return commandItems.slice(0, 8);
    }

    return commandItems
      .filter((item) => {
        const haystack = [item.label, item.description, ...(item.keywords || [])].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [commandItems, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/admin/notifications?limit=6", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    }

    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(`.${styles.commandArea}`)) {
        setShowCommandMenu(false);
      }
      if (!target.closest(`.${styles.notificationWrapper}`)) {
        setShowNotifications(false);
      }
      if (!target.closest(`.${styles.userMenuWrapper}`)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateTo = (href: string) => {
    setShowCommandMenu(false);
    setSearchQuery("");
    router.push(href);
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAsRead", notificationId }),
      });

      if (!response.ok) return;

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllAsRead" }),
      });

      if (!response.ok) return;
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  return (
    <header className={`${styles.header} ${isSidebarCollapsed ? styles.headerCollapsed : ""}`}>
      <div className={styles.headerContainer}>
        <div className={styles.headerLead}>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={onToggleMobileMenu || onToggleSidebar}
            aria-label="פתח תפריט"
          >
            <Menu size={18} />
          </button>

          <div className={styles.titleArea}>
            <div className={styles.breadcrumbs}>
              {breadcrumbs.map((item, index) => {
                const isCurrent = index === breadcrumbs.length - 1;
                return isCurrent ? (
                  <span key={item.id} className={styles.breadcrumbCurrent}>
                    {item.label}
                  </span>
                ) : (
                  <span key={item.id} className={styles.breadcrumbItem}>
                    <Link href={item.href}>{item.label}</Link>
                    <span className={styles.breadcrumbSeparator}>/</span>
                  </span>
                );
              })}
            </div>

            <div>
              <div className={styles.pageTitle}>{route?.label || "מערכת ניהול"}</div>
            </div>
          </div>
        </div>

        <div className={styles.commandArea}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setShowCommandMenu(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filteredCommands[0]) {
                navigateTo(filteredCommands[0].href);
              }
            }}
            placeholder="קפיצה מהירה"
            aria-label="חיפוש מהיר בממשק האדמין"
          />

          {showCommandMenu ? (
            <div className={styles.commandMenu}>
              {filteredCommands.length ? (
                filteredCommands.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.commandItem}
                      onClick={() => navigateTo(item.href)}
                    >
                      <span className={styles.commandIcon}>
                        <Icon size={16} />
                      </span>
                      <span className={styles.commandLabel} title={item.description}>
                        {item.label}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className={styles.emptyMenuState}>לא נמצאו מסכים או פעולות תואמים.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.notificationWrapper}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                setShowNotifications((current) => !current);
                setShowUserMenu(false);
              }}
              aria-label="הודעות"
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className={styles.notificationBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              ) : null}
            </button>

            {showNotifications ? (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>
                  <div>
                    <div className={styles.dropdownTitle}>התראות</div>
                    <div className={styles.dropdownSubtitle}>מה השתנה מאז הביקור האחרון שלך</div>
                  </div>
                  {unreadCount > 0 ? (
                    <button type="button" className={styles.inlineAction} onClick={clearAllNotifications}>
                      סמן הכל כנקרא
                    </button>
                  ) : null}
                </div>

                <div className={styles.dropdownList}>
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`${styles.notificationItem} ${
                          notification.isRead ? "" : styles.notificationUnread
                        }`}
                        onClick={() => markNotificationAsRead(notification.id)}
                      >
                        <span className={styles.notificationTitle}>{notification.title}</span>
                        <span className={styles.notificationMessage}>{notification.message}</span>
                        <span className={styles.notificationTime}>לפני {formatTimeAgo(notification.createdAt)}</span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.emptyMenuState}>אין כרגע התראות חדשות.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.userMenuWrapper}>
            <button
              type="button"
              className={styles.userButton}
              onClick={() => {
                setShowUserMenu((current) => !current);
                setShowNotifications(false);
              }}
            >
              <span className={styles.userAvatar}>
                <User size={15} />
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{currentUser || "מנהל מערכת"}</span>
                <span className={styles.userRole}>Admin</span>
              </span>
              <ChevronDown size={14} className={styles.userChevron} />
            </button>

            {showUserMenu ? (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>
                  <div className={styles.dropdownTitle}>{currentUser || "מנהל מערכת"}</div>
                  <div className={styles.dropdownSubtitle}>גישה מלאה לממשק הניהול</div>
                </div>

                <div className={styles.dropdownList}>
                  <Link href="/admin/settings" className={styles.menuLink}>
                    <Settings2 size={16} />
                    <span>הגדרות מערכת</span>
                  </Link>
                  <Link href="/admin/users" className={styles.menuLink}>
                    <UserCircle size={16} />
                    <span>ניהול משתמשים</span>
                  </Link>
                  <button type="button" className={styles.menuDanger} onClick={onLogout}>
                    יציאה
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
