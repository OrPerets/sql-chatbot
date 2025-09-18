import type { ReactNode } from "react";
import "./common/theme.css";
import styles from "./module.module.css";
import { HomeworkQueryProvider } from "./context/HomeworkQueryProvider";
import { HomeworkLocaleProvider } from "./context/HomeworkLocaleProvider";
import { HomeworkHeader } from "./components/HomeworkHeader";

export default function HomeworkLayout({ children }: { children: ReactNode }) {
  return (
    <HomeworkLocaleProvider>
      <HomeworkQueryProvider>
        <div className={styles.adminContainer}>
          <HomeworkHeader />
          <main className={styles.mainContent}>{children}</main>
        </div>
      </HomeworkQueryProvider>
    </HomeworkLocaleProvider>
  );
}
