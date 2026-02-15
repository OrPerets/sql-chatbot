import { Suspense } from "react";
import { PublishHomeworkClient } from "./PublishHomeworkClient";

interface PublishPageProps {
  params: Promise<{ setId: string }>;
}

export default async function PublishHomeworkPage({ params }: PublishPageProps) {
  const { setId } = await params;
  return (
    <Suspense fallback={<div>טוען...</div>}>
      <PublishHomeworkClient setId={setId} />
    </Suspense>
  );
}

