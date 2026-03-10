import "@/app/homework/common/theme.css";
import { cookies, headers } from "next/headers";
import { HomeworkLocaleProvider } from "@/app/homework/context/HomeworkLocaleProvider";
import { resolveHomeworkLocale } from "@/app/homework/context/locale";
import { HomeworkQueryProvider } from "@/app/homework/context/HomeworkQueryProvider";
import BuilderDashboardPage from "@/app/homework/builder/page";

export default async function AdminHomeworkPage() {
  const headerList = await headers();
  const cookieStore = await cookies();
  const acceptLanguage = headerList.get("accept-language") ?? "";
  const headerLocale = headerList.get("x-michael-locale");
  const cookieLocale = cookieStore.get("michael-locale")?.value ?? null;
  const initialLocale = resolveHomeworkLocale(cookieLocale ?? headerLocale ?? acceptLanguage);

  return (
    <HomeworkLocaleProvider initialLocale={initialLocale}>
      <HomeworkQueryProvider>
        <BuilderDashboardPage />
      </HomeworkQueryProvider>
    </HomeworkLocaleProvider>
  );
}
