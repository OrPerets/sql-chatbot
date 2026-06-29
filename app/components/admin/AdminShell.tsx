"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DEFAULT_ADMIN_EMAILS } from "@/lib/admin-emails";

import ModernAdminLayout from "./ModernAdminLayout";
import { getAdminRouteMatch } from "./adminRoutes";
import styles from "./AdminShell.module.css";

type AdminShellContextValue = {
  currentUser: string | null;
  currentAdminEmail: string | null;
  logout: () => void;
};

const RECENT_ROUTES_STORAGE_KEY = "admin_recent_routes";
const AdminShellContext = createContext<AdminShellContextValue | null>(null);

function readStoredUser() {
  const stored = localStorage.getItem("currentUser");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as { name?: string; email?: string };
  } catch (error) {
    console.error("Failed to parse currentUser from localStorage:", error);
    return null;
  }
}

function recordRecentRoute(pathname: string) {
  const route = getAdminRouteMatch(pathname);
  if (!route || route.id === "admin-home") return;

  const previous = localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
  const items = previous ? (JSON.parse(previous) as Array<{ href: string; at: string }>) : [];
  const next = [{ href: route.href, at: new Date().toISOString() }, ...items.filter((item) => item.href !== route.href)]
    .slice(0, 6);
  localStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify(next));
}

export function useAdminShell() {
  const context = useContext(AdminShellContext);
  if (!context) {
    throw new Error("useAdminShell must be used within AdminShell.");
  }
  return context;
}

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = readStoredUser();
    if (!user?.email) {
      router.replace("/login");
      return;
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    if (!DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase()).includes(normalizedEmail)) {
      setError("אין לך הרשאת גישה לממשק המנהל.");
      setAuthChecked(true);
      window.setTimeout(() => router.replace("/login"), 1800);
      return;
    }

    setCurrentUser(user.name || normalizedEmail);
    setCurrentAdminEmail(normalizedEmail);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!currentAdminEmail) return;

    let cancelled = false;

    async function validateAdminSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`admin session rejected (${response.status})`);
        }

        const payload = (await response.json()) as { email?: string };
        const sessionEmail = payload.email?.toLowerCase().trim();
        if (sessionEmail !== currentAdminEmail) {
          throw new Error("admin session email mismatch");
        }
      } catch (validationError) {
        console.error("Admin session validation failed:", validationError);
        if (cancelled) return;
        localStorage.removeItem("currentUser");
        setCurrentUser(null);
        setCurrentAdminEmail(null);
        setError("פג תוקף ההתחברות לממשק המנהל. יש להתחבר מחדש.");
        setAuthChecked(true);
        router.replace("/login");
      }
    }

    void validateAdminSession();

    return () => {
      cancelled = true;
    };
  }, [currentAdminEmail, router]);

  useEffect(() => {
    if (!authChecked || !currentAdminEmail || !pathname) return;
    recordRecentRoute(pathname);
  }, [authChecked, currentAdminEmail, pathname]);

  const logout = useCallback(() => {
    localStorage.removeItem("currentUser");
    void fetch("/api/users/logout", { method: "POST" });
    router.push("/");
  }, [router]);

  const contextValue = useMemo<AdminShellContextValue>(
    () => ({
      currentUser,
      currentAdminEmail,
      logout,
    }),
    [currentAdminEmail, currentUser, logout]
  );

  if (!authChecked) {
    return (
      <div className={styles.bootstrapState}>
        <div className={styles.bootstrapCard}>
          <h1 className={styles.bootstrapTitle}>טוען סביבת ניהול</h1>
          <p className={styles.bootstrapText}>בודק הרשאות ומכין את מרכז הפיקוד.</p>
        </div>
      </div>
    );
  }

  if (!currentAdminEmail) {
    return (
      <div className={styles.bootstrapState}>
        <div className={styles.bootstrapCard}>
          <h1 className={styles.bootstrapTitle}>גישה חסומה</h1>
          <p className={styles.bootstrapText}>{error || "אין הרשאה להיכנס לממשק זה."}</p>
        </div>
      </div>
    );
  }

  return (
    <AdminShellContext.Provider value={contextValue}>
      <ModernAdminLayout currentUser={currentUser} onLogout={logout}>
        {children}
      </ModernAdminLayout>
    </AdminShellContext.Provider>
  );
}
