import { Suspense } from "react";
import { EditHomeworkClient } from "./EditHomeworkClient";

interface EditPageProps {
  params: { setId: string };
}

export default function EditHomeworkPage({ params }: EditPageProps) {
  return (
    <Suspense fallback={<div>Loading homework…</div>}>
      <EditHomeworkClient setId={params.setId} />
    </Suspense>
  );
}

