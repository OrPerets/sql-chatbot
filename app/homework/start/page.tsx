import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudentEntryClient } from "../StudentEntryClient";

export const metadata = {
  title: "שיעורי בית SQL - כניסה",
  description: "כניסה לשיעור בית SQL",
};

interface StudentEntryPageProps {
  searchParams?: Promise<{ setId?: string }>;
}

export default async function StudentEntryPage({ searchParams }: StudentEntryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  if (resolvedSearchParams.setId) {
    redirect(`/homework/start/${encodeURIComponent(resolvedSearchParams.setId)}`);
  }

  return (
    <Suspense fallback={<div>טוען...</div>}>
      <StudentEntryClient />
    </Suspense>
  );
}
