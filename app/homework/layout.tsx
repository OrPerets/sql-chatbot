import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import HomeworkLayoutClient from "./HomeworkLayoutClient";
import { resolveHomeworkLocale } from "./context/locale";

export default async function HomeworkLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const cookieStore = await cookies();
  const acceptLanguage = headerList.get("accept-language") ?? "";
  const headerLocale = headerList.get("x-michael-locale");
  const cookieLocale = cookieStore.get("michael-locale")?.value ?? null;
  const initialLocale = resolveHomeworkLocale(cookieLocale ?? headerLocale ?? acceptLanguage);

  return <HomeworkLayoutClient initialLocale={initialLocale}>{children}</HomeworkLayoutClient>;
}
