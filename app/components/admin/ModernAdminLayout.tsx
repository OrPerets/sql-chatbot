"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import ModernHeader from "./ModernHeader";
import Sidebar from "./Sidebar";
import styles from "./ModernAdminLayout.module.css";

interface ModernAdminLayoutProps {
  children: React.ReactNode;
  currentUser?: string | null;
  onLogout: () => void;
}

export default function ModernAdminLayout({
  children,
  currentUser,
  onLogout,
}: ModernAdminLayoutProps) {
  const pathname = usePathname();
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);

      if (window.innerWidth < 1280 && window.innerWidth >= 1024) {
        setIsSidebarCollapsed(true);
      }

      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (sidebarContainerRef.current?.contains(target)) {
        return;
      }

      setIsMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isMobileMenuOpen]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen((current) => !current);
      return;
    }
    setIsSidebarCollapsed((current) => !current);
  };

  return (
    <div className={styles.layout} dir="rtl">
      {isMobile && isMobileMenuOpen ? (
        <button
          type="button"
          className={styles.mobileOverlay}
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="סגור תפריט"
        />
      ) : null}

      <div
        ref={sidebarContainerRef}
        className={`${styles.sidebarContainer} ${
          isMobileMenuOpen ? styles.sidebarContainerOpen : ""
        }`}
      >
        <Sidebar
          isCollapsed={!isMobile && isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onNavigate={() => setIsMobileMenuOpen(false)}
          currentUser={currentUser}
          onLogout={onLogout}
        />
      </div>

      <div
        className={`${styles.mainContent} ${
          !isMobile && isSidebarCollapsed ? styles.mainContentCollapsed : ""
        }`}
      >
        <ModernHeader
          currentUser={currentUser}
          onLogout={onLogout}
          isSidebarCollapsed={!isMobile && isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          showMobileMenu={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen((current) => !current)}
        />

        <main className={styles.contentWrapper}>
          <div className={styles.pageContent}>{children}</div>
        </main>
      </div>
    </div>
  );
}
