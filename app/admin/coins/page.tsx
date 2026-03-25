"use client";

import { useEffect, useState } from "react";

import ModernAdminLayout from "@/app/components/admin/ModernAdminLayout";
import CoinsManagementPanel from "@/app/components/admin/CoinsManagementPanel";
import styles from "./page.module.css";

const ADMIN_EMAILS = [
  "liorbs89@gmail.com",
  "eyalh747@gmail.com",
  "orperets11@gmail.com",
  "roeizer@shenkar.ac.il",
  "r_admin@gmail.com",
];

export default function AdminCoinsPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      window.location.href = "/login";
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      const normalizedEmail =
        typeof parsed?.email === "string" ? parsed.email.toLowerCase().trim() : "";

      if (!ADMIN_EMAILS.includes(normalizedEmail)) {
        setError("אין לך הרשאת גישה למסך המטבעות.");
        setAuthChecked(true);
        return;
      }

      setCurrentUser(parsed?.name || normalizedEmail);
      setCurrentAdminEmail(normalizedEmail);
      setAuthChecked(true);
    } catch (authError) {
      console.error("Failed to parse current user from localStorage:", authError);
      setError("שגיאה בזיהוי המשתמש המחובר.");
      setAuthChecked(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    window.location.href = "/";
  };

  if (!authChecked) {
    return <div className={styles.bootstrapState}>טוען הרשאות...</div>;
  }

  if (!currentAdminEmail) {
    return <div className={styles.bootstrapState}>{error || "אין לך הרשאה למסך זה."}</div>;
  }

  return (
    <ModernAdminLayout
      activeTab="coins"
      onTabChange={() => undefined}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      <CoinsManagementPanel currentAdminEmail={currentAdminEmail} />
    </ModernAdminLayout>
  );
}
