import { Suspense } from "react";
import { PublishHomeworkClient } from "./PublishHomeworkClient";

interface PublishPageProps {
  params: { setId: string };
}

export default function PublishHomeworkPage({ params }: PublishPageProps) {
  return (
    <Suspense fallback={<div>טוען...</div>}>
      <PublishHomeworkClient setId={params.setId} />
    </Suspense>
  );
}

