import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { InstructionsSection } from "@/app/homework/runner/[setId]/InstructionsSection";
import { ExpectedOutputCard } from "@/app/homework/runner/[setId]/ExpectedOutputCard";
import { QuestionPromptCard } from "@/app/homework/runner/[setId]/QuestionPromptCard";
import { QuestionTipsCard } from "@/app/homework/runner/[setId]/QuestionTipsCard";

describe("runner information architecture components", () => {
  it("renders the data structure section title and content", () => {
    render(
      <InstructionsSection
        title="מבנה הנתונים"
        instructions={"טבלת Students מכילה פרטי סטודנטים.\n\nטבלת Scores מכילה ציונים."}
      />
    );

    expect(screen.getByText("מבנה הנתונים")).toBeInTheDocument();
    expect(screen.getByText("טבלת Students מכילה פרטי סטודנטים.")).toBeInTheDocument();
    expect(screen.getByText("טבלת Scores מכילה ציונים.")).toBeInTheDocument();
  });

  it("renders an empty-state fallback when no structure notes exist", () => {
    render(
      <InstructionsSection
        title="מבנה הנתונים"
        instructions=""
        emptyMessage="אין כרגע הסבר למבנה הנתונים."
      />
    );

    expect(screen.getByText("אין כרגע הסבר למבנה הנתונים.")).toBeInTheDocument();
  });

  it("renders distinct cards for prompt, expected output and tips", () => {
    render(
      <div>
        <QuestionPromptCard questionNumber={3} prompt="החזירו את כל הסטודנטים עם ציון מעל 90." />
        <ExpectedOutputCard description="הפלט צריך לכלול שם סטודנט וציון." />
        <QuestionTipsCard instructions="השתמשו ב-ORDER BY לצורך מיון." />
      </div>
    );

    expect(screen.getByText("שאלה 3")).toBeInTheDocument();
    expect(screen.getByText("מה צריך לעשות?")).toBeInTheDocument();
    expect(screen.getByText("החזירו את כל הסטודנטים עם ציון מעל 90.")).toBeInTheDocument();
    expect(screen.getByText("מה אמור להתקבל?")).toBeInTheDocument();
    expect(screen.getByText("הפלט צריך לכלול שם סטודנט וציון.")).toBeInTheDocument();
    expect(screen.getByText("טיפים ודגשים")).toBeInTheDocument();
    expect(screen.getByText("השתמשו ב-ORDER BY לצורך מיון.")).toBeInTheDocument();
  });

  it("renders placeholder copy for missing expected output", () => {
    render(
      <ExpectedOutputCard
        description="לא הוגדר עדיין תיאור פלט צפוי. במצב תצוגה מקדימה כדאי להוסיף expectedOutputDescription לשאלה."
        isPlaceholder
      />
    );

    expect(screen.getByText(/לא הוגדר עדיין תיאור פלט צפוי/)).toBeInTheDocument();
  });
});
