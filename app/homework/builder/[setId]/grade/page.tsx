import { GradeHomeworkClient } from "./GradeHomeworkClient";

interface GradePageProps {
  params: Promise<{ setId: string }>;
}

export default async function GradeHomeworkPage({ params }: GradePageProps) {
  const { setId } = await params;
  return <GradeHomeworkClient setId={setId} />;
}
