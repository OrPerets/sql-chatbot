import type { Metadata } from "next";
import { RunnerClient } from "./RunnerClient";
import { SubmittedPage } from "./SubmittedPage";
import { getSubmissionForStudent } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";

interface RunnerPageProps {
  params: { setId: string };
  searchParams?: { studentId?: string };
}

export const metadata: Metadata = {
  title: "Homework Runner",
};

export default async function RunnerPage({ params, searchParams }: RunnerPageProps) {
  const studentId = searchParams?.studentId ?? "student-demo";
  
  // Check if submission is already submitted
  try {
    const submission = await getSubmissionForStudent(params.setId, studentId);
    
    if (submission && (submission.status === "submitted" || submission.status === "graded")) {
      // Get homework title for the submitted page
      const homeworkSet = await getHomeworkSetById(params.setId);
      
      return (
        <SubmittedPage 
          homeworkTitle={homeworkSet?.title}
          submittedAt={submission.submittedAt}
          studentId={studentId}
        />
      );
    }
  } catch (error) {
    // If there's an error checking submission, continue to show runner
    // (might be first time accessing)
    console.error("Error checking submission status:", error);
  }
  
  return <RunnerClient setId={params.setId} studentId={studentId} />;
}
