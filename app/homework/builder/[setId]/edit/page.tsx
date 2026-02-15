import { Suspense } from "react";
import { EditHomeworkClient } from "./EditHomeworkClient";

interface EditPageProps {
  params: Promise<{ setId: string }>;
}

export default async function EditHomeworkPage({ params }: EditPageProps) {
  const { setId } = await params;
  return (
    <Suspense fallback={<div>Loading homework…</div>}>
      <EditHomeworkClient setId={setId} />
    </Suspense>
  );
}

