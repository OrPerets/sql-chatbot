import type { Metadata } from "next";
import { RunnerClient } from "./RunnerClient";
import { SubmittedPage } from "./SubmittedPage";
import { getSubmissionForStudent } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { isHomeworkAccessible } from "@/lib/deadline-utils";
import { getUsersService } from "@/lib/users";
import { redirect } from "next/navigation";

interface RunnerPageProps {
  params: { setId: string };
  searchParams?: { studentId?: string };
}

export const metadata: Metadata = {
  title: "Homework Runner",
};

export default async function RunnerPage({ params, searchParams }: RunnerPageProps) {
  const studentId = searchParams?.studentId ?? "student-demo";
  
  // Get homework set and check deadline
  const homeworkSet = await getHomeworkSetById(params.setId);
  if (!homeworkSet) {
    redirect("/homework/start");
  }

  // Get user email for deadline check
  let userEmail: string | null = null;
  if (studentId && studentId !== "student-demo") {
    try {
      const usersService = await getUsersService();
      const user = await usersService.findUserByIdOrEmail(studentId);
      if (user && user.email) {
        userEmail = user.email;
      }
    } catch (error) {
      console.warn("Could not lookup user for deadline check:", error);
    }
  }

  // Check if homework is still accessible
  if (!isHomeworkAccessible(homeworkSet.dueAt, userEmail)) {
    redirect(`/homework/start?setId=${params.setId}&error=deadline_passed`);
  }
  
  // Check if submission is already submitted
  try {
    const submission = await getSubmissionForStudent(params.setId, studentId);
    
    if (submission && (submission.status === "submitted" || submission.status === "graded")) {
      return (
        <SubmittedPage 
          homeworkTitle={homeworkSet.title}
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
