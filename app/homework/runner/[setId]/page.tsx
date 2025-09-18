import type { Metadata } from "next";
import { RunnerClient } from "./RunnerClient";

interface RunnerPageProps {
  params: { setId: string };
  searchParams?: { studentId?: string };
}

export const metadata: Metadata = {
  title: "Homework Runner",
};

export default function RunnerPage({ params, searchParams }: RunnerPageProps) {
  const studentId = searchParams?.studentId ?? "student-demo";
  return <RunnerClient setId={params.setId} studentId={studentId} />;
}
