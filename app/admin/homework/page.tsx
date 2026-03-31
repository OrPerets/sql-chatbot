import "@/app/homework/common/theme.css";
import { cookies, headers } from "next/headers";
import AdminShell from "@/app/components/admin/AdminShell";
import { HomeworkLocaleProvider } from "@/app/homework/context/HomeworkLocaleProvider";
import { resolveHomeworkLocale } from "@/app/homework/context/locale";
import { HomeworkQueryProvider } from "@/app/homework/context/HomeworkQueryProvider";
import BuilderDashboardPage from "@/app/homework/builder/page";

export default async function AdminHomeworkPage() {
  const headerList = await headers();
  const cookieStore = await cookies();
  const headerLocale = headerList.get("x-michael-locale");
  const cookieLocale = cookieStore.get("michael-locale")?.value ?? null;
  const initialLocale = resolveHomeworkLocale(cookieLocale ?? headerLocale ?? "he");

  return (
    <AdminShell>
      <HomeworkLocaleProvider initialLocale={initialLocale}>
        <HomeworkQueryProvider>
          <BuilderDashboardPage />
        </HomeworkQueryProvider>
      </HomeworkLocaleProvider>
    </AdminShell>
  );
}
