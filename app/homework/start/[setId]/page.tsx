import { Suspense } from "react";
import { StudentEntryClient } from "../../StudentEntryClient";

interface StudentEntryBySetPageProps {
  params: Promise<{ setId: string }>;
}

export default async function StudentEntryBySetPage({ params }: StudentEntryBySetPageProps) {
  const resolvedParams = await params;

  return (
    <Suspense fallback={<div>טוען...</div>}>
      <StudentEntryClient forcedSetId={resolvedParams.setId} />
    </Suspense>
  );
}
