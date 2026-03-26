"use client";

import { use } from "react";
import { RunnerClient } from "@/app/homework/runner/[setId]/RunnerClient";

interface PreviewPageProps {
  params: Promise<{ setId: string }>;
}

export default function PreviewHomeworkPage({ params }: PreviewPageProps) {
  const { setId } = use(params);

  return <RunnerClient setId={setId} studentId="student-demo" />;
}
