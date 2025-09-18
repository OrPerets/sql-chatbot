"use client";

import "@/app/homework/common/theme.css";
import { HomeworkLocaleProvider } from "@/app/homework/context/HomeworkLocaleProvider";
import { HomeworkQueryProvider } from "@/app/homework/context/HomeworkQueryProvider";
import BuilderDashboardPage from "@/app/homework/builder/page";

export default function AdminHomeworkPage() {
  return (
    <HomeworkLocaleProvider>
      <HomeworkQueryProvider>
        <BuilderDashboardPage />
      </HomeworkQueryProvider>
    </HomeworkLocaleProvider>
  );
}

