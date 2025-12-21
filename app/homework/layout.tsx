"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import "./common/theme.css";
import styles from "./module.module.css";
import { HomeworkQueryProvider } from "./context/HomeworkQueryProvider";
import { HomeworkLocaleProvider } from "./context/HomeworkLocaleProvider";
import { HomeworkHeader } from "./components/HomeworkHeader";

export default function HomeworkLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Only show admin header for builder and questions routes
  const isBuilderRoute = pathname?.startsWith("/homework/builder");
  const isQuestionsRoute = pathname?.startsWith("/homework/questions");
  const showAdminHeader = isBuilderRoute || isQuestionsRoute;
  
  return (
    <HomeworkLocaleProvider>
      <HomeworkQueryProvider>
        <div className={`${styles.adminContainer} ${!showAdminHeader ? styles.runnerLayout : ''}`}>
          {showAdminHeader && <HomeworkHeader />}
          <main className={`${styles.mainContent} ${!showAdminHeader ? styles.runnerMainContent : ''}`}>
            {children}
          </main>
        </div>
      </HomeworkQueryProvider>
    </HomeworkLocaleProvider>
  );
}
