import { Suspense } from "react";
import { StudentEntryClient } from "../StudentEntryClient";

export const metadata = {
  title: "שיעורי בית SQL - כניסה",
  description: "כניסה לשיעור בית SQL",
};

export default function StudentEntryPage() {
  return (
    <Suspense fallback={<div>טוען...</div>}>
      <StudentEntryClient />
    </Suspense>
  );
}

