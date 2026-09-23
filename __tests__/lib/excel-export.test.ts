jest.mock("exceljs", () => {
  class MockWorksheet {
    public rows: any[] = [];
    public columns: any[] = [];
    addRow(values: any[]) {
      this.rows.push(values);
    }
    getRow(index: number) {
      const values = this.rows[index - 1] ?? [];
      return { values: [undefined, ...values] };
    }
  }

  class MockWorkbook {
    public creator?: string;
    public title?: string;
    public views?: any[];
    private sheets = new Map<string, MockWorksheet>();
    public xlsx = {
      writeBuffer: async () => Buffer.from("mock-xlsx"),
      writeFile: async () => undefined,
    };
    addWorksheet(name: string) {
      const sheet = new MockWorksheet();
      this.sheets.set(name, sheet);
      return sheet;
    }
    getWorksheet(name: string) {
      return this.sheets.get(name);
    }
  }

  return {
    __esModule: true,
    default: { Workbook: MockWorkbook },
  };
});

import { buildHomeworkGradesWorkbook, generateHomeworkGradesExcelBuffer } from "@/lib/excel-export";

describe("excel export regression", () => {
  it("keeps homework grades worksheet structure and values", async () => {
    const buffer = await generateHomeworkGradesExcelBuffer({
      homeworkTitle: "HW 3",
      questions: [
        { id: "q1", text: "Q1", type: "text" } as any,
        { id: "q2", text: "Q2", type: "text" } as any,
      ],
      submissions: [
        {
          id: "submission-1",
          studentId: "student1@example.com",
          overallScore: 90,
          answers: {
            q1: { feedback: { score: 40, instructorNotes: "good" } },
            q2: { feedback: { score: 50, instructorNotes: "great" } },
          },
        } as any,
      ],
      summaries: [
        {
          id: "submission-1",
          studentIdNumber: "123456789",
          studentName: "Student One",
        } as any,
      ],
    });

    const workbook = buildHomeworkGradesWorkbook({
      homeworkTitle: "HW 3",
      questions: [
        { id: "q1", text: "Q1", type: "text" } as any,
        { id: "q2", text: "Q2", type: "text" } as any,
      ],
      submissions: [
        {
          id: "submission-1",
          studentId: "student1@example.com",
          overallScore: 90,
          answers: {
            q1: { feedback: { score: 40, instructorNotes: "good" } },
            q2: { feedback: { score: 50, instructorNotes: "great" } },
          },
        } as any,
      ],
      summaries: [
        {
          id: "submission-1",
          studentIdNumber: "123456789",
          studentName: "Student One",
        } as any,
      ],
    });
    const worksheet = workbook.getWorksheet("ציונים");
    expect(worksheet).toBeDefined();

    const headerValues = worksheet!.getRow(1).values as any[];
    expect(headerValues.slice(1, 8)).toEqual([
      "ת.ז",
      "שם",
      "אימייל",
      "שאלה 1 (ניקוד)",
      "שאלה 1 (הערה)",
      "שאלה 2 (ניקוד)",
      "שאלה 2 (הערה)",
    ]);

    const rowValues = worksheet!.getRow(2).values as any[];
    expect(rowValues.slice(1, 9)).toEqual([
      "123456789",
      "Student One",
      "student1@example.com",
      40,
      "good",
      50,
      "great",
      90,
    ]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
