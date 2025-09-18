import { GradeHomeworkClient } from "./GradeHomeworkClient";

interface GradePageProps {
  params: { setId: string };
}

export default function GradeHomeworkPage({ params }: GradePageProps) {
  return <GradeHomeworkClient setId={params.setId} />;
}
